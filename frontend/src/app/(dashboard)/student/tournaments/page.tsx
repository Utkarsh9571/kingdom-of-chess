'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Tournament } from '@/lib/api';
import { Navbar } from '@/components/Navbar';

export default function StudentTournamentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [joinMsg, setJoinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: tournaments, isLoading, isError, error } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.getTournaments,
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => api.joinTournament(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setJoinMsg({ type: 'success', text: 'You have joined the tournament successfully!' });
    },
    onError: (err: any) => {
      setJoinMsg({ type: 'error', text: err.message || 'Failed to join tournament' });
    },
  });

  const displayedTournaments = tournaments
    ? activeTab === 'all'
      ? tournaments
      : tournaments.filter((t) => t.isEnrolled)
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Chess Tournaments
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse official academy tournaments, self-register, and compete for leaderboard glory.
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-border bg-card p-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Tournaments
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                activeTab === 'my'
                  ? 'bg-primary text-primary-foreground font-semibold shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              My Registered ({tournaments?.filter((t) => t.isEnrolled).length || 0})
            </button>
          </div>
        </div>

        {joinMsg && (
          <div
            className={`rounded-md p-3 text-xs ${
              joinMsg.type === 'success'
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {joinMsg.text}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-xl border border-border bg-card p-4 animate-pulse space-y-3">
                <div className="h-5 w-2/3 bg-muted rounded" />
                <div className="h-4 w-1/3 bg-muted rounded" />
                <div className="h-10 w-full bg-muted rounded mt-6" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load tournaments: {(error as Error).message}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && displayedTournaments.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
            <div className="text-4xl">♟</div>
            <h3 className="text-lg font-semibold text-foreground">
              {activeTab === 'my' ? 'No registered tournaments' : 'No tournaments available'}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              {activeTab === 'my'
                ? 'Browse available tournaments and click "Join" to enroll in upcoming events.'
                : 'Check back soon for new tournaments scheduled by academy coaches.'}
            </p>
          </div>
        )}

        {/* Tournaments Grid */}
        {!isLoading && !isError && displayedTournaments.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayedTournaments.map((t) => (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-foreground text-lg line-clamp-1">{t.name}</h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                        t.status === 'open'
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                          : t.status === 'ongoing'
                          ? 'bg-amber-950/80 text-amber-400 border-amber-800 animate-pulse'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Time Control:</span> {t.timeControl}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Players:</span> {t.participantsCount}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-foreground">Starts:</span>{' '}
                      {new Date(t.startDate).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50 mt-4 flex items-center justify-between gap-2">
                  <Link
                    href={`/student/tournaments/${t.id}`}
                    className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                  >
                    View Details →
                  </Link>

                  {t.isEnrolled ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                      ✓ Enrolled
                    </span>
                  ) : t.status === 'open' ? (
                    <button
                      onClick={() => joinMutation.mutate(t.id)}
                      disabled={joinMutation.isPending}
                      className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {joinMutation.isPending ? 'Joining...' : 'Join Tournament'}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Registration Closed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
