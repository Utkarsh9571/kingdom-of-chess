import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../../database/database.module';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('Tournaments & Participation Suite', () => {
  let service: TournamentsService;
  let controller: TournamentsController;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const coachId = 'coach-uuid-1111';
  const studentId = 'student-uuid-2222';
  const tournamentId = 'tourn-uuid-3333';

  // In-memory mock store for deterministic unit testing
  let mockTournaments: any[] = [];
  let mockParticipants: any[] = [];

  const createMockDb = () => ({
    insert: jest.fn((table: any) => ({
      values: jest.fn((data: any) => ({
        returning: jest.fn(() => {
          const item = {
            id: tournamentId,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            joinedAt: new Date(),
          };
          if (data.tournamentId) {
            mockParticipants.push(item);
          } else {
            mockTournaments.push(item);
          }
          return [item];
        }),
      })),
    })),
    select: jest.fn((fields?: any) => ({
      from: jest.fn((table: any) => ({
        where: jest.fn((condition: any) => ({
          limit: jest.fn((num: number) => {
            // Find by ID or check enrollment
            return mockTournaments.filter((t) => t.id === tournamentId);
          }),
          orderBy: jest.fn(() => mockTournaments),
          innerJoin: jest.fn(() => ({
            where: jest.fn(() => mockParticipants),
          })),
        })),
        orderBy: jest.fn(() => mockTournaments),
      })),
    })),
    update: jest.fn((table: any) => ({
      set: jest.fn((data: any) => ({
        where: jest.fn((condition: any) => ({
          returning: jest.fn(() => {
            const idx = mockTournaments.findIndex((t) => t.id === tournamentId);
            if (idx >= 0) {
              mockTournaments[idx] = { ...mockTournaments[idx], ...data };
              return [mockTournaments[idx]];
            }
            return [];
          }),
        })),
      })),
    })),
    delete: jest.fn((table: any) => ({
      where: jest.fn((condition: any) => {
        mockTournaments = mockTournaments.filter((t) => t.id !== tournamentId);
        return Promise.resolve();
      }),
    })),
  });

  let mockDb: any;

  beforeEach(async () => {
    mockDb = createMockDb();
    mockTournaments = [
      {
        id: tournamentId,
        name: 'Kingdom Championship 2026',
        timeControl: '5+0',
        initialTimeSeconds: 300,
        incrementSeconds: 0,
        startDate: new Date('2026-10-01'),
        status: 'open',
        createdById: coachId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockParticipants = [];

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentsController],
      providers: [
        TournamentsService,
        RolesGuard,
        JwtAuthGuard,
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => 'test_jwt_secret'),
          },
        },
        Reflector,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
    controller = module.get<TournamentsController>(TournamentsController);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('1. Coach Tournament CRUD Operations', () => {
    it('should create a tournament with parsed time control', async () => {
      const result = await service.create(
        {
          name: 'Blitz Arena',
          timeControl: '3+2',
          startDate: '2026-10-05T12:00:00Z',
          status: 'open',
        },
        coachId,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Blitz Arena');
      expect(result.initialTimeSeconds).toBe(180);
      expect(result.incrementSeconds).toBe(2);
      expect(result.createdById).toBe(coachId);
    });

    it('should update tournament details', async () => {
      const updated = await service.update(
        tournamentId,
        {
          name: 'Updated Championship',
          status: 'ongoing',
        },
        coachId,
      );

      expect(updated.name).toBe('Updated Championship');
      expect(updated.status).toBe('ongoing');
    });

    it('should delete a tournament', async () => {
      const res = await service.delete(tournamentId, coachId);
      expect(res.message).toBe('Tournament deleted successfully');
      expect(mockTournaments.length).toBe(0);
    });
  });

  describe('2. Student Tournament Participation & Eligibility', () => {
    it('should allow student to join an open tournament', async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => [{ ...mockTournaments[0], status: 'open' }]),
          })),
        })),
      }));

      // Mock first select for tournament find, second for duplicate check (empty)
      let callCount = 0;
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => {
              callCount++;
              if (callCount === 1) return [{ ...mockTournaments[0], status: 'open' }];
              return []; // not yet enrolled
            }),
          })),
        })),
      }));

      const joinResult = await service.joinTournament(tournamentId, studentId);
      expect(joinResult.message).toBe('Successfully joined tournament');
      expect(joinResult.userId).toBe(studentId);
    });

    it('should reject join when tournament is NOT open (draft / ongoing / completed)', async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => [{ ...mockTournaments[0], status: 'draft' }]),
          })),
        })),
      }));

      await expect(service.joinTournament(tournamentId, studentId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject duplicate join with ConflictException', async () => {
      let callCount = 0;
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => {
              callCount++;
              if (callCount === 1) return [{ ...mockTournaments[0], status: 'open' }];
              return [{ id: 'p1', tournamentId, userId: studentId }]; // already enrolled!
            }),
          })),
        })),
      }));

      await expect(service.joinTournament(tournamentId, studentId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('3. Role-Based Authorization on TournamentsController', () => {
    it('should require COACH role for tournament creation', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.create);
      expect(roles).toEqual(['COACH']);
    });

    it('should require COACH role for tournament update', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.update);
      expect(roles).toEqual(['COACH']);
    });

    it('should require COACH role for tournament delete', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.delete);
      expect(roles).toEqual(['COACH']);
    });

    it('should require STUDENT role for tournament join', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.join);
      expect(roles).toEqual(['STUDENT']);
    });

    it('should deny STUDENT from executing coach create endpoint', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['COACH']);

      const mockContext = {
        getHandler: () => controller.create,
        getClass: () => TournamentsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'STUDENT', sub: studentId } }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should deny COACH from executing student join endpoint', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['STUDENT']);

      const mockContext = {
        getHandler: () => controller.join,
        getClass: () => TournamentsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'COACH', sub: coachId } }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
