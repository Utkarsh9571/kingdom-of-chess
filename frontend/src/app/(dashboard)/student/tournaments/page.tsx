'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  Swords,
  Clock,
  Users,
  Calendar,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api, Tournament } from '@/lib/api';
import { Navbar } from '@/components/Navbar';

export default function StudentTournamentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [joinMsg, setJoinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    data: tournaments,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['tournaments'],
    queryFn: api.getTournaments,
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => api.joinTournament(id),
    onSuccess: () => {
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

  const getStatusBadge = (st: Tournament['status']) => {
    switch (st) {
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
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-brand-cream-dark px-3 py-1 text-xs font-bold text-brand-text-muted border border-brand-border">
            {st}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col selection:bg-brand-orange/20 selection:text-brand-navy">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-8 space-y-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-border pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-orange">
              <Swords className="h-3.5 w-3.5" />
              <span>Academy Arena</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-navy">
              Chess Tournaments
            </h1>
            <p className="text-sm text-brand-text-muted font-medium">
              Browse official tournaments, self-register, and compete for leaderboard glory.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="inline-flex rounded-full border border-brand-border bg-white p-1.5 shadow-soft self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-brand-navy text-white shadow-sm'
                  : 'text-brand-text-muted hover:text-brand-navy'
              }`}
            >
              All Tournaments
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
                activeTab === 'my'
                  ? 'bg-brand-navy text-white shadow-sm'
                  : 'text-brand-text-muted hover:text-brand-navy'
              }`}
            >
              My Registered ({tournaments?.filter((t) => t.isEnrolled).length || 0})
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {joinMsg && (
          <div
            className={`rounded-2xl p-4 text-xs font-bold flex items-center gap-2.5 ${
              joinMsg.type === 'success'
                ? 'border border-brand-teal/30 bg-brand-teal-light text-brand-teal'
                : 'border border-destructive/30 bg-brand-pink-light text-destructive'
            }`}
          >
            {joinMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{joinMsg.text}</span>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 rounded-3xl border border-brand-border bg-white p-6 shadow-soft animate-pulse space-y-4"
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
        {!isLoading && !isError && displayedTournaments.length === 0 && (
          <div className="rounded-3xl border border-brand-border bg-white p-12 text-center space-y-4 shadow-soft max-w-md mx-auto">
            <div className="h-16 w-16 rounded-3xl bg-brand-cream text-brand-orange flex items-center justify-center mx-auto text-2xl">
              ♟
            </div>
            <h3 className="text-xl font-bold text-brand-navy">
              {activeTab === 'my' ? 'No registered tournaments' : 'No tournaments available'}
            </h3>
            <p className="text-xs sm:text-sm text-brand-text-muted font-medium">
              {activeTab === 'my'
                ? 'Browse available tournaments and click "Join" to enroll in upcoming events.'
                : 'Check back soon for new tournaments scheduled by academy coaches.'}
            </p>
          </div>
        )}

        {/* Tournaments Grid */}
        {!isLoading && !isError && displayedTournaments.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayedTournaments.map((t) => (
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
                        <span>Competitors</span>
                      </div>
                      <div className="text-sm font-extrabold text-brand-navy">
                        {t.participantsCount} Students
                      </div>
                    </div>

                    <div className="col-span-2 rounded-xl border border-brand-border/80 bg-brand-cream/40 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-brand-text-muted font-semibold">
                        <Calendar className="h-3.5 w-3.5 text-brand-green" />
                        <span>Scheduled</span>
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

                <div className="pt-5 border-t border-brand-border/60 mt-5 flex items-center justify-between gap-3">
                  {t.isEnrolled ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal-light px-3 py-1 text-xs font-bold text-brand-teal border border-brand-teal/20">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Enrolled</span>
                    </div>
                  ) : t.status === 'open' ? (
                    <button
                      onClick={() => joinMutation.mutate(t.id)}
                      disabled={joinMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange bg-brand-orange-light px-4 py-1.5 text-xs font-bold text-brand-orange hover:bg-brand-orange hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <span>Join</span>
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-brand-text-muted">Closed</span>
                  )}

                  <Link
                    href={`/student/tournaments/${t.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy hover:text-brand-orange transition-colors group/link ml-auto"
                  >
                    <span>Tournament Hub</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
