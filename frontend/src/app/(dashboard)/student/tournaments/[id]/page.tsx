'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Swords,
  ArrowLeft,
  Clock,
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  Trophy,
  Crown,
  Medal,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { useSocket } from '@/context/SocketContext';

export default function StudentTournamentDetailsPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params?.id as string;

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    socket,
    isQueueing,
    queuedTournamentId,
    queueError,
    joinMatchmaking,
    leaveMatchmaking,
    clearQueueError,
    isConnected,
  } = useSocket();

  const isCurrentTournamentQueued = isQueueing && queuedTournamentId === id;

  // Current logged in user for highlighting in leaderboard
  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
  });

  const {
    data: tournament,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.getTournament(id),
    enabled: !!id,
  });

  // Dynamic Leaderboard Query
  const {
    data: leaderboard,
    isLoading: isLeaderboardLoading,
    isError: isLeaderboardError,
    error: leaderboardError,
  } = useQuery({
    queryKey: ['tournament-leaderboard', id],
    queryFn: () => api.getLeaderboard(id),
    enabled: !!id && (tournament?.isEnrolled || currentUser?.role === 'COACH'),
    retry: 1,
  });

  // Socket listener to auto-refresh leaderboard on match completion
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleMatchEndedNotice = () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-leaderboard', id] });
    };

    socket.on('match:ended', handleMatchEndedNotice);
    return () => {
      socket.off('match:ended', handleMatchEndedNotice);
    };
  }, [socket, isConnected, id, queryClient]);

  const joinMutation = useMutation({
    mutationFn: () => api.joinTournament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournament-leaderboard', id] });
      setMsg({ type: 'success', text: 'You are now registered for this tournament!' });
    },
    onError: (err: any) => {
      setMsg({ type: 'error', text: err.message || 'Failed to join tournament' });
    },
  });

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col selection:bg-brand-orange/20 selection:text-brand-navy">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-8 space-y-8 max-w-7xl">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold text-brand-text-muted">
          <Link
            href="/student/tournaments"
            className="inline-flex items-center gap-1 hover:text-brand-orange transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to All Tournaments</span>
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6 animate-pulse">
            <div className="h-8 w-1/3 bg-brand-cream-dark rounded-full" />
            <div className="h-32 bg-white rounded-3xl shadow-soft" />
            <div className="h-64 bg-white rounded-3xl shadow-soft" />
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="rounded-2xl border border-destructive/30 bg-brand-pink-light p-5 text-sm font-semibold text-destructive flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>Failed to load tournament: {(error as Error).message}</span>
          </div>
        )}

        {/* Notification Message */}
        {msg && (
          <div
            className={`rounded-2xl p-4 text-xs font-bold flex items-center gap-2.5 ${
              msg.type === 'success'
                ? 'border border-brand-teal/30 bg-brand-teal-light text-brand-teal'
                : 'border border-destructive/30 bg-brand-pink-light text-destructive'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Tournament Content */}
        {!isLoading && !isError && tournament && (
          <div className="space-y-8">
            {/* Title & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-border pb-6">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
                    {tournament.name}
                  </h1>
                  <span
                    className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wide border ${
                      tournament.status === 'open'
                        ? 'bg-brand-teal-light text-brand-teal border-brand-teal/30'
                        : tournament.status === 'ongoing'
                        ? 'bg-brand-orange-light text-brand-orange border-brand-orange/30'
                        : 'bg-brand-cream-dark text-brand-text-muted border-brand-border'
                    }`}
                  >
                    {tournament.status}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-brand-text-muted font-medium">
                  Time Control:{' '}
                  <span className="font-extrabold text-brand-navy">{tournament.timeControl}</span> (
                  {tournament.initialTimeSeconds / 60} min each, {tournament.incrementSeconds}s increment)
                </p>
              </div>

              {/* Tournament Enrollment / Matchmaking CTAs */}
              <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                {tournament.isEnrolled ? (
                  <>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal-light border border-brand-teal/30 px-4 py-2 text-xs font-bold text-brand-teal">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Enrolled</span>
                    </div>

                    {(tournament.status === 'open' || tournament.status === 'ongoing') &&
                      !isCurrentTournamentQueued && (
                        <button
                          onClick={() => joinMatchmaking(tournament.id)}
                          disabled={!isConnected || (isQueueing && !isCurrentTournamentQueued)}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-7 py-3 text-sm font-extrabold text-white shadow-orange hover:bg-brand-orange-hover hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                        >
                          <Swords className="h-4 w-4" />
                          <span>Find Opponent</span>
                        </button>
                      )}
                  </>
                ) : tournament.status === 'open' ? (
                  <button
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-7 py-3 text-sm font-extrabold text-white shadow-orange hover:bg-brand-orange-hover hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {joinMutation.isPending ? 'Enrolling...' : 'Join Tournament'}
                  </button>
                ) : (
                  <div className="rounded-full bg-brand-cream-dark border border-brand-border px-4 py-2 text-xs font-bold text-brand-text-muted">
                    Enrollment Closed
                  </div>
                )}
              </div>
            </div>

            {/* Queue Error Banner */}
            {queueError && (
              <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-brand-pink-light p-4 text-xs font-bold text-destructive">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{queueError}</span>
                </div>
                <button
                  onClick={clearQueueError}
                  className="rounded-full px-2.5 py-0.5 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Live Queue Waiting Banner */}
            {isCurrentTournamentQueued && (
              <div className="rounded-3xl border border-brand-orange/40 bg-gradient-to-r from-brand-orange-light via-brand-cream to-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-soft animate-in fade-in">
                <div className="flex items-center gap-5">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-md shadow-brand-orange/25">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <span className="absolute inline-flex h-full w-full rounded-2xl bg-brand-orange opacity-20 animate-ping" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold text-brand-navy">
                        Searching for an opponent...
                      </h3>
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-orange animate-pulse" />
                    </div>
                    <p className="text-xs text-brand-text-muted font-medium">
                      Waiting in pool for {tournament.name}. You will be paired automatically as soon
                      as an eligible student queues.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => leaveMatchmaking(tournament.id)}
                  className="shrink-0 rounded-full border border-destructive/30 bg-white px-5 py-2.5 text-xs font-bold text-destructive hover:bg-brand-pink-light transition-all cursor-pointer shadow-sm"
                >
                  Cancel Queue
                </button>
              </div>
            )}

            {/* Queued in another tournament notice */}
            {isQueueing && !isCurrentTournamentQueued && queuedTournamentId && (
              <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-brand-yellow-light p-4 text-xs font-bold text-brand-navy">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand-orange shrink-0" />
                  <span>You are currently waiting in matchmaking for another tournament.</span>
                </div>
                <button
                  onClick={() => leaveMatchmaking(queuedTournamentId)}
                  className="rounded-full bg-white px-3 py-1 text-xs font-bold border border-brand-border hover:bg-brand-cream transition-colors"
                >
                  Cancel other queue
                </button>
              </div>
            )}

            {/* Status Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-soft space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text-muted">
                  <Trophy className="h-3.5 w-3.5 text-brand-orange" />
                  <span>Tournament Status</span>
                </div>
                <div className="text-xl font-extrabold capitalize text-brand-navy mt-1">
                  {tournament.status}
                </div>
                <div className="text-[11px] text-brand-text-muted font-medium">
                  {tournament.status === 'open'
                    ? 'Registration open'
                    : tournament.status === 'ongoing'
                    ? 'Matches in progress'
                    : 'Event completed'}
                </div>
              </div>

              <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-soft space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text-muted">
                  <Users className="h-3.5 w-3.5 text-brand-teal" />
                  <span>Total Competitors</span>
                </div>
                <div className="text-xl font-extrabold text-brand-navy mt-1">
                  {tournament.participantsCount} Players
                </div>
                <div className="text-[11px] text-brand-text-muted font-medium">
                  Enrolled academy students
                </div>
              </div>

              <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-soft space-y-1 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text-muted">
                  <Calendar className="h-3.5 w-3.5 text-brand-green" />
                  <span>Start Time</span>
                </div>
                <div className="text-base font-bold text-brand-navy mt-1">
                  {new Date(tournament.startDate).toLocaleDateString()}
                </div>
                <div className="text-[11px] text-brand-text-muted font-medium">
                  {new Date(tournament.startDate).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>

            {/* DYNAMIC TOURNAMENT LEADERBOARD SECTION */}
            <div className="rounded-3xl border border-brand-border bg-white p-6 sm:p-8 shadow-soft space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-brand-orange" />
                    <h2 className="text-xl font-extrabold text-brand-navy">Tournament Leaderboard</h2>
                  </div>
                  <p className="text-xs text-brand-text-muted font-medium mt-0.5">
                    Live standings calculated from completed match results
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold text-brand-text-muted bg-brand-cream px-3 py-1.5 rounded-full border border-brand-border self-start sm:self-auto">
                  <Info className="h-3.5 w-3.5 text-brand-teal" />
                  <span>Win = 1.0 pt • Draw = 0.5 pt • Loss = 0 pt</span>
                </div>
              </div>

              {/* Leaderboard Loading */}
              {isLeaderboardLoading && (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="h-7 w-7 text-brand-orange animate-spin" />
                  <p className="text-xs font-bold text-brand-text-muted">Loading live standings...</p>
                </div>
              )}

              {/* Leaderboard Error */}
              {isLeaderboardError && !tournament.isEnrolled && currentUser?.role !== 'COACH' && (
                <div className="rounded-2xl border border-brand-border bg-brand-cream p-6 text-center text-xs font-medium text-brand-text-muted">
                  Enroll in this tournament to view the live standings and player rankings.
                </div>
              )}

              {isLeaderboardError && (tournament.isEnrolled || currentUser?.role === 'COACH') && (
                <div className="rounded-2xl border border-destructive/20 bg-brand-pink-light p-4 text-xs font-bold text-destructive">
                  Unable to load tournament leaderboard: {(leaderboardError as Error)?.message}
                </div>
              )}

              {/* Leaderboard Table */}
              {!isLeaderboardLoading && leaderboard && (
                <div className="space-y-4">
                  {leaderboard.entries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-brand-border p-10 text-center text-xs text-brand-text-muted font-medium">
                      No competitors currently enrolled to display in standings.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-brand-border text-brand-text-muted font-bold uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="py-3 px-4 w-16">Rank</th>
                            <th className="py-3 px-4">Player</th>
                            <th className="py-3 px-4 text-center">Played</th>
                            <th className="py-3 px-4 text-center">Wins</th>
                            <th className="py-3 px-4 text-center">Draws</th>
                            <th className="py-3 px-4 text-center">Losses</th>
                            <th className="py-3 px-4 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border/60 font-medium">
                          {leaderboard.entries.map((entry) => {
                            const isMe = currentUser?.id === entry.playerId;
                            const isFirst = entry.rank === 1 && entry.points > 0;
                            const isSecond = entry.rank === 2 && entry.points > 0;
                            const isThird = entry.rank === 3 && entry.points > 0;

                            return (
                              <tr
                                key={entry.playerId}
                                className={`transition-colors ${
                                  isMe
                                    ? 'bg-brand-orange-light/40 border-l-4 border-l-brand-orange font-bold'
                                    : 'hover:bg-brand-cream/50'
                                }`}
                              >
                                <td className="py-3.5 px-4 font-extrabold text-sm">
                                  <div className="flex items-center gap-1.5">
                                    {isFirst ? (
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-xs shadow-sm">
                                        <Crown className="h-3.5 w-3.5 text-amber-600 inline" />
                                      </span>
                                    ) : isSecond ? (
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-extrabold text-xs">
                                        2
                                      </span>
                                    ) : isThird ? (
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-xs">
                                        3
                                      </span>
                                    ) : (
                                      <span className="text-brand-text-muted pl-1">
                                        #{entry.rank}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-cream-dark text-brand-navy font-bold text-xs">
                                      ♟
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-brand-navy text-sm">
                                        {entry.playerName}
                                      </span>
                                      {isMe && (
                                        <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[9px] font-extrabold text-white uppercase tracking-wider">
                                          You
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 text-center font-bold text-brand-navy">
                                  {entry.matchesPlayed}
                                </td>

                                <td className="py-3.5 px-4 text-center font-extrabold text-brand-teal">
                                  {entry.wins}
                                </td>

                                <td className="py-3.5 px-4 text-center font-bold text-brand-text-muted">
                                  {entry.draws}
                                </td>

                                <td className="py-3.5 px-4 text-center font-bold text-brand-text-muted">
                                  {entry.losses}
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  <span className="font-mono text-base font-extrabold text-brand-orange bg-brand-orange-light px-3 py-1 rounded-xl border border-brand-orange/30">
                                    {entry.points.toFixed(1)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="text-[11px] text-brand-text-muted font-medium pt-2 flex items-center justify-between border-t border-brand-border/60">
                    <span>
                      * Tiebreak Order: Total Points → Most Wins → Matches Played → Player Name.
                    </span>
                    <span className="font-bold text-brand-navy">
                      Competition Ranking (1, 2, 2, 4)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Enrolled Competitors Roster */}
            <div className="rounded-3xl border border-brand-border bg-white p-6 sm:p-8 shadow-soft space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-brand-navy">Enrolled Competitors</h2>
                <p className="text-xs text-brand-text-muted font-medium mt-0.5">
                  Students ready to compete in {tournament.name} ({tournament.participants?.length || 0})
                </p>
              </div>

              {!tournament.participants || tournament.participants.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-brand-border p-10 text-center text-xs text-brand-text-muted font-medium">
                  No competitors enrolled yet. Be the first to join!
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tournament.participants.map((p, idx) => (
                    <div
                      key={p.participantId}
                      className="flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-cream/30 p-3.5 text-xs hover:border-brand-orange/30 transition-colors"
                    >
                      <span className="font-extrabold text-brand-text-muted w-4">{idx + 1}.</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-teal-light text-brand-teal text-sm">
                        ♟
                      </div>
                      <div className="flex-1 truncate">
                        <div className="font-bold text-brand-navy truncate">{p.name}</div>
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
