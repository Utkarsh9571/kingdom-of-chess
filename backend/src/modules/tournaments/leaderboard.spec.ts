import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

describe('TournamentsService — Dynamic Leaderboard Aggregation Suite', () => {
  let service: TournamentsService;

  const tournamentId = 'tourn-lead-123';
  const coachId = 'coach-1';
  const student1Id = 'student-1';
  const student2Id = 'student-2';
  const student3Id = 'student-3';
  const student4Id = 'student-4';
  const nonEnrolledStudentId = 'student-unauthorized';

  const mockTournament = {
    id: tournamentId,
    name: 'Kingdom Championship 2026',
    timeControl: '5+0',
    initialTimeSeconds: 300,
    incrementSeconds: 0,
    status: 'ongoing',
    createdById: coachId,
  };

  let mockParticipants: Array<{ userId: string; name: string }>;
  let mockMatches: any[];
  let enrolledUserIds: Set<string>;

  const createMockDb = () => ({
    select: jest.fn((fields?: any) => ({
      from: jest.fn((table: any) => ({
        innerJoin: jest.fn(() => ({
          where: jest.fn(() => mockParticipants),
        })),
        where: jest.fn((condition: any) => ({
          limit: jest.fn((num: number) => {
            if (table === schema.tournaments) {
              return [mockTournament];
            }
            if (table === schema.tournamentParticipants) {
              // Check enrollment
              return [];
            }
            return [];
          }),
        })),
      })),
    })),
  });

  beforeEach(async () => {
    mockParticipants = [
      { userId: student1Id, name: 'Alice' },
      { userId: student2Id, name: 'Bob' },
    ];
    mockMatches = [];
    enrolledUserIds = new Set([student1Id, student2Id]);

    const mockDb = {
      select: jest.fn((fields?: any) => ({
        from: jest.fn((table: any) => {
          if (table === schema.tournaments) {
            return {
              where: jest.fn(() => ({
                limit: jest.fn(() => [mockTournament]),
              })),
            };
          }

          if (table === schema.tournamentParticipants) {
            return {
              innerJoin: jest.fn(() => ({
                where: jest.fn(() => mockParticipants),
              })),
              where: jest.fn((cond: any) => ({
                limit: jest.fn(() => {
                  // If condition checks for an enrolled student, return a match
                  return [{ id: 'participant-row' }];
                }),
              })),
            };
          }

          if (table === schema.matches) {
            return {
              where: jest.fn(() => {
                // Filter completed matches
                return mockMatches.filter((m) => m.status === 'completed');
              }),
            };
          }

          return {
            where: jest.fn(() => ({ limit: jest.fn(() => []) })),
          };
        }),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
  });

  // 1. Tournament with zero completed matches
  it('1. Tournament with zero completed matches', async () => {
    mockMatches = [];
    const res = await service.getLeaderboard(tournamentId, student1Id, 'STUDENT');

    expect(res.tournamentId).toBe(tournamentId);
    expect(res.entries.length).toBe(2);

    expect(res.entries[0]).toEqual({
      rank: 1,
      playerId: student1Id,
      playerName: 'Alice',
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
    });
    expect(res.entries[1]).toEqual({
      rank: 1,
      playerId: student2Id,
      playerName: 'Bob',
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
    });
  });

  // 2. One white win
  it('2. One white win', async () => {
    mockMatches = [
      {
        id: 'm1',
        tournamentId,
        whitePlayerId: student1Id,
        blackPlayerId: student2Id,
        result: 'white_win',
        status: 'completed',
      },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');

    const alice = res.entries.find((e) => e.playerId === student1Id)!;
    const bob = res.entries.find((e) => e.playerId === student2Id)!;

    expect(alice.rank).toBe(1);
    expect(alice.points).toBe(1.0);
    expect(alice.wins).toBe(1);
    expect(alice.losses).toBe(0);
    expect(alice.matchesPlayed).toBe(1);

    expect(bob.rank).toBe(2);
    expect(bob.points).toBe(0);
    expect(bob.wins).toBe(0);
    expect(bob.losses).toBe(1);
    expect(bob.matchesPlayed).toBe(1);
  });

  // 3. One black win
  it('3. One black win', async () => {
    mockMatches = [
      {
        id: 'm1',
        tournamentId,
        whitePlayerId: student1Id,
        blackPlayerId: student2Id,
        result: 'black_win',
        status: 'completed',
      },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');

    const bob = res.entries.find((e) => e.playerId === student2Id)!;
    const alice = res.entries.find((e) => e.playerId === student1Id)!;

    expect(bob.rank).toBe(1);
    expect(bob.points).toBe(1.0);
    expect(bob.wins).toBe(1);

    expect(alice.rank).toBe(2);
    expect(alice.points).toBe(0);
    expect(alice.losses).toBe(1);
  });

  // 4. One draw
  it('4. One draw', async () => {
    mockMatches = [
      {
        id: 'm1',
        tournamentId,
        whitePlayerId: student1Id,
        blackPlayerId: student2Id,
        result: 'draw',
        status: 'completed',
      },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');

    expect(res.entries[0].points).toBe(0.5);
    expect(res.entries[0].draws).toBe(1);
    expect(res.entries[0].rank).toBe(1);

    expect(res.entries[1].points).toBe(0.5);
    expect(res.entries[1].draws).toBe(1);
    expect(res.entries[1].rank).toBe(1); // Shared rank 1
  });

  // 5. Multiple matches for the same player
  it('5. Multiple matches for the same player', async () => {
    mockMatches = [
      {
        id: 'm1',
        tournamentId,
        whitePlayerId: student1Id,
        blackPlayerId: student2Id,
        result: 'white_win',
        status: 'completed',
      },
      {
        id: 'm2',
        tournamentId,
        whitePlayerId: student2Id,
        blackPlayerId: student1Id,
        result: 'draw',
        status: 'completed',
      },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');

    const alice = res.entries.find((e) => e.playerId === student1Id)!;
    const bob = res.entries.find((e) => e.playerId === student2Id)!;

    // Alice: 1 win (1.0) + 1 draw (0.5) = 1.5 pts
    expect(alice.matchesPlayed).toBe(2);
    expect(alice.wins).toBe(1);
    expect(alice.draws).toBe(1);
    expect(alice.losses).toBe(0);
    expect(alice.points).toBe(1.5);

    // Bob: 1 loss (0.0) + 1 draw (0.5) = 0.5 pts
    expect(bob.matchesPlayed).toBe(2);
    expect(bob.wins).toBe(0);
    expect(bob.draws).toBe(1);
    expect(bob.losses).toBe(1);
    expect(bob.points).toBe(0.5);
  });

  // 6. Enrolled player with zero games still appears
  it('6. Enrolled player with zero games still appears', async () => {
    mockParticipants = [
      { userId: student1Id, name: 'Alice' },
      { userId: student2Id, name: 'Bob' },
      { userId: student3Id, name: 'Charlie' },
    ];

    mockMatches = [
      {
        id: 'm1',
        tournamentId,
        whitePlayerId: student1Id,
        blackPlayerId: student2Id,
        result: 'white_win',
        status: 'completed',
      },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');

    expect(res.entries.length).toBe(3);
    const charlie = res.entries.find((e) => e.playerId === student3Id)!;
    expect(charlie).toBeDefined();
    expect(charlie.matchesPlayed).toBe(0);
    expect(charlie.points).toBe(0);
  });

  // 7. In-progress match does not count
  it('7. In-progress match does not count', async () => {
    mockMatches = [
      {
        id: 'm1',
        tournamentId,
        whitePlayerId: student1Id,
        blackPlayerId: student2Id,
        result: null,
        status: 'in_progress', // should be excluded
      },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');

    expect(res.entries[0].matchesPlayed).toBe(0);
    expect(res.entries[0].points).toBe(0);
    expect(res.entries[1].matchesPlayed).toBe(0);
  });

  // 8. Aborted match does not count
  it('8. Aborted match does not count', async () => {
    mockMatches = [
      {
        id: 'm1',
        tournamentId,
        whitePlayerId: student1Id,
        blackPlayerId: student2Id,
        result: null,
        status: 'aborted', // should be excluded
      },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');

    expect(res.entries[0].matchesPlayed).toBe(0);
    expect(res.entries[1].matchesPlayed).toBe(0);
  });

  // 9. Correct points calculation
  it('9. Correct points calculation', async () => {
    mockMatches = [
      { id: 'm1', whitePlayerId: student1Id, blackPlayerId: student2Id, result: 'white_win', status: 'completed' },
      { id: 'm2', whitePlayerId: student1Id, blackPlayerId: student2Id, result: 'white_win', status: 'completed' },
      { id: 'm3', whitePlayerId: student1Id, blackPlayerId: student2Id, result: 'draw', status: 'completed' },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');
    const alice = res.entries.find((e) => e.playerId === student1Id)!;

    // 2 wins * 1.0 + 1 draw * 0.5 = 2.5
    expect(alice.points).toBe(2.5);
  });

  // 10. Correct wins/draws/losses
  it('10. Correct wins/draws/losses', async () => {
    mockMatches = [
      { id: 'm1', whitePlayerId: student1Id, blackPlayerId: student2Id, result: 'white_win', status: 'completed' },
      { id: 'm2', whitePlayerId: student1Id, blackPlayerId: student2Id, result: 'black_win', status: 'completed' },
      { id: 'm3', whitePlayerId: student1Id, blackPlayerId: student2Id, result: 'draw', status: 'completed' },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');
    const alice = res.entries.find((e) => e.playerId === student1Id)!;
    const bob = res.entries.find((e) => e.playerId === student2Id)!;

    expect(alice.wins).toBe(1);
    expect(alice.losses).toBe(1);
    expect(alice.draws).toBe(1);
    expect(alice.points).toBe(1.5);

    expect(bob.wins).toBe(1);
    expect(bob.losses).toBe(1);
    expect(bob.draws).toBe(1);
    expect(bob.points).toBe(1.5);
  });

  // 11. Deterministic tiebreak ordering
  it('11. Deterministic tiebreak ordering: points -> wins -> matches played -> name', async () => {
    mockParticipants = [
      { userId: student1Id, name: 'Zara' },
      { userId: student2Id, name: 'Adam' },
    ];

    // Zara and Adam both have 1.0 points:
    // Zara achieved 1.0 point with 1 win (1-0-0 in 1 game)
    // Adam achieved 1.0 point with 2 draws (0-2-0 in 2 games)
    mockMatches = [
      { id: 'm1', whitePlayerId: student1Id, blackPlayerId: 'other', result: 'white_win', status: 'completed' },
      { id: 'm2', whitePlayerId: student2Id, blackPlayerId: 'other', result: 'draw', status: 'completed' },
      { id: 'm3', whitePlayerId: student2Id, blackPlayerId: 'other', result: 'draw', status: 'completed' },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');

    // Zara has 1 win vs Adam's 0 wins -> Zara ranks #1 despite Adam having more games and name 'Adam'
    expect(res.entries[0].playerName).toBe('Zara');
    expect(res.entries[0].rank).toBe(1);

    expect(res.entries[1].playerName).toBe('Adam');
    expect(res.entries[1].rank).toBe(2);
  });

  // 12. Unauthorized user cannot access private tournament leaderboard
  it('12. Unauthorized user cannot access private tournament leaderboard', async () => {
    // Mock select for enrollment returning empty (not enrolled)
    const unauthorizedDb = {
      select: jest.fn(() => ({
        from: jest.fn((table: any) => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => {
              if (table === schema.tournaments) return [mockTournament];
              if (table === schema.tournamentParticipants) return []; // NOT enrolled!
              return [];
            }),
          })),
        })),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        {
          provide: DRIZZLE,
          useValue: unauthorizedDb,
        },
      ],
    }).compile();

    const unauthService = module.get<TournamentsService>(TournamentsService);

    await expect(
      unauthService.getLeaderboard(tournamentId, nonEnrolledStudentId, 'STUDENT'),
    ).rejects.toThrow(ForbiddenException);
  });

  // 13. Tournament with multiple players produces correct competition ranking (1, 2, 2, 4)
  it('13. Tournament with multiple players produces correct competition ranking (1, 2, 2, 4)', async () => {
    mockParticipants = [
      { userId: student1Id, name: 'Player A' },
      { userId: student2Id, name: 'Player B' },
      { userId: student3Id, name: 'Player C' },
      { userId: student4Id, name: 'Player D' },
    ];

    // Player A: 2 wins = 2.0 pts
    // Player B: 1 win = 1.0 pt
    // Player C: 1 win = 1.0 pt (tied with Player B on pts, wins, and matches)
    // Player D: 0 wins = 0.0 pts
    mockMatches = [
      { id: 'm1', whitePlayerId: student1Id, blackPlayerId: student4Id, result: 'white_win', status: 'completed' },
      { id: 'm2', whitePlayerId: student1Id, blackPlayerId: student4Id, result: 'white_win', status: 'completed' },
      { id: 'm3', whitePlayerId: student2Id, blackPlayerId: student4Id, result: 'white_win', status: 'completed' },
      { id: 'm4', whitePlayerId: student3Id, blackPlayerId: student4Id, result: 'white_win', status: 'completed' },
    ];

    const res = await service.getLeaderboard(tournamentId, coachId, 'COACH');

    expect(res.entries[0].playerName).toBe('Player A');
    expect(res.entries[0].rank).toBe(1);

    expect(res.entries[1].rank).toBe(2); // Player B
    expect(res.entries[2].rank).toBe(2); // Player C (shares rank 2 with Player B)

    expect(res.entries[3].playerName).toBe('Player D');
    expect(res.entries[3].rank).toBe(4); // Player D is rank 4 in 1, 2, 2, 4 competition ranking!
  });
});
