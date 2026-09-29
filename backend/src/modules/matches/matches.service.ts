import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleDestroy,
} from '@nestjs/common';
import { eq, and, sql, asc } from 'drizzle-orm';
import { Chess } from 'chess.js';
import { DRIZZLE, DrizzleDb } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface MovePayload {
  matchId: string;
  from: string;
  to: string;
  promotion?: string;
}

export interface MatchStateNotification {
  matchId: string;
  fen: string;
  pgn: string;
  whiteTimeRemainingMs: number;
  blackTimeRemainingMs: number;
  activeTurn: string;
  lastTurnStartTime?: Date | null;
  status: 'in_progress' | 'completed' | 'aborted';
  result?: 'white_win' | 'black_win' | 'draw' | null;
  reason?: 'checkmate' | 'resignation' | 'timeout' | 'stalemate' | null;
  winnerId?: string | null;
  endedAt?: Date | null;
}

@Injectable()
export class MatchesService implements OnModuleDestroy {
  // Mutex per match to serialize concurrent moves and timeout events
  private matchLocks = new Map<string, Promise<void>>();

  // Active timers per match for server-authoritative timeout handling
  private matchTimers = new Map<string, NodeJS.Timeout>();

  // Registered notification handler for match termination (e.g. timeout)
  private onMatchEndedHandler?: (state: MatchStateNotification) => void;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  onMatchEnded(handler: (state: MatchStateNotification) => void) {
    this.onMatchEndedHandler = handler;
  }

  onModuleDestroy() {
    for (const timer of this.matchTimers.values()) {
      clearTimeout(timer);
    }
    this.matchTimers.clear();
  }

  private async runWithMatchLock<T>(matchId: string, fn: () => Promise<T>): Promise<T> {
    const prevLock = this.matchLocks.get(matchId) || Promise.resolve();
    let release: () => void;
    const currentLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.matchLocks.set(matchId, currentLock);

    try {
      await prevLock;
      return await fn();
    } finally {
      release!();
      if (this.matchLocks.get(matchId) === currentLock) {
        this.matchLocks.delete(matchId);
      }
    }
  }

