# Kingdom of Chess — Real-time Tournament Platform

Kingdom of Chess is an online chess academy for kids in India. This platform provides a real-time tournament module with live 1-on-1 play, automated matchmaking, real-time board synchronization, shared clocks, and dynamic leaderboard standings.

## Technology Stack

- **Backend**: NestJS 11 (TypeScript, `strict: true`), Drizzle ORM + PostgreSQL, Socket.IO, `class-validator`.
- **Frontend**: Next.js 19 (App Router, React 19, `strict: true`), TailwindCSS + `shadcn/ui`, TanStack React Query, Socket.IO client, `chess.js`, `react-chessboard`.
- **Infrastructure**: Docker Compose, PostgreSQL 16.

## Prerequisites

- Node.js >= 20.x (Recommended: v22+ or v24+)
- npm >= 10.x
- Docker & Docker Compose

## Quick Start

### 1. Environment Setup
```bash
cp .env.example .env
```

### 2. Start PostgreSQL
```bash
docker compose up -d
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Servers
- Backend: `npm run dev:backend` (runs on http://localhost:4000)
- Frontend: `npm run dev:frontend` (runs on http://localhost:3000)

## Architecture & Project Rules
See [AGENTS.md](AGENTS.md) for full engineering guidelines, architecture contracts, and assignment constraints.
