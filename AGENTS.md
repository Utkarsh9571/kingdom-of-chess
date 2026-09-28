# AGENTS.md — Kingdom of Chess Engineering Guidelines

## 1. Assignment Source of Truth
- **Authoritative Source Document**: `Kingdom of Chess - Full-stack Dev - Assignment.pdf` located in the project root.
- **Operating Rule**: The assignment PDF is the absolute authority. Whenever any requirement, edge case, or convention is uncertain, **re-read the PDF** before proceeding.
- **Strict Prohibition**: Do **not** invent requirements, assume generic chess-platform mechanics, or adopt unrequested third-party libraries without explicit justification.
- **Defensibility Standard**: The developer must personally defend and explain every line of code during a live technical walkthrough with the Kingdom of Chess engineering team. Favor simple, explicit, robust, and clean code over clever, convoluted abstractions.

---

## 2. Project Context & Deadline Awareness
- **Domain**: Kingdom of Chess is an online chess academy for kids in India.
- **Exercise Objective**: Build a tournament module with live 1-on-1 play where coaches manage tournaments, students join and auto-match, players compete on a real-time synchronized board with clocks, and match outcomes update a tournament leaderboard.
- **Target Deadline**: September 30, 2026 (Max 48 hours from assignment start on September 28, 2026).
- **Core Headline**: "A working, real-time experience and a clean path from join a tournament → play a match → see it on the leaderboard."
- **Triage Priority**: A working live game (sync, turns, clock, results) beats broad tournament administrative features. If time runs low, ensure the live match loop is flawless and document remaining items.

---

## 3. Required Technology Stack (Strict Alignment)
The assessment requires matching their production environment. Do not swap these technologies:

### Backend
- **Framework**: NestJS 11 — TypeScript, `strict: true` in `tsconfig.json`.
- **Database & ORM**: PostgreSQL with Drizzle ORM and Drizzle Kit (with proper database migrations).
- **Real-Time Communication**: Socket.IO (`@nestjs/platform-socket.io`, `socket.io`).
- **Validation**: `class-validator` and `class-transformer` on every REST DTO.
- **Deployment / Containerization**: Docker configuration with Docker Compose for local PostgreSQL and services.

### Frontend
- **Framework**: Next.js (App Router) + React 19 (`strict: true`).
- **Styling & UI**: TailwindCSS + `shadcn/ui` component library.
- **Server State & REST Client**: TanStack React Query (`@tanstack/react-query`) with proper cache invalidation on mutations.
- **Real-Time Client**: `socket.io-client`.
- **Chess Engine & UI**: `chess.js` for legal move generation, validation, FEN/PGN formatting + a dedicated board component (e.g., `react-chessboard`). Do not hand-roll chess rules or boards.

---

## 4. Roles & Authorization Requirements
Two distinct user roles with access enforced on **both backend and frontend**:

1. **Coach (`COACH`)**
   - The tournament organizer and administrator.
   - Can create, read, update, and manage tournaments (status transitions: `draft` → `open` → `ongoing` → `completed`).
   - Can view tournament statistics, participant lists, match histories, leaderboards, and declare winners.
   - Cannot be matched to play games as a student.

2. **Student (`STUDENT`)**
   - The player.
   - Can browse available tournaments (`open`, `ongoing`).
   - Can join an open tournament.
   - Can enter the matchmaking queue ("Find opponent") for an active/open tournament.
   - Plays matches live in real-time, views match history, personal ranking, and tournament leaderboard.
   - Cannot access coach tournament configuration endpoints or admin actions.

---

## 5. Authentication & Session Management
- **Credentials**: Email + password login.
- **Tokens**: JSON Web Token (JWT) issued and stored securely inside an `httpOnly`, `SameSite`, `secure` (in production) HTTP cookie.
- **Protected Routes**:
  - NestJS guards for HTTP REST endpoints (`AuthGuard`, `RolesGuard`).
  - Next.js middleware / layout checks for frontend page protection.