  async getMatchById(matchId: string, userId: string, role: string) {
    const [match] = await this.db
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .limit(1);

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    const isWhite = match.whitePlayerId === userId;
    const isBlack = match.blackPlayerId === userId;
    const isCoach = role === 'COACH';

    if (!isWhite && !isBlack && !isCoach) {
      throw new ForbiddenException('You are not authorized to view this match');
    }

    const [tournament] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, match.tournamentId))
      .limit(1);

    const [whiteUser] = await this.db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, match.whitePlayerId))
      .limit(1);

    const [blackUser] = await this.db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, match.blackPlayerId))
      .limit(1);

    // If match is in progress, ensure timeout timer is actively ticking on the server
    if (match.status === 'in_progress') {
      this.ensureMatchTimer(match);
    }

    return {
      id: match.id,
      tournamentId: match.tournamentId,
      tournamentName: tournament?.name || 'Tournament',
      timeControl: tournament?.timeControl || '5+0',
      initialTimeSeconds: tournament?.initialTimeSeconds || 300,
      incrementSeconds: tournament?.incrementSeconds || 0,
      status: match.status,
      result: match.result,
      reason: match.reason,
      winnerId: match.winnerId,
      currentFen: match.currentFen,
      pgn: match.pgn,
      whitePlayer: whiteUser,
      blackPlayer: blackUser,
      whiteTimeRemainingMs: match.whiteTimeRemainingMs,
      blackTimeRemainingMs: match.blackTimeRemainingMs,
      activeTurn: match.activeTurn,
      lastTurnStartTime: match.lastTurnStartTime,
      userRole: isWhite ? 'white' : isBlack ? 'black' : 'coach',
      createdAt: match.createdAt,
      endedAt: match.endedAt,
    };
  }

  async getMatchMoves(matchId: string) {
    return this.db
      .select()
      .from(schema.matchMoves)
      .where(eq(schema.matchMoves.matchId, matchId))
      .orderBy(asc(schema.matchMoves.ply));
  }

  async makeMove(userId: string, role: string, payload: MovePayload) {
    if (role === 'COACH') {
      throw new ForbiddenException('Coaches/observers cannot make moves in matches');
    }

    return this.runWithMatchLock(payload.matchId, async () => {
      // 1. Load match
      const [match] = await this.db
        .select()
        .from(schema.matches)
        .where(eq(schema.matches.id, payload.matchId))
        .limit(1);

      if (!match) {
        throw new NotFoundException(`Match "${payload.matchId}" not found`);
      }

      // 2. Verify in_progress
      if (match.status !== 'in_progress') {
        throw new BadRequestException(
          `Cannot make a move: Match is already ${match.status} (${match.reason || match.result})`,
        );
      }

      // 3. Verify user is participant
      const isWhite = match.whitePlayerId === userId;
      const isBlack = match.blackPlayerId === userId;

      if (!isWhite && !isBlack) {
        throw new ForbiddenException('You are not a player in this match');
      }

      // 4. Verify turn
      if (match.activeTurn === 'w' && !isWhite) {
        throw new BadRequestException('Not your turn: Player White to move');
      }
      if (match.activeTurn === 'b' && !isBlack) {
        throw new BadRequestException('Not your turn: Player Black to move');
      }

      // 5. Calculate elapsed time from lastTurnStartTime
      const now = new Date();
      const turnStart = match.lastTurnStartTime ? new Date(match.lastTurnStartTime).getTime() : now.getTime();
      const elapsedMs = Math.max(0, now.getTime() - turnStart);

      let whiteTime = match.whiteTimeRemainingMs;
      let blackTime = match.blackTimeRemainingMs;

      if (match.activeTurn === 'w') {
        whiteTime = Math.max(0, whiteTime - elapsedMs);
        if (whiteTime <= 0) {
          // White ran out of time
          return await this.handleTimeoutInternal(match.id, now);
        }
      } else {
        blackTime = Math.max(0, blackTime - elapsedMs);
        if (blackTime <= 0) {
          // Black ran out of time
          return await this.handleTimeoutInternal(match.id, now);
        }
      }

      // 6. Validate move using server-authoritative chess.js instance
      const chess = new Chess(match.currentFen);
      let moveResult: any;

      try {
        moveResult = chess.move({
          from: payload.from.toLowerCase(),
          to: payload.to.toLowerCase(),
          promotion: payload.promotion ? payload.promotion.toLowerCase() : undefined,
        });
      } catch (err: any) {
        throw new BadRequestException(`Illegal move: ${err.message || 'invalid move'}`);
      }

      if (!moveResult) {
        throw new BadRequestException('Illegal move: Move is not valid according to chess rules');
      }

      // 7. Apply increment from tournament configuration
      const [tournament] = await this.db
        .select()
        .from(schema.tournaments)
        .where(eq(schema.tournaments.id, match.tournamentId))
        .limit(1);

      const incrementMs = (tournament?.incrementSeconds || 0) * 1000;
      if (match.activeTurn === 'w') {
        whiteTime += incrementMs;
      } else {
        blackTime += incrementMs;
      }

      // 8. Generate updated FEN, PGN, and next active turn
      const newFen = chess.fen();
      const newPgn = chess.pgn();
      const nextTurn = chess.turn(); // 'w' or 'b'

      // 9. Determine game ending condition
      let status: 'in_progress' | 'completed' = 'in_progress';
      let result: 'white_win' | 'black_win' | 'draw' | null = null;
      let reason: 'checkmate' | 'stalemate' | null = null;
      let winnerId: string | null = null;

      if (chess.isCheckmate()) {
        status = 'completed';
        reason = 'checkmate';
        if (match.activeTurn === 'w') {
          result = 'white_win';
          winnerId = match.whitePlayerId;
        } else {
          result = 'black_win';
          winnerId = match.blackPlayerId;
        }
      } else if (chess.isStalemate() || chess.isDraw()) {
        status = 'completed';
        reason = 'stalemate';
        result = 'draw';
        winnerId = null;
      }

      // 10. Persist into DB inside a transaction (move history + match state)
      const [updatedMatch, newMoveRecord] = await this.db.transaction(async (tx) => {
        const existingMoves = await tx
          .select({ count: sql<number>`count(*)` })
          .from(schema.matchMoves)
          .where(eq(schema.matchMoves.matchId, match.id));

        const ply = Number(existingMoves[0]?.count || 0) + 1;

        const [insertedMove] = await tx
          .insert(schema.matchMoves)
          .values({
            matchId: match.id,
            ply,
            moveNotation: moveResult.san,
            fromSquare: payload.from.toLowerCase(),
            toSquare: payload.to.toLowerCase(),
            promotion: payload.promotion ? payload.promotion.toLowerCase() : null,
            fenAfter: newFen,
            whiteTimeMs: whiteTime,
            blackTimeMs: blackTime,
            createdAt: now,
          })
          .returning();

        const [updated] = await tx
          .update(schema.matches)
          .set({
            currentFen: newFen,
            pgn: newPgn,
            whiteTimeRemainingMs: whiteTime,
            blackTimeRemainingMs: blackTime,
            activeTurn: nextTurn,
            lastTurnStartTime: now,
            status,
            result,
            reason,
            winnerId,
            endedAt: status === 'completed' ? now : null,
          })
          .where(eq(schema.matches.id, match.id))
          .returning();

        return [updated, insertedMove];
      });

      // 11. Update timeout scheduling
      if (status === 'completed') {
        this.clearMatchTimer(match.id);
      } else {
        const remainingForNext = nextTurn === 'w' ? whiteTime : blackTime;
        this.scheduleTimeout(match.id, nextTurn as 'w' | 'b', remainingForNext);
      }

      return {
        matchId: updatedMatch.id,
        move: {
          from: payload.from.toLowerCase(),
          to: payload.to.toLowerCase(),
          promotion: payload.promotion ? payload.promotion.toLowerCase() : null,
          san: moveResult.san,
          ply: newMoveRecord.ply,
        },
        fen: updatedMatch.currentFen,
        pgn: updatedMatch.pgn,
        whiteTimeRemainingMs: updatedMatch.whiteTimeRemainingMs,
        blackTimeRemainingMs: updatedMatch.blackTimeRemainingMs,
        activeTurn: updatedMatch.activeTurn,
        lastTurnStartTime: updatedMatch.lastTurnStartTime,
        status: updatedMatch.status,
        result: updatedMatch.result,
        reason: updatedMatch.reason,
        winnerId: updatedMatch.winnerId,
        endedAt: updatedMatch.endedAt,
      };
    });
  }

  async resignMatch(userId: string, role: string, matchId: string) {
    if (role === 'COACH') {
      throw new ForbiddenException('Coaches/observers cannot resign a match');
    }

    return this.runWithMatchLock(matchId, async () => {
      const [match] = await this.db
        .select()
        .from(schema.matches)
        .where(eq(schema.matches.id, matchId))
        .limit(1);

      if (!match) {
        throw new NotFoundException(`Match "${matchId}" not found`);
      }

      if (match.status !== 'in_progress') {
        throw new BadRequestException(`Cannot resign: Match is already ${match.status}`);
      }

      const isWhite = match.whitePlayerId === userId;
      const isBlack = match.blackPlayerId === userId;

      if (!isWhite && !isBlack) {
        throw new ForbiddenException('You are not a player in this match');
      }

      const now = new Date();
      const result: 'white_win' | 'black_win' = isWhite ? 'black_win' : 'white_win';
      const winnerId = isWhite ? match.blackPlayerId : match.whitePlayerId;

      const [updated] = await this.db
        .update(schema.matches)
        .set({
          status: 'completed',
          result,
          reason: 'resignation',
          winnerId,
          endedAt: now,
        })
        .where(eq(schema.matches.id, match.id))
        .returning();

      this.clearMatchTimer(matchId);

      const payload: MatchStateNotification = {
        matchId: updated.id,
        fen: updated.currentFen,
        pgn: updated.pgn,
        whiteTimeRemainingMs: updated.whiteTimeRemainingMs,
        blackTimeRemainingMs: updated.blackTimeRemainingMs,
        activeTurn: updated.activeTurn,
        status: updated.status,
        result: updated.result,
        reason: updated.reason,
        winnerId: updated.winnerId,
        endedAt: updated.endedAt,
      };

      if (this.onMatchEndedHandler) {
        this.onMatchEndedHandler(payload);
      }

      return payload;
    });
  }

  async handleTimeoutInternal(matchId: string, now: Date): Promise<MatchStateNotification> {
    const [match] = await this.db
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .limit(1);

    if (!match) {
      throw new NotFoundException(`Match "${matchId}" not found`);
    }

    if (match.status !== 'in_progress') {
      return {
        matchId: match.id,
        fen: match.currentFen,
        pgn: match.pgn,
        whiteTimeRemainingMs: match.whiteTimeRemainingMs,
        blackTimeRemainingMs: match.blackTimeRemainingMs,
        activeTurn: match.activeTurn,
        status: match.status,
        result: match.result,
        reason: match.reason,
        winnerId: match.winnerId,
        endedAt: match.endedAt,
      };
    }

    const isWhiteTimeout = match.activeTurn === 'w';
    const result: 'white_win' | 'black_win' = isWhiteTimeout ? 'black_win' : 'white_win';
    const winnerId = isWhiteTimeout ? match.blackPlayerId : match.whitePlayerId;
    const whiteTime = isWhiteTimeout ? 0 : match.whiteTimeRemainingMs;
    const blackTime = !isWhiteTimeout ? 0 : match.blackTimeRemainingMs;

    const [updated] = await this.db
      .update(schema.matches)
      .set({
        status: 'completed',
        result,
        reason: 'timeout',
        winnerId,
        whiteTimeRemainingMs: whiteTime,
        blackTimeRemainingMs: blackTime,
        endedAt: now,
      })
      .where(eq(schema.matches.id, match.id))
      .returning();

    this.clearMatchTimer(matchId);

    const payload: MatchStateNotification = {
      matchId: updated.id,
      fen: updated.currentFen,
      pgn: updated.pgn,
      whiteTimeRemainingMs: updated.whiteTimeRemainingMs,
      blackTimeRemainingMs: updated.blackTimeRemainingMs,
      activeTurn: updated.activeTurn,
      status: updated.status,
      result: updated.result,
      reason: updated.reason,
      winnerId: updated.winnerId,
      endedAt: updated.endedAt,
    };

    if (this.onMatchEndedHandler) {
      this.onMatchEndedHandler(payload);
    }

    return payload;
  }

  ensureMatchTimer(match: schema.Match) {
    if (match.status !== 'in_progress') {
      this.clearMatchTimer(match.id);
      return;
    }

    if (this.matchTimers.has(match.id)) {
      return;
    }

    const now = Date.now();
    const turnStart = match.lastTurnStartTime ? new Date(match.lastTurnStartTime).getTime() : now;
    const elapsed = Math.max(0, now - turnStart);

    const isWhite = match.activeTurn === 'w';
    const currentRemaining = isWhite
      ? Math.max(0, match.whiteTimeRemainingMs - elapsed)
      : Math.max(0, match.blackTimeRemainingMs - elapsed);

    this.scheduleTimeout(match.id, match.activeTurn as 'w' | 'b', currentRemaining);
  }

  scheduleTimeout(matchId: string, turn: 'w' | 'b', remainingMs: number) {
    this.clearMatchTimer(matchId);

    if (remainingMs <= 0) {
      this.runWithMatchLock(matchId, async () => {
        await this.handleTimeoutInternal(matchId, new Date());
      });
      return;
    }

    const timer = setTimeout(async () => {
      await this.runWithMatchLock(matchId, async () => {
        await this.handleTimeoutInternal(matchId, new Date());
      });
    }, remainingMs);

    this.matchTimers.set(matchId, timer);
  }

  clearMatchTimer(matchId: string) {
    const timer = this.matchTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.matchTimers.delete(matchId);
    }
  }
}
