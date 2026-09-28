'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Tournament } from '@/lib/api';
import { Navbar } from '@/components/Navbar';

export default function CoachTournamentsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [timeControl, setTimeControl] = useState('5+0');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<'draft' | 'open' | 'ongoing' | 'completed'>('open');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: tournaments, isLoading, isError, error } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.getTournaments,
  });

  const createMutation = useMutation({
    mutationFn: api.createTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setIsModalOpen(false);
      setName('');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to create tournament');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      timeControl,
      startDate: new Date(startDate).toISOString(),
      status,
    });
  };

  const getStatusBadge = (st: Tournament['status']) => {
    switch (st) {
      case 'draft':
        return <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400 border border-zinc-700">Draft</span>;
      case 'open':
        return <span className="rounded-full bg-emerald-950/80 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-800">Open</span>;
      case 'ongoing':
        return <span className="rounded-full bg-amber-950/80 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-800 animate-pulse">Ongoing</span>;
      case 'completed':
        return <span className="rounded-full bg-blue-950/80 px-2.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-800">Completed</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Tournament Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Create, configure, and monitor live chess tournaments.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow"
          >
            + Create Tournament
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl border border-border bg-card p-4 animate-pulse space-y-3">
                <div className="h-5 w-2/3 bg-muted rounded" />
                <div className="h-4 w-1/3 bg-muted rounded" />
                <div className="h-8 w-full bg-muted rounded mt-6" />
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
        {!isLoading && !isError && (!tournaments || tournaments.length === 0) && (
          <div className="rounded-xl border border-border bg-card p-12 text-center space-y-4">
            <div className="text-4xl">♚</div>
            <h3 className="text-lg font-semibold text-foreground">No tournaments yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Get started by creating your first academy tournament for students to join.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Create Tournament
            </button>
          </div>
        )}

        {/* Tournaments Grid */}
        {!isLoading && !isError && tournaments && tournaments.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-foreground text-lg line-clamp-1">{t.name}</h2>
                    {getStatusBadge(t.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Clock:</span> {t.timeControl}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Enrolled:</span> {t.participantsCount} players
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-foreground">Start:</span>{' '}
                      {new Date(t.startDate).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="pt-5 border-t border-border/50 mt-4 flex items-center justify-between">
                  <Link
                    href={`/coach/tournaments/${t.id}`}
                    className="inline-flex items-center text-xs font-semibold text-primary hover:underline"
                  >
                    Manage Tournament →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Tournament Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Create Tournament</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-lg"
                >
                  ✕
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground" htmlFor="tname">
                    Tournament Name
                  </label>
                  <input
                    id="tname"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kingdom Winter Arena 2026"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground" htmlFor="ttime">
                      Time Control
                    </label>
                    <select
                      id="ttime"
                      value={timeControl}
                      onChange={(e) => setTimeControl(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="5+0">5+0 (5 min rapid)</option>
                      <option value="3+0">3+0 (3 min blitz)</option>
                      <option value="3+2">3+2 (3 min + 2s)</option>
                      <option value="10+0">10+0 (10 min standard)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground" htmlFor="tstatus">
                      Initial Status
                    </label>
                    <select
                      id="tstatus"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="open">Open (Students can join)</option>
                      <option value="draft">Draft (Private)</option>
                      <option value="ongoing">Ongoing (Live games)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground" htmlFor="tdate">
                    Start Date & Time
                  </label>
                  <input
                    id="tdate"
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-md border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Save & Publish'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