- **Identity Endpoint**: `GET /api/v1/auth/me` returning current user profile, role, and active status.
- **Socket Authentication**:
  - Socket.IO handshake must authenticate the incoming connection using the JWT cookie or handshake auth token.
  - Strict room authorization: Only authenticated participants (Player White, Player Black) or authorized observers (Coach/Admin) may join a match's Socket.IO room.
- **Seed Users (Mandatory)**:
  - Minimum 1 coach and at least 4 students seeded via database migrations/seed scripts.
  - Plaintext credentials documented clearly in the README.

---

## 6. Tournament Lifecycle & Management
- **Tournament Fields**:
  - `id`: UUID or standard primary key
  - `name`: String
  - `timeControl`: Time control representation (e.g., `5+0` = 5 minutes initial time per player, 0 seconds increment).
  - `startDate` / `startTime`: Start timestamp.
  - `status`: Enum (`draft`, `open`, `ongoing`, `completed`).
  - `createdById`: Foreign key referencing Coach.
- **Participant Flow**:
  - Students can self-join open tournaments (or be added by a coach).
  - Prevent duplicate enrollments.
- **Tournament Status Flow**:
  - `draft`: Only visible to Coach; editable.
  - `open`: Students can view and join the tournament roster.
  - `ongoing`: Matchmaking queue active; games can be started.
  - `completed`: Results finalized, winner declared, matchmaking closed.

---

## 7. Matchmaking Engine & Concurrency Control
- **Entry**: A student enrolled in an active tournament clicks "Find opponent" to enter that tournament's matchmaking pool.
- **Auto-Pairing**:
  - The server pairs two waiting students from the queue.
  - Pairing order: Simple FIFO or randomized pairing among eligible waiting players (standings-based is an optional stretch).
  - Assign sides (White vs. Black) fairly or randomly.
  - The server creates a `match` record and notifies both players simultaneously over Socket.IO (`match_found`).
  - Seamless transition: Players are transitioned directly into the live board screen without requiring a manual browser refresh.
- **Strict Concurrency Rule (The Concurrency Test)**:
  - **No Double-Booking**: A player can be in at most **one active match at any given time**.
  - If a player is currently in an ongoing match, they cannot re-enter the queue or be paired into another game.
  - Atomic queue locking / transactional matching to prevent race conditions when pairing simultaneous requests.
- **Post-Game Flow**:
  - When a match concludes, players can view summary stats, check the leaderboard, and click to re-queue for their next opponent.

---

## 8. Real-Time Socket.IO Architecture
- **Authentication**: Authenticate client on connection (`connection` handshake). Unauthenticated sockets are rejected.
- **Rooms**:
  - Tournament room: `tournament:{tournamentId}` for tournament-wide updates (queue count, completed match notices).
  - Match room: `match:{matchId}` for match-specific events (moves, clocks, resignations, game ends).
  - User room: `user:{userId}` for private direct pushes (e.g., `match_found`).
- **Documented Events** (Must be documented as `name → payload → direction` in the README):
  - `match:join` (Client → Server): Request to join match room (server verifies user is Player White or Player Black or Coach).
  - `match:state` (Server → Client): Initial or current match snapshot (FEN, PGN, timers, turn, status).
  - `match:move` (Client → Server): Proposed move `{ from, to, promotion }`.
  - `match:moved` (Server → Client): Broadcast move `{ move, fen, pgn, whiteTimeRemaining, blackTimeRemaining, turn }`.
  - `match:clock_sync` (Server → Client): Periodic or turn-based clock sync.
  - `match:resign` (Client → Server): Player concedes.
  - `match:ended` (Server → Client): Final match outcome `{ result, winnerId, reason, pgn }`.
  - `queue:join` / `queue:leave` (Client → Server): Enter/exit matchmaking pool.
  - `queue:matched` (Server → Client): Pushed to matched players with `matchId`.

---

## 9. Chess Mechanics, Clocks, & Game Termination
- **Engine Rules**: Always use `chess.js` on client and server. Do not write custom move validation algorithms.
- **Two-Way Synchronization**:
  - When Player White moves, Player Black’s board immediately reflects the move.
  - Board orientation: Automatically flip board so Player White views White at the bottom, and Player Black views Black at the bottom.
