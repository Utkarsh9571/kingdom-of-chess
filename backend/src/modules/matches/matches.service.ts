import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDb } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class MatchesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

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
      userRole: isWhite ? 'white' : isBlack ? 'black' : 'coach',
      createdAt: match.createdAt,
    };
  }
}
