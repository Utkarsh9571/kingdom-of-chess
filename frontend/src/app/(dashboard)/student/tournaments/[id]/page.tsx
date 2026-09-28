'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { useSocket } from '@/context/SocketContext';

export default function StudentTournamentDetailsPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params?.id as string;

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    isQueueing,
    queuedTournamentId,
    queueError,
    joinMatchmaking,
    leaveMatchmaking,
    clearQueueError,
    isConnected,
  } = useSocket();

  const isCurrentTournamentQueued = isQueueing && queuedTournamentId === id;

  const { data: tournament, isLoading, isError, error } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.getTournament(id),
    enabled: !!id,
  });

  const joinMutation = useMutation({
    mutationFn: () => api.joinTournament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setMsg({ type: 'success', text: 'You are now registered for this tournament!' });
    },
    onError: (err: any) => {
      setMsg({ type: 'error', text: err.message || 'Failed to join tournament' });
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/student/tournaments" className="hover:text-primary transition-colors">
            ← Back to All Tournaments
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 w-1/3 bg-muted rounded" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load tournament: {(error as Error).message}
          </div>
        )}

        {/* Notification Message */}
        {msg && (
          <div
            className={`rounded-md p-3 text-xs ${
              msg.type === 'success'
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Tournament Content */}
        {!isLoading && !isError && tournament && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{tournament.name}</h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide border ${
                      tournament.status === 'open'
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                        : tournament.status === 'ongoing'
                        ? 'bg-amber-950/80 text-amber-400 border-amber-800 animate-pulse'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {tournament.status}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Time Control: <span className="font-semibold text-foreground">{tournament.timeControl}</span> (
                  {tournament.initialTimeSeconds / 60} min each, {tournament.incrementSeconds}s increment)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {tournament.isEnrolled ? (
                  <>
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                      <span>✓</span> Enrolled
                    </div>

                    {(tournament.status === 'open' || tournament.status === 'ongoing') && !isCurrentTournamentQueued && (
                      <button
                        onClick={() => joinMatchmaking(tournament.id)}
                        disabled={!isConnected || (isQueueing && !isCurrentTournamentQueued)}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <span>⚔️</span> Find Opponent
                      </button>
                    )}
                  </>
                ) : tournament.status === 'open' ? (
                  <button
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow disabled:opacity-50 transition-colors"
                  >
                    {joinMutation.isPending ? 'Enrolling...' : 'Join Tournament'}
                  </button>
                ) : (
                  <div className="rounded-lg bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
                    Enrollment Closed
                  </div>
                )}
              </div>
            </div>

            {/* Queue Error Banner */}
            {queueError && (
              <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 p-3.5 text-xs text-destructive">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚠️</span>
                  <span className="font-medium">{queueError}</span>
                </div>
                <button
                  onClick={clearQueueError}
                  className="rounded px-2 py-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive font-bold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Live Queue Waiting Banner */}
            {isCurrentTournamentQueued && (
              <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/50">
                    <span className="text-xl animate-spin">⏱️</span>
                    <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-20 animate-ping" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                      Searching for opponent...
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Waiting in pool for {tournament.name}. You will be paired automatically as soon as an eligible student queues.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => leaveMatchmaking(tournament.id)}
                  className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
                >
                  Cancel Queue
                </button>
              </div>
            )}

            {/* Queued in another tournament notice */}
            {isQueueing && !isCurrentTournamentQueued && queuedTournamentId && (
              <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300">
                <div className="flex items-center gap-2">
                  <span>⏳</span>
                  <span>You are currently in matchmaking for another tournament.</span>
                </div>
                <button
                  onClick={() => leaveMatchmaking(queuedTournamentId)}
                  className="rounded px-2.5 py-1 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors"
                >
                  Cancel other queue
                </button>
              </div>
            )}

            {/* Status Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Tournament Status</div>
                <div className="text-lg font-bold capitalize text-foreground mt-1">{tournament.status}</div>
                <div className="text-xs text-muted-foreground">
                  {tournament.status === 'open'
                    ? 'Registration open'
                    : tournament.status === 'ongoing'
                    ? 'Matches currently in progress'
                    : 'Event completed'}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Total Competitors</div>
                <div className="text-lg font-bold text-foreground mt-1">
                  {tournament.participantsCount} Players
                </div>
                <div className="text-xs text-muted-foreground">Enrolled academy students</div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 col-span-2 sm:col-span-1">
                <div className="text-xs text-muted-foreground">Start Time</div>
                <div className="text-sm font-semibold text-foreground mt-1">
                  {new Date(tournament.startDate).toLocaleDateString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(tournament.startDate).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Enrolled Participant List */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Enrolled Students</h2>
              {!tournament.participants || tournament.participants.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No competitors enrolled yet. Be the first to join!
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tournament.participants.map((p, idx) => (
                    <div
                      key={p.participantId}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-xs"
                    >
                      <span className="font-bold text-muted-foreground w-4">{idx + 1}.</span>
                      <span className="text-emerald-400">♟</span>
                      <div className="flex-1 truncate">
                        <div className="font-medium text-foreground truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{p.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
