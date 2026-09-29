import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDb } from '../../database/database.module';
import * as schema from '../../database/schema';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

function parseTimeControl(tc: string): { initialTimeSeconds: number; incrementSeconds: number } {
  const parts = tc.split('+');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const inc = parseInt(parts[1], 10);
    if (!isNaN(mins) && !isNaN(inc)) {
      return {
        initialTimeSeconds: mins * 60,
        incrementSeconds: inc,
      };
    }
  }
  return { initialTimeSeconds: 300, incrementSeconds: 0 };
}

@Injectable()
export class TournamentsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async create(dto: CreateTournamentDto, coachId: string): Promise<schema.Tournament> {
    const parsed = parseTimeControl(dto.timeControl);
    const initialTimeSeconds = dto.initialTimeSeconds ?? parsed.initialTimeSeconds;
    const incrementSeconds = dto.incrementSeconds ?? parsed.incrementSeconds;

    const [tournament] = await this.db
      .insert(schema.tournaments)
      .values({
        name: dto.name.trim(),
        timeControl: dto.timeControl.trim(),
        initialTimeSeconds,
        incrementSeconds,
        startDate: new Date(dto.startDate),
        status: dto.status ?? 'draft',
        createdById: coachId,
      })
      .returning();

    return tournament;
  }

  async findAll(role: 'COACH' | 'STUDENT', userId: string) {
    const whereClause =
      role === 'COACH'
        ? undefined
        : inArray(schema.tournaments.status, ['open', 'ongoing', 'completed']);

    const rows = await this.db
      .select({
        id: schema.tournaments.id,
        name: schema.tournaments.name,
        timeControl: schema.tournaments.timeControl,
        initialTimeSeconds: schema.tournaments.initialTimeSeconds,
        incrementSeconds: schema.tournaments.incrementSeconds,
        startDate: schema.tournaments.startDate,
        status: schema.tournaments.status,
        winnerId: schema.tournaments.winnerId,
        createdById: schema.tournaments.createdById,
        createdAt: schema.tournaments.createdAt,
        updatedAt: schema.tournaments.updatedAt,
        participantsCount: sql<number>`count(${schema.tournamentParticipants.id})::int`,
        isEnrolled: sql<boolean>`bool_or(${schema.tournamentParticipants.userId} = ${userId})`,
      })
      .from(schema.tournaments)
      .leftJoin(
        schema.tournamentParticipants,
        eq(schema.tournaments.id, schema.tournamentParticipants.tournamentId),
      )
      .where(whereClause)
      .groupBy(schema.tournaments.id)
      .orderBy(desc(schema.tournaments.createdAt));

    return rows.map((r) => ({
      ...r,
      isEnrolled: Boolean(r.isEnrolled),
    }));
  }

  async findById(id: string, role: 'COACH' | 'STUDENT', userId: string) {
    const [tournament] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, id))
      .limit(1);

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID "${id}" not found`);
    }

    if (tournament.status === 'draft' && role !== 'COACH') {
      throw new NotFoundException(`Tournament with ID "${id}" not found`);
    }

    const participants = await this.db
      .select({
        participantId: schema.tournamentParticipants.id,
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        joinedAt: schema.tournamentParticipants.joinedAt,
      })
      .from(schema.tournamentParticipants)
      .innerJoin(schema.users, eq(schema.tournamentParticipants.userId, schema.users.id))
      .where(eq(schema.tournamentParticipants.tournamentId, id));

    const isEnrolled = participants.some((p) => p.userId === userId);

    return {
      ...tournament,
      participants,
      participantsCount: participants.length,
      isEnrolled,
    };
  }

  async update(id: string, dto: UpdateTournamentDto, coachId: string): Promise<schema.Tournament> {
    const [existing] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Tournament with ID "${id}" not found`);
    }

    const updateData: Partial<schema.NewTournament> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.timeControl !== undefined) {
      updateData.timeControl = dto.timeControl.trim();
      const parsed = parseTimeControl(dto.timeControl);
      updateData.initialTimeSeconds = dto.initialTimeSeconds ?? parsed.initialTimeSeconds;
      updateData.incrementSeconds = dto.incrementSeconds ?? parsed.incrementSeconds;
    } else {
      if (dto.initialTimeSeconds !== undefined) updateData.initialTimeSeconds = dto.initialTimeSeconds;
      if (dto.incrementSeconds !== undefined) updateData.incrementSeconds = dto.incrementSeconds;
    }
    if (dto.startDate !== undefined) updateData.startDate = new Date(dto.startDate);
    if (dto.status !== undefined) updateData.status = dto.status;

    const [updated] = await this.db
      .update(schema.tournaments)
      .set(updateData)
      .where(eq(schema.tournaments.id, id))
      .returning();

    return updated;
  }

  async delete(id: string, coachId: string) {
    const [existing] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Tournament with ID "${id}" not found`);
    }

    await this.db.delete(schema.tournaments).where(eq(schema.tournaments.id, id));

    return {
      message: 'Tournament deleted successfully',
      id,
    };
  }

  async joinTournament(tournamentId: string, studentId: string) {
    const [tournament] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, tournamentId))
      .limit(1);

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID "${tournamentId}" not found`);
    }

    // Only 'open' tournaments can be joined
    if (tournament.status !== 'open') {
      throw new BadRequestException(
        `Cannot join tournament with status "${tournament.status}". Only open tournaments accept participants.`,
      );
    }

    // Check duplicate enrollment
    const existingEnrollment = await this.db
      .select()
      .from(schema.tournamentParticipants)
      .where(
        and(
          eq(schema.tournamentParticipants.tournamentId, tournamentId),
          eq(schema.tournamentParticipants.userId, studentId),
        ),
      )
      .limit(1);

    if (existingEnrollment.length > 0) {
      throw new ConflictException('You are already registered for this tournament');
    }

    const [participant] = await this.db
      .insert(schema.tournamentParticipants)
      .values({
        tournamentId,
        userId: studentId,
      })
      .returning();

    return {
      message: 'Successfully joined tournament',
      participantId: participant.id,
      tournamentId,
      userId: studentId,
      joinedAt: participant.joinedAt,
    };
  }

  async getParticipants(tournamentId: string) {
    const participants = await this.db
      .select({
        participantId: schema.tournamentParticipants.id,
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        joinedAt: schema.tournamentParticipants.joinedAt,
      })
      .from(schema.tournamentParticipants)
      .innerJoin(schema.users, eq(schema.tournamentParticipants.userId, schema.users.id))
      .where(eq(schema.tournamentParticipants.tournamentId, tournamentId));

    return participants;
  }

  async getStudentTournaments(studentId: string) {
    const enrollments = await this.db
      .select({
        tournament: schema.tournaments,
        joinedAt: schema.tournamentParticipants.joinedAt,
      })
      .from(schema.tournamentParticipants)
      .innerJoin(schema.tournaments, eq(schema.tournamentParticipants.tournamentId, schema.tournaments.id))
      .where(eq(schema.tournamentParticipants.userId, studentId))
      .orderBy(desc(schema.tournamentParticipants.joinedAt));

    return enrollments.map((e) => ({
      ...e.tournament,
      joinedAt: e.joinedAt,
      isEnrolled: true,
    }));
  }

  async getLeaderboard(tournamentId: string, userId: string, role: string) {
    const [tournament] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, tournamentId))
      .limit(1);

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID "${tournamentId}" not found`);
    }

    // Authorization: Coach or enrolled student
    if (role === 'STUDENT') {
      const [enrollment] = await this.db
        .select({ id: schema.tournamentParticipants.id })
        .from(schema.tournamentParticipants)
        .where(
          and(
            eq(schema.tournamentParticipants.tournamentId, tournamentId),
            eq(schema.tournamentParticipants.userId, userId),
          ),
        )
        .limit(1);

      if (!enrollment) {
        throw new ForbiddenException('You must be enrolled in this tournament to view its leaderboard');
      }
    } else if (role !== 'COACH') {
      throw new ForbiddenException('Unauthorized to view this tournament leaderboard');
    }

    // 1. Fetch all enrolled participants (exclude private data such as email)
    const participants = await this.db
      .select({
        userId: schema.users.id,
        name: schema.users.name,
      })
      .from(schema.tournamentParticipants)
      .innerJoin(schema.users, eq(schema.tournamentParticipants.userId, schema.users.id))
      .where(eq(schema.tournamentParticipants.tournamentId, tournamentId));

    // 2. Fetch all completed matches for this tournament
    const completedMatches = await this.db
      .select({
        id: schema.matches.id,
        whitePlayerId: schema.matches.whitePlayerId,
        blackPlayerId: schema.matches.blackPlayerId,
        result: schema.matches.result,
        status: schema.matches.status,
      })
      .from(schema.matches)
      .where(
        and(
          eq(schema.matches.tournamentId, tournamentId),
          eq(schema.matches.status, 'completed'),
        ),
      );

    // 3. Initialize statistics map for all enrolled participants (so 0-game players are included)
    const statsMap = new Map<
      string,
      {
        playerId: string;
        playerName: string;
        matchesPlayed: number;
        wins: number;
        draws: number;
        losses: number;
        points: number;
      }
    >();

    for (const p of participants) {
      statsMap.set(p.userId, {
        playerId: p.userId,
        playerName: p.name,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
      });
    }

    // 4. Calculate results for completed matches
    for (const match of completedMatches) {
      const white = statsMap.get(match.whitePlayerId);
      const black = statsMap.get(match.blackPlayerId);

      if (white) white.matchesPlayed += 1;
      if (black) black.matchesPlayed += 1;

      if (match.result === 'white_win') {
        if (white) {
          white.wins += 1;
          white.points += 1.0;
        }
        if (black) {
          black.losses += 1;
        }
      } else if (match.result === 'black_win') {
        if (black) {
          black.wins += 1;
          black.points += 1.0;
        }
        if (white) {
          white.losses += 1;
        }
      } else if (match.result === 'draw') {
        if (white) {
          white.draws += 1;
          white.points += 0.5;
        }
        if (black) {
          black.draws += 1;
          black.points += 0.5;
        }
      }
    }

    // 5. Deterministic sorting:
    //    1. Points descending
    //    2. Wins descending
    //    3. Matches played descending
    //    4. Player name ascending
    const sorted = Array.from(statsMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
      return a.playerName.localeCompare(b.playerName);
    });

    // 6. Assign competition ranking (1, 2, 2, 4)
    const rankedEntries = [];
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      let rank = 1;
      if (i > 0) {
        const prev = sorted[i - 1];
        if (
          current.points === prev.points &&
          current.wins === prev.wins &&
          current.matchesPlayed === prev.matchesPlayed
        ) {
          rank = rankedEntries[i - 1].rank;
        } else {
          rank = i + 1;
        }
      }
      rankedEntries.push({
        rank,
        playerId: current.playerId,
        playerName: current.playerName,
        matchesPlayed: current.matchesPlayed,
        wins: current.wins,
        draws: current.draws,
        losses: current.losses,
        points: current.points,
      });
    }

    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      entries: rankedEntries,
    };
  }
}