- **Authoritative Game State**:
  - The server maintains the authoritative `chess.js` instance for each active game.
  - Moves submitted by clients are validated against the server-side board state before being committed.
  - Prevents illegal moves, turn tampering, or client desynchronization.
- **Shared Clocks**:
  - Each side has an active countdown clock.
  - Clocks run only on the active player’s turn.
  - Clocks synchronize across both clients.
  - Server tracks turn start timestamps to compute authoritative time depletion.
  - When a player’s clock reaches 0, the server triggers a loss on time (`timeout`).
- **Move History & PGN**:
  - Moves recorded in standard PGN format.
  - Live PGN / move-list visible to both players during play.
  - Complete PGN persisted in PostgreSQL upon game completion.
- **Termination Scenarios**:
  - **Checkmate**: Victorious player gets 1 pt, defeated player 0.
  - **Resignation**: Conceding player loses (0 pt), opponent wins (1 pt).
  - **Timeout**: Player whose time expired loses (0 pt), opponent wins (1 pt).
  - **Stalemate / Draw**: ½ point awarded to both players.

---

## 10. Results & Tournament Leaderboards
- **Standard Scoring**:
  - Win = `1.0` point
  - Draw = `0.5` point
  - Loss = `0.0` point
- **Leaderboard Calculation**:
  - Dynamic aggregation of points per student for the specified tournament.
  - Clearly documented tiebreak rule (e.g., number of wins, head-to-head, or standard Buchholz/Sonneborn-Berger if implemented; default: highest wins, then lowest matches played).
  - Visible standings table: Rank, Student Name/Email, Matches Played, Wins, Draws, Losses, Total Points.
  - Declared tournament winner highlighted upon tournament completion.

---

## 11. REST API Conventions
- **Versioning**: Strict prefix on all REST endpoints: `/api/v1/...`
- **Standardized Response Envelope**: Consistent response structure for success and error formats across all endpoints:
  ```json
  {
    "success": true,
    "data": { ... },
    "error": null,
    "timestamp": "2026-09-28T21:00:00.000Z"
  }
  ```
