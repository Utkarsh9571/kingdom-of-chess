'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSocket } from '@/context/SocketContext';
import { Crown, Trophy, Swords, User, LogOut, ArrowRight } from 'lucide-react';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { reconnectSocket } = useSocket();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      reconnectSocket();
      router.push('/login');
    },
  });

  const isCoach = user?.role === 'COACH';

  return (
    <header className="sticky top-0 z-40 border-b border-brand-border bg-white/90 backdrop-blur-md transition-all shadow-[0_2px_12px_rgba(3,40,61,0.04)]">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-8 max-w-7xl">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange to-[#FF8533] text-white shadow-md shadow-brand-orange/25 group-hover:scale-105 transition-transform">
              <Crown className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-brand-navy leading-none">
                KINGDOM
              </span>
              <span className="text-[11px] font-bold tracking-[0.2em] text-brand-orange leading-none mt-1">
                OF CHESS
              </span>
            </div>
          </Link>

          {/* Navigation Links for Authenticated Users */}
          {user && (
            <nav className="hidden md:flex items-center gap-2 text-sm font-semibold">
              {isCoach ? (
                <Link
                  href="/coach/tournaments"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                    pathname?.startsWith('/coach')
                      ? 'bg-brand-cream-dark text-brand-navy font-bold'
                      : 'text-brand-text-muted hover:text-brand-navy hover:bg-brand-cream'
                  }`}
                >
                  <Trophy className="h-4 w-4 text-brand-orange" />
                  <span>Tournament Management</span>
                </Link>
              ) : (
                <Link
                  href="/student/tournaments"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                    pathname?.startsWith('/student')
                      ? 'bg-brand-cream-dark text-brand-navy font-bold'
                      : 'text-brand-text-muted hover:text-brand-navy hover:bg-brand-cream'
                  }`}
                >
                  <Swords className="h-4 w-4 text-brand-orange" />
                  <span>Browse Tournaments</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* Right CTA / Profile Action */}
        <div className="flex items-center gap-3 sm:gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 rounded-full border border-brand-border bg-brand-cream/60 py-1.5 pl-2.5 pr-4 shadow-sm">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${
                    isCoach ? 'bg-brand-navy' : 'bg-brand-teal'
                  }`}
                >
                  {isCoach ? <Crown className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-brand-navy leading-tight line-clamp-1 max-w-[120px] sm:max-w-none">
                    {user.name}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-text-muted">
                    {user.role}
                  </span>
                </div>
              </div>

              <button
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                title="Sign out of account"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-white text-brand-text-muted hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-colors shadow-sm disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex text-sm font-bold text-brand-navy hover:text-brand-orange transition-colors px-3 py-2"
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-5 sm:px-6 py-2.5 text-sm font-bold text-white shadow-orange hover:bg-brand-orange-hover hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Enter Academy</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
