'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  Plus,
  Clock,
  Users,
  Calendar,
  ArrowRight,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
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

  const {
    data: tournaments,
    isLoading,
    isError,
    error,
  } = useQuery({
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
        return (
          <span className="inline-flex items-center rounded-full bg-brand-cream-dark px-3 py-1 text-xs font-bold text-brand-text-muted border border-brand-border">
            Draft
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center rounded-full bg-brand-teal-light px-3 py-1 text-xs font-bold text-brand-teal border border-brand-teal/30">
            Open
          </span>
        );
      case 'ongoing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange-light px-3 py-1 text-xs font-bold text-brand-orange border border-brand-orange/30">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange animate-pulse" />
            Ongoing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center rounded-full bg-brand-green-light px-3 py-1 text-xs font-bold text-brand-green border border-brand-green/30">
            Completed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col selection:bg-brand-orange/20 selection:text-brand-navy">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-8 space-y-8 max-w-7xl">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-border pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-orange">
              <Trophy className="h-3.5 w-3.5" />
              <span>Coach Administration</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-navy">
              Tournament Management
            </h1>
            <p className="text-sm text-brand-text-muted font-medium">
              Create, configure, and oversee live 1-on-1 chess tournaments for your students.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-6 py-3 text-sm font-bold text-white shadow-orange hover:bg-brand-orange-hover hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Create Tournament</span>
          </button>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-52 rounded-2xl border border-brand-border bg-white p-6 shadow-soft animate-pulse space-y-4"
              >
                <div className="h-5 w-2/3 bg-brand-cream-dark rounded-full" />
                <div className="h-4 w-1/3 bg-brand-cream-dark rounded-full" />
                <div className="h-10 w-full bg-brand-cream rounded-xl mt-6" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="rounded-2xl border border-destructive/30 bg-brand-pink-light p-5 text-sm font-semibold text-destructive flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>Failed to load tournaments: {(error as Error).message}</span>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && (!tournaments || tournaments.length === 0) && (
          <div className="rounded-3xl border border-brand-border bg-white p-12 text-center space-y-4 shadow-soft max-w-lg mx-auto">
            <div className="h-16 w-16 rounded-3xl bg-brand-orange-light text-brand-orange flex items-center justify-center mx-auto shadow-sm">
              <Trophy className="h-8 w-8 stroke-[2]" />
            </div>
            <h3 className="text-xl font-bold text-brand-navy">No tournaments yet</h3>
            <p className="text-sm text-brand-text-muted font-medium">
              Get started by creating your first academy tournament for students to join.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-2.5 text-xs font-bold text-white shadow-orange hover:bg-brand-orange-hover transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Create First Tournament</span>
              </button>
            </div>
          </div>
        )}

        {/* Tournaments Grid */}
        {!isLoading && !isError && tournaments && tournaments.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-3xl border border-brand-border bg-white p-6 shadow-soft hover:shadow-soft-md hover:border-brand-orange/40 transition-all group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-bold text-brand-navy text-lg leading-snug line-clamp-2 group-hover:text-brand-orange transition-colors">
                      {t.name}
                    </h2>
                    {getStatusBadge(t.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-brand-border/80 bg-brand-cream/40 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-brand-text-muted font-semibold">
                        <Clock className="h-3.5 w-3.5 text-brand-teal" />
                        <span>Time Control</span>
                      </div>
                      <div className="text-sm font-extrabold text-brand-navy">{t.timeControl}</div>
                    </div>

                    <div className="rounded-xl border border-brand-border/80 bg-brand-cream/40 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-brand-text-muted font-semibold">
                        <Users className="h-3.5 w-3.5 text-brand-orange" />
                        <span>Enrolled</span>
                      </div>
                      <div className="text-sm font-extrabold text-brand-navy">
                        {t.participantsCount} Students
                      </div>
                    </div>

                    <div className="col-span-2 rounded-xl border border-brand-border/80 bg-brand-cream/40 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-brand-text-muted font-semibold">
                        <Calendar className="h-3.5 w-3.5 text-brand-green" />
                        <span>Starts</span>
                      </div>
                      <div className="text-xs font-bold text-brand-navy">
                        {new Date(t.startDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-5 border-t border-brand-border/60 mt-5 flex items-center justify-between">
                  <span className="text-[11px] font-mono font-medium text-brand-text-muted">
                    #{t.id.slice(0, 8)}
                  </span>
                  <Link
                    href={`/coach/tournaments/${t.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy hover:text-brand-orange transition-colors group/link"
                  >
                    <span>Manage Details</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Tournament Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl border border-brand-border bg-white p-6 sm:p-8 shadow-soft-lg space-y-6">
              <div className="flex items-center justify-between border-b border-brand-border pb-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-orange">
                    New Competition
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-brand-navy">
                    Create Tournament
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-2 text-brand-text-muted hover:bg-brand-cream hover:text-brand-navy transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-destructive/30 bg-brand-pink-light p-3.5 text-xs font-semibold text-destructive">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-navy">Tournament Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kingdom Autumn Rapid 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-brand-cream/30 px-3.5 py-2.5 text-sm text-brand-navy font-medium focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-brand-navy">Time Control</label>
                    <select
                      value={timeControl}
                      onChange={(e) => setTimeControl(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-brand-cream/30 px-3.5 py-2.5 text-sm text-brand-navy font-medium focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                    >
                      <option value="5+0">5+0 Rapid (5 min)</option>
                      <option value="3+0">3+0 Blitz (3 min)</option>
                      <option value="3+2">3+2 Blitz with increment</option>
                      <option value="10+0">10+0 Rapid (10 min)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-brand-navy">Initial Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full rounded-xl border border-brand-border bg-brand-cream/30 px-3.5 py-2.5 text-sm text-brand-navy font-medium focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                    >
                      <option value="open">Open (Accepting Players)</option>
                      <option value="draft">Draft (Visible only to you)</option>
                      <option value="ongoing">Ongoing (Active Matchmaking)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-navy">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-brand-cream/30 px-3.5 py-2.5 text-sm text-brand-navy font-medium focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-full border border-brand-border bg-white px-5 py-2.5 text-xs font-bold text-brand-navy hover:bg-brand-cream-dark transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="rounded-full bg-brand-orange px-6 py-2.5 text-xs font-bold text-white shadow-orange hover:bg-brand-orange-hover disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Tournament'}
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
