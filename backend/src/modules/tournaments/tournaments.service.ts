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
    let query;
    if (role === 'COACH') {
      query = await this.db
        .select()
        .from(schema.tournaments)
        .orderBy(desc(schema.tournaments.createdAt));
    } else {
      // Students can browse open, ongoing, and completed tournaments (never draft)
      query = await this.db
        .select()
        .from(schema.tournaments)
        .where(inArray(schema.tournaments.status, ['open', 'ongoing', 'completed']))
        .orderBy(desc(schema.tournaments.createdAt));
    }

    // Attach participant counts and enrollment status
    const tournamentsWithStats = await Promise.all(
      query.map(async (t) => {
        const participants = await this.db
          .select({
            id: schema.tournamentParticipants.id,
            userId: schema.tournamentParticipants.userId,
          })
          .from(schema.tournamentParticipants)
          .where(eq(schema.tournamentParticipants.tournamentId, t.id));

        const isEnrolled = participants.some((p) => p.userId === userId);

        return {
          ...t,
          participantsCount: participants.length,
          isEnrolled,
        };
      }),
    );

    return tournamentsWithStats;
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
}
