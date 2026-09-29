import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

describe('MatchesService — Authoritative Live Chess Game Loop Suite', () => {
  let service: MatchesService;

  const whiteUserId = 'player-white-id';
  const blackUserId = 'player-black-id';
  const observerUserId = 'player-observer-id';
  const coachUserId = 'coach-user-id';
  const matchId = 'test-match-123';
  const tournamentId = 'test-tournament-456';

  let currentMatch: any;
  let movesList: any[] = [];
  let tournamentConfig: any;

  // Flexible Mock DB that maintains in-memory state
  const createMockDb = () => ({
    select: jest.fn((fields?: any) => ({
      from: jest.fn((table: any) => ({
        where: jest.fn((cond: any) => ({
          limit: jest.fn((n: number) => {
            if (table === schema.matches) {
              return currentMatch ? [currentMatch] : [];
            }
            if (table === schema.tournaments) {
              return [tournamentConfig];
            }
            if (table === schema.matchMoves) {
              return [{ count: movesList.length }];
            }
            if (table === schema.users) {
              return [{ id: 'user-id', name: 'Test User', email: 'test@kingdom.com' }];
            }
            return [];
          }),
          orderBy: jest.fn(() => movesList),
        })),
      })),
    })),
    update: jest.fn((table: any) => ({
      set: jest.fn((vals: any) => ({
        where: jest.fn((cond: any) => ({
          returning: jest.fn(() => {
            if (table === schema.matches && currentMatch) {
              Object.assign(currentMatch, vals);
              return [currentMatch];
            }
            return [];
          }),
        })),
      })),
    })),
    insert: jest.fn((table: any) => ({
      values: jest.fn((vals: any) => ({
        returning: jest.fn(() => {
          if (table === schema.matchMoves) {
            const moveRow = { id: `move-${movesList.length + 1}`, ...vals };
            movesList.push(moveRow);
            return [moveRow];
          }
          return [vals];
        }),
      })),
    })),
    transaction: jest.fn(async (cb: any) => {
      const tx = {
        select: jest.fn((fields?: any) => ({
          from: jest.fn((table: any) => ({
            where: jest.fn(() => [{ count: movesList.length }]),
          })),
        })),
        insert: jest.fn((table: any) => ({
          values: jest.fn((vals: any) => ({
            returning: jest.fn(() => {
              const moveRow = { id: `move-${movesList.length + 1}`, ...vals };
              movesList.push(moveRow);
              return [moveRow];
            }),
          })),
        })),
        update: jest.fn((table: any) => ({
          set: jest.fn((vals: any) => ({
            where: jest.fn(() => ({
              returning: jest.fn(() => {
                if (table === schema.matches && currentMatch) {
                  Object.assign(currentMatch, vals);
                  return [currentMatch];
                }
                return [];
              }),
            })),
          })),
        })),
      };
      return cb(tx);
    }),
  });

  beforeEach(async () => {
    movesList = [];
    tournamentConfig = {
      id: tournamentId,
      name: 'Autumn Rapid 2026',
      timeControl: '5+0',
      initialTimeSeconds: 300,
      incrementSeconds: 0,
      status: 'ongoing',
    };

    currentMatch = {
      id: matchId,
      tournamentId,
      whitePlayerId: whiteUserId,
      blackPlayerId: blackUserId,
      status: 'in_progress',
      result: null,
      reason: null,
      winnerId: null,
      currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      whiteTimeRemainingMs: 300000,
      blackTimeRemainingMs: 300000,
      activeTurn: 'w',
      lastTurnStartTime: new Date(),
      createdAt: new Date(),
      endedAt: null,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: DRIZZLE,
          useValue: createMockDb(),
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  // 1. Valid White move accepted
  it('1. Valid White move accepted', async () => {
    const res = await service.makeMove(whiteUserId, 'STUDENT', {
      matchId,
      from: 'e2',
      to: 'e4',
    });

    expect(res.matchId).toBe(matchId);
    expect(res.activeTurn).toBe('b');
    expect((res as any).move.san).toBe('e4');
    expect(res.status).toBe('in_progress');
    expect(currentMatch.currentFen).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq');
  });

  // 2. Valid Black move accepted
  it('2. Valid Black move accepted', async () => {
    // White played e4
    await service.makeMove(whiteUserId, 'STUDENT', { matchId, from: 'e2', to: 'e4' });

    // Black plays e5
    const res = await service.makeMove(blackUserId, 'STUDENT', {
      matchId,
      from: 'e7',
      to: 'e5',
    });

    expect(res.activeTurn).toBe('w');
    expect((res as any).move.san).toBe('e5');
    expect(currentMatch.currentFen).toContain('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq');
  });

  // 3. Illegal move rejected
  it('3. Illegal move rejected', async () => {
    await expect(
      service.makeMove(whiteUserId, 'STUDENT', {
        matchId,
        from: 'e2',
        to: 'e5', // Pawn cannot move 3 squares
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 4. Wrong player attempting a move rejected
  it('4. Wrong player attempting a move rejected', async () => {
    await expect(
      service.makeMove(observerUserId, 'STUDENT', {
        matchId,
        from: 'e2',
        to: 'e4',
      }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.makeMove(coachUserId, 'COACH', {
        matchId,
        from: 'e2',
        to: 'e4',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // 5. Player attempting move out of turn rejected
  it('5. Player attempting move out of turn rejected', async () => {
    // Current turn is White ('w')
    await expect(
      service.makeMove(blackUserId, 'STUDENT', {
        matchId,
        from: 'e7',
        to: 'e5',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 6. FEN changes after a valid move
  it('6. FEN changes after a valid move', async () => {
    const initialFen = currentMatch.currentFen;
    const res = await service.makeMove(whiteUserId, 'STUDENT', {
      matchId,
      from: 'd2',
      to: 'd4',
    });
    expect(res.fen).not.toBe(initialFen);
    expect(currentMatch.currentFen).toBe(res.fen);
  });

  // 7. PGN changes after a valid move
  it('7. PGN changes after a valid move', async () => {
    const res = await service.makeMove(whiteUserId, 'STUDENT', {
      matchId,
      from: 'e2',
      to: 'e4',
    });
    expect(res.pgn).toContain('1. e4');
    expect(currentMatch.pgn).toContain('1. e4');
  });

  // 8. match_moves row is created
  it('8. match_moves row is created', async () => {
    await service.makeMove(whiteUserId, 'STUDENT', {
      matchId,
      from: 'g1',
      to: 'f3',
    });
    expect(movesList.length).toBe(1);
    expect(movesList[0].moveNotation).toBe('Nf3');
    expect(movesList[0].ply).toBe(1);
    expect(movesList[0].fromSquare).toBe('g1');
    expect(movesList[0].toSquare).toBe('f3');
  });

  // 9. White clock decreases correctly
  it('9. White clock decreases correctly', async () => {
    // Simulate turn started 3.5 seconds ago
    const threePointFiveSecondsAgo = new Date(Date.now() - 3500);
    currentMatch.lastTurnStartTime = threePointFiveSecondsAgo;

    const res = await service.makeMove(whiteUserId, 'STUDENT', {
      matchId,
      from: 'e2',
      to: 'e4',
    });

    // Clock should have decreased by at least 3500ms
    expect(res.whiteTimeRemainingMs).toBeLessThanOrEqual(300000 - 3500);
    expect(res.blackTimeRemainingMs).toBe(300000); // Black clock untouched
  });

  // 10. Black clock decreases correctly
  it('10. Black clock decreases correctly', async () => {
    // White moves immediately
    await service.makeMove(whiteUserId, 'STUDENT', { matchId, from: 'e2', to: 'e4' });

    // Simulate Black thinking for 2.8 seconds
    const twoPointEightSecondsAgo = new Date(Date.now() - 2800);
    currentMatch.lastTurnStartTime = twoPointEightSecondsAgo;

    const res = await service.makeMove(blackUserId, 'STUDENT', {
      matchId,
      from: 'e7',
      to: 'e5',
    });

    expect(res.blackTimeRemainingMs).toBeLessThanOrEqual(300000 - 2800);
  });

  // 11. Increment is applied
  it('11. Increment is applied', async () => {
    // Configure 3 second increment
    tournamentConfig.incrementSeconds = 3;

    // Start with recent turn
    currentMatch.lastTurnStartTime = new Date();

    const res = await service.makeMove(whiteUserId, 'STUDENT', {
      matchId,
      from: 'e2',
      to: 'e4',
    });

    // White should have 300000 - ~0ms + 3000ms ≈ >= 302000ms
    expect(res.whiteTimeRemainingMs).toBeGreaterThan(300000);
  });

  // 12. Checkmate ends the match
  it('12. Checkmate ends the match', async () => {
    // Fool's mate setup:
    // 1. f3 e5 2. g4 Qh4#
    await service.makeMove(whiteUserId, 'STUDENT', { matchId, from: 'f2', to: 'f3' });
    await service.makeMove(blackUserId, 'STUDENT', { matchId, from: 'e7', to: 'e5' });
    await service.makeMove(whiteUserId, 'STUDENT', { matchId, from: 'g2', to: 'g4' });

    const finalMove = await service.makeMove(blackUserId, 'STUDENT', {
      matchId,
      from: 'd8',
      to: 'h4',
    });

    expect(finalMove.status).toBe('completed');
    expect(finalMove.result).toBe('black_win');
    expect(finalMove.reason).toBe('checkmate');
    expect(finalMove.winnerId).toBe(blackUserId);
    expect(currentMatch.status).toBe('completed');
  });

  // 13. Stalemate ends the match as draw
  it('13. Stalemate ends the match as draw', async () => {
    // White King on d6, White Queen on d7, Black King on a8.
    // White plays Qd7 -> c7: Black King on a8 has no legal moves (b8, b7, a7 all covered) and is not in check.
    currentMatch.currentFen = 'k7/3Q4/3K4/8/8/8/8/8 w - - 0 1';

    const res = await service.makeMove(whiteUserId, 'STUDENT', {
      matchId,
      from: 'd7',
      to: 'c7',
    });

    expect(res.status).toBe('completed');
    expect(res.result).toBe('draw');
    expect(res.reason).toBe('stalemate');
    expect(res.winnerId).toBeNull();
  });

  // 14. Resignation ends the match
  it('14. Resignation ends the match', async () => {
    const res = await service.resignMatch(whiteUserId, 'STUDENT', matchId);

    expect(res.status).toBe('completed');
    expect(res.result).toBe('black_win');
    expect(res.reason).toBe('resignation');
    expect(res.winnerId).toBe(blackUserId);
    expect(currentMatch.status).toBe('completed');
  });

  // 15. Move after match completion rejected
  it('15. Move after match completion rejected', async () => {
    // Resign match first
    await service.resignMatch(whiteUserId, 'STUDENT', matchId);

    // Attempt move
    await expect(
      service.makeMove(whiteUserId, 'STUDENT', { matchId, from: 'e2', to: 'e4' }),
    ).rejects.toThrow(BadRequestException);
  });

  // 16. Timeout ends the match
  it('16. Timeout ends the match', async () => {
    // White had 2000ms left, and turn began 5000ms ago
    currentMatch.whiteTimeRemainingMs = 2000;
    currentMatch.lastTurnStartTime = new Date(Date.now() - 5000);

    const res = await service.makeMove(whiteUserId, 'STUDENT', {
      matchId,
      from: 'e2',
      to: 'e4',
    });

    expect(res.status).toBe('completed');
    expect(res.result).toBe('black_win'); // Black wins on White timeout
    expect(res.reason).toBe('timeout');
    expect(res.winnerId).toBe(blackUserId);
    expect(res.whiteTimeRemainingMs).toBe(0);
  });

  // 17. Two concurrent move attempts cannot corrupt the match state
  it('17. Two concurrent move attempts cannot corrupt the match state', async () => {
    // Execute two moves simultaneously
    const move1 = service.makeMove(whiteUserId, 'STUDENT', { matchId, from: 'e2', to: 'e4' });
    const move2 = service.makeMove(whiteUserId, 'STUDENT', { matchId, from: 'd2', to: 'd4' });

    const results = await Promise.allSettled([move1, move2]);

    // Exactly one move must succeed, and the second must be rejected (not its turn anymore or invalid)
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(movesList.length).toBe(1);
  });
});
