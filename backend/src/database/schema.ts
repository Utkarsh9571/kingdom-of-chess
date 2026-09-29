import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['COACH', 'STUDENT']);
export const tournamentStatusEnum = pgEnum('tournament_status', ['draft', 'open', 'ongoing', 'completed']);
export const matchStatusEnum = pgEnum('match_status', ['in_progress', 'completed', 'aborted']);
export const matchResultEnum = pgEnum('match_result', ['white_win', 'black_win', 'draw']);
export const matchEndReasonEnum = pgEnum('match_end_reason', ['checkmate', 'resignation', 'timeout', 'stalemate']);

// 1. Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('STUDENT'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Tournaments Table
export const tournaments = pgTable('tournaments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  timeControl: varchar('time_control', { length: 32 }).notNull().default('5+0'),
  initialTimeSeconds: integer('initial_time_seconds').notNull().default(300),
  incrementSeconds: integer('increment_seconds').notNull().default(0),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  status: tournamentStatusEnum('status').notNull().default('draft'),
  winnerId: uuid('winner_id').references(() => users.id),
  createdById: uuid('created_by_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('tournament_status_idx').on(table.status),
]);

// 3. Tournament Participants Table
export const tournamentParticipants = pgTable('tournament_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('tournament_user_unique_idx').on(table.tournamentId, table.userId),
  index('participant_user_idx').on(table.userId),
]);

// 4. Matches Table
export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }).notNull(),
  whitePlayerId: uuid('white_player_id').references(() => users.id).notNull(),
  blackPlayerId: uuid('black_player_id').references(() => users.id).notNull(),
  status: matchStatusEnum('status').notNull().default('in_progress'),
  result: matchResultEnum('result'),
  reason: matchEndReasonEnum('reason'),
  winnerId: uuid('winner_id').references(() => users.id),
  currentFen: text('current_fen').notNull().default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
  pgn: text('pgn').notNull().default(''),
  whiteTimeRemainingMs: integer('white_time_remaining_ms').notNull(),
  blackTimeRemainingMs: integer('black_time_remaining_ms').notNull(),
  activeTurn: varchar('active_turn', { length: 1 }).notNull().default('w'),
  lastTurnStartTime: timestamp('last_turn_start_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
}, (table) => [
  index('match_tournament_idx').on(table.tournamentId),
  index('match_status_idx').on(table.status),
  index('match_tournament_status_idx').on(table.tournamentId, table.status),
  index('match_white_player_idx').on(table.whitePlayerId),
  index('match_black_player_idx').on(table.blackPlayerId),
  uniqueIndex('unique_active_white_player').on(table.whitePlayerId).where(sql`status = 'in_progress'`),
  uniqueIndex('unique_active_black_player').on(table.blackPlayerId).where(sql`status = 'in_progress'`),
]);

// 5. Match Moves Table
export const matchMoves = pgTable('match_moves', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id').references(() => matches.id, { onDelete: 'cascade' }).notNull(),
  ply: integer('ply').notNull(),
  moveNotation: varchar('move_notation', { length: 16 }).notNull(),
  fromSquare: varchar('from_square', { length: 4 }).notNull(),
  toSquare: varchar('to_square', { length: 4 }).notNull(),
  promotion: varchar('promotion', { length: 2 }),
  fenAfter: text('fen_after').notNull(),
  whiteTimeMs: integer('white_time_ms').notNull(),
  blackTimeMs: integer('black_time_ms').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('move_match_ply_idx').on(table.matchId, table.ply),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchMove = typeof matchMoves.$inferSelect;
