'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

  const { data: tournament, isLoading, isError, error } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.getTournament(id),
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/coach/tournaments" className="hover:text-primary transition-colors">
            ← Back to Tournaments
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

        {/* Success / Error Message Banner */}
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
                        : tournament.status === 'completed'
                        ? 'bg-blue-950/80 text-blue-400 border-blue-800'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {tournament.status}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  ID: <span className="font-mono text-xs">{tournament.id}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {!isEditing ? (
                  <button
                    onClick={startEdit}
                    className="rounded-md border border-border bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
                  >
                    Edit Settings
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-md border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    Cancel Edit
                  </button>
                )}

                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>

            {/* Quick Status Bar / Edit Panel */}
            {isEditing ? (
              <form
                onSubmit={handleUpdate}
                className="rounded-xl border border-primary/40 bg-card p-5 space-y-4"
              >
                <h3 className="text-sm font-semibold text-primary">Edit Tournament Configuration</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Tournament Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Status Transition</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="draft">Draft (Hidden)</option>
                      <option value="open">Open (Accepting Players)</option>
                      <option value="ongoing">Ongoing (Active Play)</option>
                      <option value="completed">Completed (Finalized)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Time Control</label>
                    <select
                      value={timeControl}
                      onChange={(e) => setTimeControl(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="5+0">5+0</option>
                      <option value="3+0">3+0</option>
                      <option value="3+2">3+2</option>
                      <option value="10+0">10+0</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Clock Format</div>
                  <div className="text-lg font-bold text-foreground mt-1">{tournament.timeControl}</div>
                  <div className="text-xs text-muted-foreground">
                    {tournament.initialTimeSeconds / 60}m + {tournament.incrementSeconds}s
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Enrolled Students</div>
                  <div className="text-lg font-bold text-foreground mt-1">
                    {tournament.participantsCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Auto-matchmaking pool</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Scheduled Start</div>
                  <div className="text-sm font-semibold text-foreground mt-1">
                    {new Date(tournament.startDate).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(tournament.startDate).toLocaleTimeString()}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Current Status</div>
                  <div className="text-lg font-bold capitalize text-primary mt-1">
                    {tournament.status}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tournament.status === 'open' ? 'Joinable by students' : 'Closed for entry'}
                  </div>
                </div>
              </div>
            )}

            {/* Participants Roster */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Registered Participants</h2>
                  <p className="text-xs text-muted-foreground">
                    Students enrolled in this tournament roster ({tournament.participants?.length || 0})
                  </p>
                </div>
              </div>

              {!tournament.participants || tournament.participants.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                  No students have enrolled in this tournament yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Registered At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {tournament.participants.map((p, idx) => (
                        <tr key={p.participantId} className="hover:bg-secondary/30 transition-colors">
                          <td className="py-2.5 px-3 text-muted-foreground">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            <span className="mr-1.5 text-emerald-400">♟</span> {p.name}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{p.email}</td>
                          <td className="py-2.5 px-3">
                            <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                              {p.role}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {new Date(p.joinedAt).toLocaleString()}
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
