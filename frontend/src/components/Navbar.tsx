'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function Navbar() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      router.push('/login');
    },
  });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary tracking-wide">
            <span className="text-2xl">♚</span>
            <span>Kingdom of Chess</span>
          </Link>

          {user && (
            <nav className="hidden sm:flex items-center gap-4 text-sm font-medium">
              {user.role === 'COACH' ? (
                <Link
                  href="/coach/tournaments"
                  className="text-foreground/90 hover:text-primary transition-colors"
                >
                  Manage Tournaments
                </Link>
              ) : (
                <Link
                  href="/student/tournaments"
                  className="text-foreground/90 hover:text-primary transition-colors"
                >
                  Browse Tournaments
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-foreground">{user.name}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      user.role === 'COACH' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  <span>{user.role}</span>
                </div>
              </div>
              <button
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
