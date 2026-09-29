import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import {
  Trophy,
  Swords,
  Clock,
  Award,
  Zap,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Users,
  CheckCircle2,
  Crown,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-brand-cream flex flex-col selection:bg-brand-orange/20 selection:text-brand-navy">
      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-8 pb-16 sm:pt-14 sm:pb-24">
          <div className="container mx-auto px-4 sm:px-8 max-w-6xl">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Awarded / Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-orange/20 bg-brand-orange-light px-4 py-1.5 text-xs font-bold text-brand-orange uppercase tracking-wider shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Kingdom of Chess Official Tournament Arena</span>
              </div>

              {/* Display Headline */}
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-brand-navy max-w-4xl leading-[1.12]">
                Live Online Chess Tournaments{' '}
                <span className="text-brand-orange relative inline-block">
                  For Young Champions
                  <svg
                    className="absolute -bottom-2 left-0 w-full text-brand-orange/30 -z-10"
                    viewBox="0 0 300 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2.5 9.5C85 2 215 2 297.5 9.5"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              {/* Sub-headline */}
              <p className="text-base sm:text-xl text-brand-text-muted max-w-2xl font-medium leading-relaxed">
                Step onto the live board. Compete in real-time academy tournaments with automated
                matchmaking, synchronized clocks, and live leaderboard rankings.
              </p>

              {/* Call to Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-8 py-4 text-base font-bold text-white shadow-orange hover:bg-brand-orange-hover hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span>Enter Academy & Play</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>

                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-border bg-white px-7 py-4 text-base font-bold text-brand-navy hover:bg-brand-cream-dark transition-all shadow-soft"
                >
                  <span>Coach Dashboard</span>
                </Link>
              </div>

              {/* Quick Trust / Highlights Row */}
              <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-4xl">
                <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-soft text-center flex flex-col items-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-brand-navy">1-on-1</div>
                  <div className="text-xs font-semibold text-brand-text-muted mt-1 uppercase tracking-wide">
                    Live Paired Matches
                  </div>
                </div>
                <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-soft text-center flex flex-col items-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-brand-teal">5+0 / 3+0</div>
                  <div className="text-xs font-semibold text-brand-text-muted mt-1 uppercase tracking-wide">
                    Rapid & Blitz Clocks
                  </div>
                </div>
                <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-soft text-center flex flex-col items-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-brand-orange">Socket.IO</div>
                  <div className="text-xs font-semibold text-brand-text-muted mt-1 uppercase tracking-wide">
                    Real-time Sync
                  </div>
                </div>
                <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-soft text-center flex flex-col items-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-brand-green">100%</div>
                  <div className="text-xs font-semibold text-brand-text-muted mt-1 uppercase tracking-wide">
                    Deterministic Play
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PILLARS / FEATURES SECTION */}
        <section className="py-16 bg-white border-y border-brand-border">
          <div className="container mx-auto px-4 sm:px-8 max-w-6xl space-y-12">
            <div className="text-center space-y-3">
              <span className="inline-block text-xs font-extrabold uppercase tracking-widest text-brand-orange">
                PLATFORM CAPABILITIES
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
                Designed for Competitive Chess Excellence
              </h2>
              <p className="text-brand-text-muted text-sm sm:text-base max-w-xl mx-auto font-medium">
                Everything required to run professional, synchronized tournaments from coach creation
                to player match finish.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="rounded-2xl border border-brand-border bg-brand-cream/40 p-6 sm:p-8 space-y-4 hover:shadow-soft-md transition-all">
                <div className="h-12 w-12 rounded-2xl bg-brand-orange-light text-brand-orange flex items-center justify-center shadow-sm">
                  <Swords className="h-6 w-6 stroke-[2.2]" />
                </div>
                <h3 className="text-xl font-bold text-brand-navy">Automated Matchmaking</h3>
                <p className="text-sm text-brand-text-muted leading-relaxed font-medium">
                  Students enter the queue with a single click. Our concurrency-safe FIFO engine
                  pairs waiting competitors instantly and assigns sides fairly.
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-bold text-brand-orange">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>No double-booking concurrency lock</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl border border-brand-border bg-brand-cream/40 p-6 sm:p-8 space-y-4 hover:shadow-soft-md transition-all">
                <div className="h-12 w-12 rounded-2xl bg-brand-teal-light text-brand-teal flex items-center justify-center shadow-sm">
                  <Clock className="h-6 w-6 stroke-[2.2]" />
                </div>
                <h3 className="text-xl font-bold text-brand-navy">Shared Clocks & Timers</h3>
                <p className="text-sm text-brand-text-muted leading-relaxed font-medium">
                  Authoritative countdown clocks run only on active turns. Timers stay synchronized
                  across both players with timeout detection and resignation triggers.
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-bold text-brand-teal">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>5+0 rapid & custom time controls</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl border border-brand-border bg-brand-cream/40 p-6 sm:p-8 space-y-4 hover:shadow-soft-md transition-all">
                <div className="h-12 w-12 rounded-2xl bg-brand-green-light text-brand-green flex items-center justify-center shadow-sm">
                  <Trophy className="h-6 w-6 stroke-[2.2]" />
                </div>
                <h3 className="text-xl font-bold text-brand-navy">Tournament Standings</h3>
                <p className="text-sm text-brand-text-muted leading-relaxed font-medium">
                  Every match outcome updates tournament leaderboards dynamically (1.0 pt win, 0.5 pt
                  draw). Coaches manage tournaments from draft through completion.
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-bold text-brand-green">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Automated score calculation</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5 SIMPLE STEPS SECTION (Inspired by Reference Screenshot) */}
        <section className="py-16 bg-brand-cream">
          <div className="container mx-auto px-4 sm:px-8 max-w-6xl space-y-12">
            <div className="text-center space-y-3">
              <span className="inline-block text-xs font-extrabold uppercase tracking-widest text-brand-orange">
                HOW IT WORKS
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
                From Sign In to Checkmate in 4 Steps
              </h2>
              <p className="text-brand-text-muted text-sm sm:text-base max-w-md mx-auto font-medium">
                A clean path from tournament registration to playing a match and seeing results.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Step 1 */}
              <div className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft space-y-3 relative">
                <div className="inline-flex rounded-full bg-brand-orange-light px-3 py-1 text-[11px] font-bold text-brand-orange">
                  STEP 1
                </div>
                <h3 className="text-base font-bold text-brand-navy">Sign In to Academy</h3>
                <p className="text-xs text-brand-text-muted font-medium leading-relaxed">
                  Log in as Coach Garry or one of our 4 seeded students with one-click access.
                </p>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft space-y-3 relative">
                <div className="inline-flex rounded-full bg-brand-teal-light px-3 py-1 text-[11px] font-bold text-brand-teal">
                  STEP 2
                </div>
                <h3 className="text-base font-bold text-brand-navy">Join Tournament</h3>
                <p className="text-xs text-brand-text-muted font-medium leading-relaxed">
                  Browse open rapid tournaments and enroll in upcoming academy competitions.
                </p>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft space-y-3 relative">
                <div className="inline-flex rounded-full bg-brand-yellow-light px-3 py-1 text-[11px] font-bold text-[#C98A00]">
                  STEP 3
                </div>
                <h3 className="text-base font-bold text-brand-navy">Find Opponent</h3>
                <p className="text-xs text-brand-text-muted font-medium leading-relaxed">
                  Enter the matchmaking pool. When two players queue, both auto-transition to the board.
                </p>
              </div>

              {/* Step 4 */}
              <div className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft space-y-3 relative">
                <div className="inline-flex rounded-full bg-brand-green-light px-3 py-1 text-[11px] font-bold text-brand-green">
                  STEP 4
                </div>
                <h3 className="text-base font-bold text-brand-navy">Play & Rise</h3>
                <p className="text-xs text-brand-text-muted font-medium leading-relaxed">
                  Make your moves on the live synchronized board, manage your clock, and win points!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* DARK CTA BANNER (Directly inspired by Reference Screenshot footer CTA) */}
        <section className="py-14 sm:py-20 bg-brand-navy text-white text-center relative overflow-hidden">
          <div className="container mx-auto px-4 sm:px-8 max-w-4xl space-y-6 relative z-10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">
              THE FIRST MOVE IS YOURS
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Your next match is <span className="text-brand-orange">one click away</span>.
            </h2>
            <p className="text-zinc-300 text-sm sm:text-base max-w-lg mx-auto font-medium">
              Join coach Garry and academy students in real-time live chess play.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-8 py-4 text-base font-bold text-white shadow-orange hover:bg-brand-orange-hover hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Enter Academy Now</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER (Matching Reference Screenshot) */}
      <footer className="bg-[#021F30] text-zinc-400 py-10 border-t border-zinc-800 text-xs">
        <div className="container mx-auto px-4 sm:px-8 max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-brand-orange flex items-center justify-center text-white">
              <Crown className="h-4 w-4" />
            </div>
            <span className="font-bold text-white tracking-wide">KINGDOM OF CHESS</span>
          </div>
          <p className="text-center sm:text-right text-zinc-500 font-medium">
            © 2026 Kingdom of Chess. Built for young champions in India.
          </p>
        </div>
      </footer>
    </div>
  );
}
