# Kingdom of Chess — Real-time Live Tournament Platform

> **Kingdom of Chess** is an online chess academy for kids in India. This platform provides a real-time tournament module with live 1-on-1 play, automated matchmaking, real-time board synchronization, shared clocks, and dynamic tournament leaderboards.

---

## 1. Technology Stack

- **Backend**: NestJS 11 (TypeScript, `strict: true`), Drizzle ORM, PostgreSQL (Managed Neon or local), Socket.IO (`@nestjs/platform-socket.io`), `class-validator`, `bcryptjs`, JWT cookies.
- **Frontend**: Next.js 15 (App Router, React 19, `strict: true`), TailwindCSS, Plus Jakarta Sans, TanStack React Query (`@tanstack/react-query`), Socket.IO client (`socket.io-client`), `react-chessboard`, `chess.js`, Lucide React.
- **Design System**: Kingdom of Chess brand identity — warm ivory canvas (`#FFF9EE`), energetic orange accents (`#FF6B00`), deep navy typography (`#03283D`), and soft elevation shadows.
- **Database & Tooling**: Drizzle Kit (migrations & schema), PostgreSQL 16+.

---

## 2. Prerequisites

- **Node.js**: `>= 20.x` (Recommended: v22+ or v24+)
- **npm**: `>= 10.x`
- **PostgreSQL Database**:
  - **Option A (Recommended / Cloud)**: Managed PostgreSQL (e.g., [Neon](https://neon.tech/)) — ideal for development laptops without CPU virtualization/Docker.
  - **Option B (Containerized)**: Docker Desktop / Docker Compose (using the included `docker-compose.yml`).
  - **Option C (Local Service)**: Standard local PostgreSQL service listening on port 5432.

---

## 3. Quick Start & Setup

### Step 1: Clone & Configure Environment Variables
Copy `.env.example` to `.env` in the project root:
```bash
cp .env.example .env
```
Ensure your `DATABASE_URL` is set to your PostgreSQL connection string:
```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
PORT=4000
NODE_ENV=development
JWT_SECRET=super_secret_jwt_key_for_kingdom_chess_2026_dev_only
FRONTEND_URL=http://localhost:3000

NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### Step 2: Install Dependencies
Install dependencies across all workspaces:
```bash
npm install
```

### Step 3: Run Database Migrations
Apply Drizzle schema migrations to your PostgreSQL database:
```bash
npm run db:migrate --workspace=backend
```

### Step 4: Seed Development Data
Seed the initial coach account, 4 student accounts, and a demo tournament:
```bash
npm run seed
```

### Step 5: Run Development Servers
Open two terminal tabs (or run concurrently):
```bash
# Terminal 1 — Backend API & Socket.IO Gateway (http://localhost:4000/api/v1)
npm run dev:backend

# Terminal 2 — Frontend Application (http://localhost:3000)
npm run dev:frontend
```

---

## 4. Seeded Development Accounts

The database comes pre-seeded with 1 coach and 4 students for development and testing:

| Role | Name | Email | Password | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **COACH** | Coach Garry | `coach@kingdom.com` | `Password123!` | Tournament organizer & administrator |
| **STUDENT** | Anand Jr. | `student1@kingdom.com` | `Password123!` | Player / Tournament participant |
| **STUDENT** | Pragg R. | `student2@kingdom.com` | `Password123!` | Player / Tournament participant |
| **STUDENT** | Gukesh D. | `student3@kingdom.com` | `Password123!` | Player / Tournament participant |
| **STUDENT** | Vaishali R. | `student4@kingdom.com` | `Password123!` | Player / Tournament participant |

> **Tip**: The `/login` page includes **one-click development buttons** to instantly fill credentials for any of these accounts.

---

## 5. Local Match Testing Walkthrough

To experience the real-time matchmaking loop between two students:

1. **Session 1 (Student 1)**:
   - Open your primary browser window and go to [http://localhost:3000/login](http://localhost:3000/login).
   - Click the **"♟ Anand Jr."** quick-fill button and sign in.
   - You will be redirected to the student tournaments list.
   - Click **"Tournament Hub"** on the demo tournament (*Kingdom Autumn Rapid 2026*).
   - Click **"⚔️ Find Opponent"** to enter the matchmaking queue.
   - You will see the animated waiting banner: *"Searching for an opponent..."*.

2. **Session 2 (Student 2)**:
   - Open a **private/incognito browser window** (to keep separate cookies/sessions).
   - Navigate to [http://localhost:3000/login](http://localhost:3000/login).
   - Click the **"♟ Pragg R."** quick-fill button and sign in.
   - Go to the same tournament hub.
   - Click **"⚔️ Find Opponent"**.

3. **Instant Pairing & Seamless Transition**:
   - The server atomically pairs Anand Jr. and Pragg R.
   - Sides (White and Black) are randomly and fairly assigned.
   - **Both browser windows automatically transition** into the live match arena (`/match/{matchId}`) without any manual page refresh.
   - White sees White at the bottom; Black sees Black at the bottom.

---

## 6. Real-Time Socket.IO Event Catalog

| Event Name | Direction | Payload | Description |
| :--- | :---: | :--- | :--- |
| `connection` | Client → Server | Handshake Auth (JWT cookie / token) | Authenticates connection; joins `user:{userId}` private room. |
| `auth:whoami` | Client → Server | `{}` | Returns authenticated user identity. |
| `queue:join` | Client → Server | `{ tournamentId: string }` | Enters tournament FIFO matchmaking queue. |
| `queue:leave` | Client → Server | `{ tournamentId: string }` | Leaves matchmaking queue. |
| `queue:status` | Server → Client | `{ inQueue: boolean, queueSize: number }` | Updates client queue status. |
| `queue:matched` | Server → Client | `{ matchId, color, opponent, timeControl, fen }` | Broadcast to both paired players to trigger arena redirect. |
| `match:join` | Client → Server | `{ matchId: string }` | Requests to join match room (`match:{matchId}`). |
| `match:joined` | Server → Client | `{ matchId, color, whitePlayer, blackPlayer, fen }` | Confirms room entry and assigns perspective. |
| `match:state` | Server → Client | Current match snapshot (FEN, timers, active turn) | Initial or restored match state. |
| `match:move` | Client → Server | `{ matchId, from, to, promotion }` | Submits proposed chess move for authoritative validation. |
| `match:moved` | Server → Client | `{ move, fen, pgn, whiteTimeRemaining, blackTimeRemaining, activeTurn }` | Broadcasts validated move to both players. |
| `match:clock_sync`| Server → Client | `{ whiteTimeRemainingMs, blackTimeRemainingMs, activeTurn }` | Periodic authoritative clock synchronization. |
| `match:resign` | Client → Server | `{ matchId: string }` | Player concedes the match. |
| `match:ended` | Server → Client | `{ result, winnerId, reason, pgn }` | Final game outcome broadcast. |

---

## 7. Architecture Decisions & Trade-Offs

### 1. Concurrency-Safe Matchmaking (The Anti-Double-Booking Guarantee)
- **Problem**: In live tournament software, rapid clicks or concurrent requests can pair the same player into multiple simultaneous games.
- **Solution**: 
  - An in-memory mutex (`runWithLock`) serializes all queue modifications per tournament.
  - A pre-flight `hasActiveMatch()` check verifies that neither candidate player is currently in an `in_progress` match.
  - An atomic database transaction creates the match and enforces unique constraints on active player IDs (`unique_active_white_player` and `unique_active_black_player`).

### 2. Managed PostgreSQL vs. Docker Virtualization
- **Choice**: The system is fully decoupled from container runtimes. Developers on machines without CPU virtualization or Docker Desktop can use a cloud PostgreSQL database (such as Neon) simply by setting `DATABASE_URL` in `.env`. The repository preserves `docker-compose.yml` for environments where containerized PostgreSQL is preferred.

### 3. Server-Authoritative State & Security Boundary
- **Choice**: The client is never trusted for user roles, turn tracking, or timers. Identity is extracted exclusively from validated JWT cookies. In-game timers and chess moves are validated by the server before state is broadcast.

### 4. Brand Design System
- **Choice**: Rather than a generic dark developer dashboard, the UI implements Kingdom of Chess's official warm, friendly visual identity:
  - Background: Warm ivory/cream (`#FFF9EE`)
  - Primary Brand Accent: Energetic orange (`#FF6B00`)
  - Headings: Deep midnight navy (`#03283D`)
  - Typography: Plus Jakarta Sans via Next.js Font Optimization
  - Cards & Badges: Pill shapes, soft warm elevation shadows (`0 4px 20px -2px rgba(3,40,61,0.06)`).

---

## 8. Verification & Test Suite

Run deterministic unit tests:
```bash
npm test
```
Tests cover:
- JWT Cookie authentication & role-based authorization (`COACH` vs `STUDENT`).
- Concurrency-safe matchmaking queue & FIFO auto-pairing.
- Tournament lifecycle transitions (`draft` → `open` → `ongoing` → `completed`) and duplicate enrollment prevention.

To verify frontend and backend production compilation:
```bash
npm run build:backend
npm run build:frontend
```
