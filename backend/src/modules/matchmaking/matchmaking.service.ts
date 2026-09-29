import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, or, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDb } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface WaitingPlayer {
  userId: string;
  socketId?: string;
  joinedAt: Date;
}

export interface MatchMatchedNotification {
  matchId: string;
  tournamentId: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whitePayload: {
    matchId: string;
    tournamentId: string;
    color: 'w';
    opponent: { id: string; name: string; email: string };
    timeControl: string;
    initialTimeMs: number;
    fen: string;
  };
  blackPayload: {
    matchId: string;
    tournamentId: string;
    color: 'b';
    opponent: { id: string; name: string; email: string };
    timeControl: string;
    initialTimeMs: number;
    fen: string;
  };
}

@Injectable()
export class MatchmakingService {
  // In-memory waiting pools per tournament: Map<tournamentId, WaitingPlayer[]>
  private queues = new Map<string, WaitingPlayer[]>();

  // Mutex per tournament to serialize concurrent queue actions
  private tournamentLocks = new Map<string, Promise<void>>();

  // Registered notification handler
  private notifyMatchedHandler?: (notification: MatchMatchedNotification) => void;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  onMatchNotification(handler: (notification: MatchMatchedNotification) => void) {
    this.notifyMatchedHandler = handler;
  }

  private async runWithLock<T>(tournamentId: string, fn: () => Promise<T>): Promise<T> {
    const prevLock = this.tournamentLocks.get(tournamentId) || Promise.resolve();
    let release: () => void;
    const currentLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.tournamentLocks.set(tournamentId, currentLock);

    try {
      await prevLock;
      return await fn();
    } finally {
      release!();
      if (this.tournamentLocks.get(tournamentId) === currentLock) {
        this.tournamentLocks.delete(tournamentId);
      }
    }
  }

  async hasActiveMatch(userId: string): Promise<boolean> {
    const [active] = await this.db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(
        and(
          or(
            eq(schema.matches.whitePlayerId, userId),
            eq(schema.matches.blackPlayerId, userId),
          ),
          eq(schema.matches.status, 'in_progress'),
        ),
      )
      .limit(1);

    return !!active;
  }

  async joinQueue(
    user: { sub: string; role: string; email: string; name: string },
    tournamentId: string,
    socketId?: string,
  ) {
    // 1. Role validation
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can enter the matchmaking queue');
    }