- **Validation**:
  - All incoming request bodies and query params validated using `class-validator` DTOs with `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
  - Descriptive, standardized HTTP error responses (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict).

---

## 12. Testing Requirements
- Focus testing effort on **deterministic business logic**:
  1. **Leaderboard Scoring & Aggregation**: Unit tests verifying point calculation, draw handling, and ranking/tiebreak logic.
  2. **Tournament Join & Eligibility Rules**: Tests ensuring players cannot join unauthorized tournaments or double-book games.
  3. **Move and Turn Validation**: Tests ensuring turns alternate, illegal moves are rejected, and checkmate/stalemate triggers correct result status.
- Real-time Socket.IO wiring is not expected to have complex unit test harnesses; focus automated tests on core deterministic services.

---

## 13. Frontend UI/UX Requirements
- **Technology**: Next.js App Router, React 19, TailwindCSS, `shadcn/ui`.
- **States**: Every page and widget must implement proper **loading skeletons/spinners**, **error alerts/fallbacks**, and **clean empty states** (e.g., empty tournament list, no active matches, empty queue). Nothing hangs or fails silently.
- **Pages**:
  - `/login`: Clean email/password form with quick-fill buttons for seeded users.
  - `/coach/tournaments`: Coach tournament dashboard (create tournament, manage status, view roster & stats).
  - `/student/tournaments`: Student tournament browser, join button, current enrollments.
  - `/student/tournaments/[id]`: Tournament hub, matchmaking queue ("Find opponent"), standings table, past matches.
  - `/match/[id]`: Live match arena with real-time chessboard, opponent info, player cards, countdown clocks, PGN move log, and resignation/draw controls.
- **Client State**:
  - TanStack Query for caching, fetching, and invalidating REST data on mutations.
  - Socket.IO client isolated within clean React hooks or context providers with automatic cleanup on unmount.

---

## 14. Security & Environment Principles
- **Backend as Security Boundary**: Never trust client claims. Identity is extracted exclusively from the validated JWT cookie.
- **Zero Secrets in Git**: No credentials, JWT secrets, or DB passwords committed to the repository.
- **Environment Management**: Provide a complete, annotated `.env.example` covering both backend and frontend.

---

## 15. Database & Migrations
- **ORM**: Drizzle ORM.
- **Migrations**: Always generate and apply structured SQL migrations via `drizzle-kit generate` / `drizzle-kit migrate`. Never rely on ad-hoc unversioned table creation.
- **Seeding**: A dedicated seed script (`pnpm run seed` or `npm run seed`) that seeds the 1 coach and ≥4 student accounts with hashed passwords and demo tournament data.

---

## 16. Git Discipline
- Initialize Git repository at project setup.
- Commit frequently with small, atomic, meaningful messages adhering to Conventional Commits:
  - `feat(...)`, `fix(...)`, `test(...)`, `docs(...)`, `chore(...)`, `refactor(...)`.
- Avoid monolithic commits.

---

## 17. README & Submission Deliverables
The final submission repository must include a clear, professional `README.md` containing:
1. **Prerequisites & Setup Instructions**: Step-by-step instructions for environment variables, PostgreSQL, migrations, and seeds.
2. **One-Command Startup**: Instructions for running local development or Docker Compose (`docker compose up`).
3. **Seeded Test Credentials**: Table of coach and student email/password combinations.
4. **Local Match Testing Guide**: Clear walkthrough explaining how to open two separate browser sessions (or one regular + one incognito window), log in as two students, join an open tournament, queue up, and play a live game.
5. **Socket.IO Event Catalog**: Complete table of event names, directions (Client → Server / Server → Client), and payload schemas.
6. **Architecture Decisions & Trade-offs**: Thoughtful section explaining technical choices, concurrency handling, clock synchronization trade-offs, and future improvements.

---

## 18. Stretch Goals (Strict Sequence: Only After Core is Complete)
*Do not start stretch goals until the primary end-to-end flow is fully tested and verified.*
1. **Server-Authoritative Game State**: Server validates every move with `chess.js` and manages authoritative countdowns (included in baseline design).
2. **Reconnection & State Recovery**: Refreshing or dropping mid-game allows player to rejoin with board position, clocks, and PGN intact.
3. **Spectator Mode**: Coaches or other students can view an ongoing live match.
4. **Draw Offers & Advanced Rules**: Threefold repetition, 50-move rule, draw offers, and time increments (`5+3`).
5. **Standings-Based Matchmaking**: Pair closest-ranked waiting players instead of pure FIFO.
6. **Move-List Navigation**: Clicking past moves in the PGN panel previews board state at that ply.
7. **Date/Time Formatting**: Platform-wide `DD/MM/YYYY` format and timezone support.

---

## 19. Phase Execution Order
- **Phase 0**: Project foundation (Git setup, monorepo/folder layout, shared types, Docker Compose for Postgres).
- **Phase 1**: Backend Core (NestJS, Drizzle schema, migrations, seed script, Auth + JWT cookie, role guards).
- **Phase 2**: Tournament & Matchmaking REST APIs (Tournament CRUD, student self-join, concurrency-safe FIFO queue).
- **Phase 3**: Real-Time Game Engine & Socket.IO Gateway (Game state room, move sync, server-authoritative clock countdown, PGN logging, game end logic).
- **Phase 4**: Frontend Foundation & Auth Flow (Next.js 19, Tailwind + shadcn/ui, TanStack Query, Login page, Role-based route protection).
- **Phase 5**: Frontend Tournament & Match Arena (Tournament list/details, "Find opponent" queue modal/panel, real-time chessboard with `react-chessboard`, clocks, PGN panel, end-of-game dialog).
- **Phase 6**: Leaderboard & Stats (Standings computation, tiebreak display, match history).
- **Phase 7**: Deterministic Automated Tests (Unit tests for scoring, join eligibility, move legality).
- **Phase 8**: Polish, README, Verification & Walkthrough Prep (Verification across two browser sessions, docker compose test, README event table and trade-offs).
