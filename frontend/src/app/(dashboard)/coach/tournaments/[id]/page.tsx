'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  ArrowLeft,
  Clock,
  Users,
  Calendar,
  Settings,
  Trash2,
  CheckCircle2,
  AlertCircle,
  User,
  Crown,
} from 'lucide-react';
import { api, Tournament } from '@/lib/api';
import { Navbar } from '@/components/Navbar';

export default function CoachTournamentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params?.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Tournament['status']>('open');
  const [timeControl, setTimeControl] = useState('5+0');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const {
    data: leaderboard,
    isLoading: isLeaderboardLoading,
  } = useQuery({
    queryKey: ['tournament-leaderboard', id],
    queryFn: () => api.getLeaderboard(id),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.updateTournament>[1]) =>
      api.updateTournament(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['tournament', id] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setIsEditing(false);
      setMsg({ type: 'success', text: `Tournament updated successfully (Status: ${updated.status})` });
    },
    onError: (err: any) => {
      setMsg({ type: 'error', text: err.message || 'Update failed' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTournament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      router.push('/coach/tournaments');
    },
    onError: (err: any) => {
      setMsg({ type: 'error', text: err.message || 'Delete failed' });
    },
  });

  const startEdit = () => {
    if (!tournament) return;
    setName(tournament.name);
    setStatus(tournament.status);
    setTimeControl(tournament.timeControl);
    setIsEditing(true);
    setMsg(null);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name, status, timeControl });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to permanently delete this tournament?')) {
      deleteMutation.mutate();
    }
  };

  const getStatusBadge = (st: Tournament['status']) => {
    switch (st) {
      case 'draft':
        return (
          <span className="inline-flex items-center rounded-full bg-brand-cream-dark px-3.5 py-1 text-xs font-bold text-brand-text-muted border border-brand-border">
            Draft
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center rounded-full bg-brand-teal-light px-3.5 py-1 text-xs font-bold text-brand-teal border border-brand-teal/30">
            Open
          </span>
        );
      case 'ongoing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange-light px-3.5 py-1 text-xs font-bold text-brand-orange border border-brand-orange/30">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange animate-pulse" />
            Ongoing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center rounded-full bg-brand-green-light px-3.5 py-1 text-xs font-bold text-brand-green border border-brand-green/30">
            Completed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col selection:bg-brand-orange/20 selection:text-brand-navy">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-8 space-y-8 max-w-7xl">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold text-brand-text-muted">
          <Link
            href="/coach/tournaments"
            className="inline-flex items-center gap-1 hover:text-brand-orange transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Tournaments</span>
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

        {/* Feedback Message Banner */}
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

        {/* Main Content */}
        {!isLoading && !isError && tournament && (
          <div className="space-y-8">
            {/* Title & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-border pb-6">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
                    {tournament.name}
                  </h1>
                  {getStatusBadge(tournament.status)}
                </div>
                <p className="text-xs font-mono font-medium text-brand-text-muted">
                  Tournament ID: {tournament.id}
                </p>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto">
                {!isEditing ? (
                  <button
                    onClick={startEdit}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-white px-5 py-2.5 text-xs font-bold text-brand-navy hover:bg-brand-cream-dark shadow-soft transition-all cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5 text-brand-orange" />
                    <span>Edit Settings</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-full border border-brand-border bg-white px-5 py-2.5 text-xs font-bold text-brand-navy hover:bg-brand-cream transition-colors"
                  >
                    Cancel Edit
                  </button>
                )}

                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-brand-pink-light px-4 py-2.5 text-xs font-bold text-destructive hover:bg-destructive hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{deleteMutation.isPending ? 'Deleting...' : 'Delete'}</span>
                </button>
              </div>
            </div>

            {/* Quick Status Bar / Edit Panel */}
            {isEditing ? (
              <form
                onSubmit={handleUpdate}
                className="rounded-3xl border border-brand-orange/40 bg-white p-6 sm:p-8 space-y-6 shadow-soft"
              >
                <div className="text-sm font-bold text-brand-orange uppercase tracking-wider">
                  Update Configuration
                </div>
                <div className="grid sm:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-brand-navy">Tournament Title</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-brand-cream/30 px-3.5 py-2 text-xs text-brand-navy font-medium focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-brand-navy">Status Transition</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full rounded-xl border border-brand-border bg-brand-cream/30 px-3.5 py-2 text-xs text-brand-navy font-medium focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                    >
                      <option value="draft">Draft (Hidden)</option>
                      <option value="open">Open (Accepting Players)</option>
                      <option value="ongoing">Ongoing (Active Play)</option>
                      <option value="completed">Completed (Finalized)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-brand-navy">Time Control</label>
                    <select
                      value={timeControl}
                      onChange={(e) => setTimeControl(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-brand-cream/30 px-3.5 py-2 text-xs text-brand-navy font-medium focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                    >
                      <option value="5+0">5+0 Rapid</option>
                      <option value="3+0">3+0 Blitz</option>
                      <option value="3+2">3+2 Blitz with increment</option>
                      <option value="10+0">10+0 Rapid</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="rounded-full bg-brand-orange px-6 py-2 text-xs font-bold text-white shadow-orange hover:bg-brand-orange-hover disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-soft space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text-muted">
                    <Clock className="h-3.5 w-3.5 text-brand-teal" />
                    <span>Clock Format</span>
                  </div>
                  <div className="text-xl font-extrabold text-brand-navy mt-1">
                    {tournament.timeControl}
                  </div>
                  <div className="text-[11px] text-brand-text-muted font-medium">
                    {tournament.initialTimeSeconds / 60}m initial + {tournament.incrementSeconds}s
                  </div>
                </div>

                <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-soft space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text-muted">
                    <Users className="h-3.5 w-3.5 text-brand-orange" />
                    <span>Enrolled Students</span>
                  </div>
                  <div className="text-xl font-extrabold text-brand-navy mt-1">
                    {tournament.participantsCount}
                  </div>
                  <div className="text-[11px] text-brand-text-muted font-medium">
                    Available in matchmaking
                  </div>
                </div>

                <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-soft space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text-muted">
                    <Calendar className="h-3.5 w-3.5 text-brand-green" />
                    <span>Scheduled Start</span>
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

                <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-soft space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-text-muted">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    <span>Current Status</span>
                  </div>
                  <div className="text-xl font-extrabold capitalize text-brand-orange mt-1">
                    {tournament.status}
                  </div>
                  <div className="text-[11px] text-brand-text-muted font-medium">
                    {tournament.status === 'open' ? 'Joinable by students' : 'Closed for entry'}
                  </div>
                </div>
              </div>
            )}

            {/* DYNAMIC LEADERBOARD / STANDINGS */}
            <div className="rounded-3xl border border-brand-border bg-white p-6 sm:p-8 shadow-soft space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-brand-orange" />
                    <h2 className="text-xl font-extrabold text-brand-navy">Tournament Standings</h2>
                  </div>
                  <p className="text-xs text-brand-text-muted font-medium mt-0.5">
                    Live leaderboard aggregated from completed matches
                  </p>
                </div>
                <div className="text-[11px] font-bold text-brand-text-muted bg-brand-cream px-3 py-1 rounded-full border border-brand-border">
                  Tiebreak: Points → Wins → Matches Played → Name
                </div>
              </div>

              {!isLeaderboardLoading && leaderboard && (
                <div>
                  {leaderboard.entries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-brand-border p-8 text-center text-xs text-brand-text-muted font-medium">
                      No competitors currently enrolled to calculate standings.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-brand-border text-brand-text-muted font-bold uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="py-3 px-4 w-16">Rank</th>
                            <th className="py-3 px-4">Student</th>
                            <th className="py-3 px-4 text-center">Played</th>
                            <th className="py-3 px-4 text-center">Wins</th>
                            <th className="py-3 px-4 text-center">Draws</th>
                            <th className="py-3 px-4 text-center">Losses</th>
                            <th className="py-3 px-4 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border/60 font-medium">
                          {leaderboard.entries.map((entry) => (
                            <tr key={entry.playerId} className="hover:bg-brand-cream/50 transition-colors">
                              <td className="py-3.5 px-4 font-extrabold text-sm">
                                {entry.rank === 1 && entry.points > 0 ? (
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-xs">
                                    <Crown className="h-3.5 w-3.5 text-amber-600 inline" />
                                  </span>
                                ) : (
                                  <span className="text-brand-text-muted pl-1">#{entry.rank}</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-brand-navy flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal text-[10px]">
                                  ♟
                                </span>
                                <span>{entry.playerName}</span>
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold text-brand-navy">{entry.matchesPlayed}</td>
                              <td className="py-3.5 px-4 text-center font-extrabold text-brand-teal">{entry.wins}</td>
                              <td className="py-3.5 px-4 text-center font-bold text-brand-text-muted">{entry.draws}</td>
                              <td className="py-3.5 px-4 text-center font-bold text-brand-text-muted">{entry.losses}</td>
                              <td className="py-3.5 px-4 text-right">
                                <span className="font-mono text-sm font-extrabold text-brand-orange bg-brand-orange-light px-2.5 py-1 rounded-lg border border-brand-orange/30">
                                  {entry.points.toFixed(1)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Participants Roster Table */}
            <div className="rounded-3xl border border-brand-border bg-white p-6 sm:p-8 shadow-soft space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-brand-navy">Registered Competitors</h2>
                  <p className="text-xs text-brand-text-muted font-medium mt-0.5">
                    Students enrolled in this tournament roster ({tournament.participants?.length || 0})
                  </p>
                </div>
              </div>

              {!tournament.participants || tournament.participants.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-brand-border p-10 text-center text-xs text-brand-text-muted font-medium">
                  No students have enrolled in this tournament yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-brand-border text-brand-text-muted font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Registered At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border/60 font-medium">
                      {tournament.participants.map((p, idx) => (
                        <tr key={p.participantId} className="hover:bg-brand-cream/50 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-brand-text-muted">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-bold text-brand-navy flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal text-[10px]">
                              ♟
                            </span>
                            <span>{p.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-brand-text-muted">{p.email}</td>
                          <td className="py-3.5 px-4">
                            <span className="rounded-full bg-brand-cream-dark px-2.5 py-0.5 text-[10px] font-bold text-brand-navy uppercase tracking-wider">
                              {p.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-brand-text-muted">
                            {new Date(p.joinedAt).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