    return this.runWithLock(tournamentId, async () => {
      // 2. Validate tournament exists
      const [tournament] = await this.db
        .select()
        .from(schema.tournaments)
        .where(eq(schema.tournaments.id, tournamentId))
        .limit(1);

      if (!tournament) {
        throw new NotFoundException(`Tournament with ID "${tournamentId}" not found`);
      }

      // 3. Validate eligible tournament status
      if (tournament.status !== 'open' && tournament.status !== 'ongoing') {
        throw new BadRequestException(
          `Cannot enter queue: Tournament status is "${tournament.status}". Matchmaking requires an open or ongoing tournament.`,
        );
      }

      // 4. Validate student is enrolled in this tournament
      const [enrollment] = await this.db
        .select({ id: schema.tournamentParticipants.id })
        .from(schema.tournamentParticipants)
        .where(
          and(
            eq(schema.tournamentParticipants.tournamentId, tournamentId),
            eq(schema.tournamentParticipants.userId, user.sub),
          ),
        )
        .limit(1);

      if (!enrollment) {
        throw new ForbiddenException('You must be registered in this tournament to find an opponent');
      }

      // 5. Concurrency check: Validate player is not already in an active match
      const inActiveMatch = await this.hasActiveMatch(user.sub);
      if (inActiveMatch) {
        throw new ConflictException(
          'Cannot enter matchmaking: You are currently playing an active match.',
        );
      }

      // 6. Check if already queued in this tournament
      let queue = this.queues.get(tournamentId);
      if (!queue) {
        queue = [];
        this.queues.set(tournamentId, queue);
      }

      const alreadyQueued = queue.some((p) => p.userId === user.sub);
      if (alreadyQueued) {
        throw new ConflictException('You are already waiting in the matchmaking queue');
      }

      // 7. Add to queue
      queue.push({
        userId: user.sub,
        socketId,
        joinedAt: new Date(),
      });

      console.log(
        `[Matchmaking] Player ${user.email} (${user.sub}) queued for tournament ${tournamentId}. Queue size: ${queue.length}`,
      );

      // 8. Trigger pairing if queue has at least 2 players
      let pairedMatch: schema.Match | null = null;
      if (queue.length >= 2) {
        pairedMatch = await this.pairPlayers(tournament, queue);
      }

      const isUserPaired = Boolean(
        pairedMatch &&
        (pairedMatch.whitePlayerId === user.sub || pairedMatch.blackPlayerId === user.sub),
      );

      return {
        inQueue: !isUserPaired && queue.some((p) => p.userId === user.sub),
        tournamentId,
        queueSize: queue.length,
        matchId: isUserPaired ? pairedMatch!.id : null,
      };
    });
  }

  private async pairPlayers(
    tournament: schema.Tournament,
    queue: WaitingPlayer[],
  ): Promise<schema.Match | null> {
    if (queue.length < 2) return null;

    const p1 = queue.shift()!;
    const p2 = queue.shift()!;

    // Pre-flight check: Re-verify active match state in DB before creating match
    const p1Active = await this.hasActiveMatch(p1.userId);
    const p2Active = await this.hasActiveMatch(p2.userId);

    if (p1Active) {
      console.warn(`[Matchmaking] Dropping double-booked player ${p1.userId} from queue`);
      if (!p2Active) queue.unshift(p2); // return p2 to queue
      return null;
    }

    if (p2Active) {
      console.warn(`[Matchmaking] Dropping double-booked player ${p2.userId} from queue`);
      queue.unshift(p1); // return p1 to queue
      return null;
    }

    // Fair/random color assignment
    const isP1White = Math.random() < 0.5;
    const whiteId = isP1White ? p1.userId : p2.userId;
    const blackId = isP1White ? p2.userId : p1.userId;

    const initialTimeMs = (tournament.initialTimeSeconds || 300) * 1000;

    // Database transactional creation
    const match = await this.db.transaction(async (tx) => {
      // Re-verify inside transaction to guarantee atomic correctness
      const conflicts = await tx
        .select({ id: schema.matches.id })
        .from(schema.matches)
        .where(
          and(
            or(
              inArray(schema.matches.whitePlayerId, [whiteId, blackId]),
              inArray(schema.matches.blackPlayerId, [whiteId, blackId]),
            ),
            eq(schema.matches.status, 'in_progress'),
          ),
        )
        .limit(1);

      if (conflicts.length > 0) {
        throw new ConflictException('Concurrency collision: One of the players is already in an active match.');
      }

      const [newMatch] = await tx
        .insert(schema.matches)
        .values({
          tournamentId: tournament.id,
          whitePlayerId: whiteId,
          blackPlayerId: blackId,
          status: 'in_progress',
          currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          pgn: '',
          whiteTimeRemainingMs: initialTimeMs,
          blackTimeRemainingMs: initialTimeMs,
          activeTurn: 'w',
          lastTurnStartTime: new Date(),
        })
        .returning();

      return newMatch;
    });

    // Fetch user profiles for White and Black
    const [whiteUser] = await this.db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, whiteId))
      .limit(1);

    const [blackUser] = await this.db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, blackId))
      .limit(1);

    console.log(
      `[Matchmaking] Successfully paired match ${match.id} (White: ${whiteUser.name} vs Black: ${blackUser.name}) in tournament ${tournament.id}`,
    );

    // Notify via callback
    if (this.notifyMatchedHandler) {
      this.notifyMatchedHandler({
        matchId: match.id,
        tournamentId: tournament.id,
        whitePlayerId: whiteId,
        blackPlayerId: blackId,
        whitePayload: {
          matchId: match.id,
          tournamentId: tournament.id,
          color: 'w',
          opponent: blackUser,
          timeControl: tournament.timeControl,
          initialTimeMs,
          fen: match.currentFen,
        },
        blackPayload: {
          matchId: match.id,
          tournamentId: tournament.id,
          color: 'b',
          opponent: whiteUser,
          timeControl: tournament.timeControl,
          initialTimeMs,
          fen: match.currentFen,
        },
      });
    }

    return match;
  }

  async leaveQueue(userId: string, tournamentId: string) {
    return this.runWithLock(tournamentId, async () => {
      const queue = this.queues.get(tournamentId);
      if (!queue) {
        return { inQueue: false, tournamentId };
      }

      const initialLength = queue.length;
      const updatedQueue = queue.filter((p) => p.userId !== userId);
      this.queues.set(tournamentId, updatedQueue);

      console.log(
        `[Matchmaking] User ${userId} left queue for tournament ${tournamentId} (was ${initialLength}, now ${updatedQueue.length})`,
      );

      return { inQueue: false, tournamentId, queueSize: updatedQueue.length };
    });
  }

  getQueueStatus(userId: string, tournamentId: string) {
    const queue = this.queues.get(tournamentId) || [];
    const inQueue = queue.some((p) => p.userId === userId);
    return {
      inQueue,
      tournamentId,
      queueSize: queue.length,
    };
  }

  // Helper method for tests to directly inspect queue size
  getQueueLength(tournamentId: string): number {
    return this.queues.get(tournamentId)?.length || 0;
  }

  // Helper method to clear queue in tests
  clearQueue(tournamentId: string) {
    this.queues.delete(tournamentId);
  }
}
