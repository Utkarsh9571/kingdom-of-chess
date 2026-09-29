import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MatchmakingService, MatchMatchedNotification } from './matchmaking.service';
import { EventsGateway } from '../gateway/events.gateway';
import { MatchesService } from '../matches/matches.service';
import { AuthService } from '../auth/auth.service';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

describe('Matchmaking & Concurrency Suite', () => {
  let service: MatchmakingService;
  let gateway: EventsGateway;

  const tournamentId = 'tourn-1111';
  const student1 = { sub: 'student-1', role: 'STUDENT', email: 's1@kingdom.com', name: 'Student One' };
  const student2 = { sub: 'student-2', role: 'STUDENT', email: 's2@kingdom.com', name: 'Student Two' };
  const student3 = { sub: 'student-3', role: 'STUDENT', email: 's3@kingdom.com', name: 'Student Three' };
  const coachUser = { sub: 'coach-1', role: 'COACH', email: 'coach@kingdom.com', name: 'Coach Garry' };

  let activeMatches: any[] = [];
  let tournamentParticipants: any[] = [];

  const mockTournament = {
    id: tournamentId,
    name: 'Arena 2026',
    timeControl: '5+0',
    initialTimeSeconds: 300,
    incrementSeconds: 0,
    status: 'open',
  };

  const mockUsers = [
    { id: student1.sub, name: student1.name, email: student1.email },
    { id: student2.sub, name: student2.name, email: student2.email },
    { id: student3.sub, name: student3.name, email: student3.email },
  ];

  let mockDb: any;

  beforeEach(async () => {
    activeMatches = [];
    tournamentParticipants = [
      { tournamentId, userId: student1.sub },
      { tournamentId, userId: student2.sub },
      { tournamentId, userId: student3.sub },
    ];

    mockDb = {
      select: jest.fn((fields?: any) => ({
        from: jest.fn((table: any) => ({
          where: jest.fn((condition: any) => ({
            limit: jest.fn((num: number) => {
              if (table === schema.tournaments) {
                return [mockTournament];
              }
              if (table === schema.matches) {
                return activeMatches;
              }
              if (table === schema.tournamentParticipants) {
                return tournamentParticipants;
              }
              if (table === schema.users) {
                return [mockUsers[0]];
              }
              return [];
            }),
          })),
        })),
      })),
      transaction: jest.fn(async (cb: any) => {
        const txMock = {
          select: jest.fn(() => ({
            from: jest.fn((table: any) => ({
              where: jest.fn(() => ({
                limit: jest.fn(() => activeMatches),
              })),
            })),
          })),
          insert: jest.fn(() => ({
            values: jest.fn((vals: any) => ({
              returning: jest.fn(() => {
                const match = { id: `match-${Date.now()}`, ...vals };
                activeMatches.push(match);
                return [match];
              }),
            })),
          })),
        };
        return cb(txMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        EventsGateway,
        {
          provide: AuthService,
          useValue: { verifyToken: jest.fn() },
        },
        {
          provide: MatchesService,
          useValue: {
            onMatchEnded: jest.fn(),
            ensureMatchTimer: jest.fn(),
            makeMove: jest.fn(),
            resignMatch: jest.fn(),
          },
        },
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<MatchmakingService>(MatchmakingService);
    gateway = module.get<EventsGateway>(EventsGateway);
    service.clearQueue(tournamentId);

    jest.spyOn(service, 'hasActiveMatch').mockImplementation(async (userId: string) => {
      return activeMatches.some(
        (m) =>
          (m.whitePlayerId === userId || m.blackPlayerId === userId) &&
          m.status === 'in_progress',
      );
    });
  });

  afterEach(() => {
    service.clearQueue(tournamentId);
  });

  describe('1. One player queues', () => {
    it('should add player to queue and report waiting state', async () => {
      const res = await service.joinQueue(student1, tournamentId);
      expect(res.inQueue).toBe(true);
      expect(res.queueSize).toBe(1);
      expect(res.matchId).toBeNull();
    });
  });

  describe('2. Two players pair', () => {
    it('should automatically create a match and notify both players', async () => {
      let notificationReceived: MatchMatchedNotification | null = null;
      service.onMatchNotification((notif) => {
        notificationReceived = notif;
      });

      await service.joinQueue(student1, tournamentId);
      const res2 = await service.joinQueue(student2, tournamentId);

      expect(res2.matchId).toBeDefined();
      expect(notificationReceived).not.toBeNull();
      expect(notificationReceived!.whitePlayerId).toBeDefined();
      expect(notificationReceived!.blackPlayerId).toBeDefined();
      expect(service.getQueueLength(tournamentId)).toBe(0);
    });
  });

  describe('3. Three players leave one waiting', () => {
    it('should pair first two and leave the third player in queue', async () => {
      await service.joinQueue(student1, tournamentId);
      await service.joinQueue(student2, tournamentId);
      const res3 = await service.joinQueue(student3, tournamentId);

      expect(res3.inQueue).toBe(true);
      expect(res3.queueSize).toBe(1);
      expect(service.getQueueLength(tournamentId)).toBe(1);
    });
  });

  describe('4. Duplicate queue request', () => {
    it('should reject player queueing twice with ConflictException', async () => {
      await service.joinQueue(student1, tournamentId);
      await expect(service.joinQueue(student1, tournamentId)).rejects.toThrow(ConflictException);
    });
  });

  describe('5. Player already in active match', () => {
    it('should reject queue entry if player is already playing a match', async () => {
      jest.spyOn(service, 'hasActiveMatch').mockResolvedValue(true);

      await expect(service.joinQueue(student1, tournamentId)).rejects.toThrow(ConflictException);
    });
  });

  describe('6. Concurrent queue requests', () => {
    it('should handle simultaneous queue joins safely without corrupted state', async () => {
      const results = await Promise.all([
        service.joinQueue(student1, tournamentId),
        service.joinQueue(student2, tournamentId),
      ]);

      // Exactly one pair created
      expect(service.getQueueLength(tournamentId)).toBe(0);
      const matched = results.some((r) => r.matchId !== null);
      expect(matched).toBe(true);
    });
  });

  describe('7. Unauthorized tournament', () => {
    it('should reject student not enrolled in tournament', async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn((table: any) => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => {
              if (table === schema.tournaments) return [mockTournament];
              if (table === schema.tournamentParticipants) return []; // enrollment not found
              return [];
            }),
          })),
        })),
      }));

      await expect(service.joinQueue(student1, tournamentId)).rejects.toThrow(ForbiddenException);
    });

    it('should reject queueing for draft or completed tournament', async () => {
      mockDb.select = jest.fn(() => ({
        from: jest.fn((table: any) => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => {
              if (table === schema.tournaments) return [{ ...mockTournament, status: 'completed' }];
              return [];
            }),
          })),
        })),
      }));

      await expect(service.joinQueue(student1, tournamentId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('8. Unauthorized match-room access', () => {
    it('should reject third-party student trying to access private match room', async () => {
      const mockClient: any = {
        data: { user: { sub: student3.sub, role: 'STUDENT' } },
        emit: jest.fn(),
        join: jest.fn(),
      };

      const mockMatch = {
        id: 'match-100',
        whitePlayerId: student1.sub,
        blackPlayerId: student2.sub,
        status: 'in_progress',
        currentFen: 'start-fen',
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn((table: any) => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => [mockMatch]),
          })),
        })),
      }));

      await gateway.handleMatchJoin(mockClient, { matchId: 'match-100' });

      expect(mockClient.emit).toHaveBeenCalledWith(
        'match:error',
        expect.objectContaining({ code: 'FORBIDDEN' }),
      );
      expect(mockClient.join).not.toHaveBeenCalled();
    });

    it('should allow legitimate White player to access match room', async () => {
      const mockClient: any = {
        data: { user: { sub: student1.sub, role: 'STUDENT' } },
        emit: jest.fn(),
        join: jest.fn(),
      };

      const mockMatch = {
        id: 'match-100',
        whitePlayerId: student1.sub,
        blackPlayerId: student2.sub,
        status: 'in_progress',
        currentFen: 'start-fen',
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => [mockMatch]),
          })),
        })),
      }));

      await gateway.handleMatchJoin(mockClient, { matchId: 'match-100' });

      expect(mockClient.join).toHaveBeenCalledWith('match:match-100');
      expect(mockClient.emit).toHaveBeenCalledWith(
        'match:joined',
        expect.objectContaining({ matchId: 'match-100', color: 'w' }),
      );
    });

    it('should allow Coach to observe match room', async () => {
      const mockClient: any = {
        data: { user: { sub: coachUser.sub, role: 'COACH' } },
        emit: jest.fn(),
        join: jest.fn(),
      };

      const mockMatch = {
        id: 'match-100',
        whitePlayerId: student1.sub,
        blackPlayerId: student2.sub,
        status: 'in_progress',
        currentFen: 'start-fen',
      };

      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => [mockMatch]),
          })),
        })),
      }));

      await gateway.handleMatchJoin(mockClient, { matchId: 'match-100' });

      expect(mockClient.join).toHaveBeenCalledWith('match:match-100');
      expect(mockClient.emit).toHaveBeenCalledWith(
        'match:joined',
        expect.objectContaining({ matchId: 'match-100', color: 'observer' }),
      );
    });
  });
});
