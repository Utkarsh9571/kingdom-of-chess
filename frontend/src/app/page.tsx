import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Kingdom of Chess Academy
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
          Live 1-on-1 Chess Tournaments
        </h1>

        <p className="text-muted-foreground text-base sm:text-lg">
          Compete in real-time, timed chess matches with synchronized boards, shared clocks, and dynamic leaderboard rankings.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Enter Academy
          </Link>
        </div>
      </div>
    </main>
  );
}
