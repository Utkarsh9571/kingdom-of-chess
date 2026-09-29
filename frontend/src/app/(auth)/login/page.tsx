'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, User, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('coach@kingdom.com');
  const [password, setPassword] = useState('Password123!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data.user);
      if (data.user.role === 'COACH') {
        router.push('/coach/tournaments');
      } else {
        router.push('/student/tournaments');
      }
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    loginMutation.mutate({ email, password });
  };

  const handleQuickFill = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('Password123!');
    setErrorMessage(null);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-brand-cream selection:bg-brand-orange/20 selection:text-brand-navy">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange to-[#FF8533] text-white shadow-md shadow-brand-orange/25 group-hover:scale-105 transition-transform">
              <Crown className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-xl tracking-tight text-brand-navy leading-none">
                KINGDOM
              </span>
              <span className="text-[11px] font-bold tracking-[0.2em] text-brand-orange leading-none mt-1">
                OF CHESS
              </span>
            </div>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight mt-2">
              Sign In to Academy
            </h1>
            <p className="text-xs sm:text-sm text-brand-text-muted font-medium mt-1">
              Access the tournament dashboard and live match arena
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-brand-border bg-white p-6 sm:p-8 shadow-soft-md space-y-6">
          {/* Quick-fill accounts panel */}
          <div className="rounded-2xl border border-brand-border/80 bg-brand-cream/60 p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-navy uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-brand-orange" />
              <span>One-Click Development Logins</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('coach@kingdom.com')}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left font-bold transition-all ${
                  email === 'coach@kingdom.com'
                    ? 'border-brand-navy bg-brand-navy text-white shadow-sm'
                    : 'border-brand-border bg-white text-brand-navy hover:border-brand-navy/30 hover:bg-brand-cream'
                }`}
              >
                <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Coach Garry</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('student1@kingdom.com')}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left font-bold transition-all ${
                  email === 'student1@kingdom.com'
                    ? 'border-brand-teal bg-brand-teal text-white shadow-sm'
                    : 'border-brand-border bg-white text-brand-navy hover:border-brand-teal/30 hover:bg-brand-cream'
                }`}
              >
                <User className="h-3.5 w-3.5 text-brand-teal shrink-0" />
                <span className="truncate">Utkarsh S.</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('student2@kingdom.com')}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left font-bold transition-all ${
                  email === 'student2@kingdom.com'
                    ? 'border-brand-teal bg-brand-teal text-white shadow-sm'
                    : 'border-brand-border bg-white text-brand-navy hover:border-brand-teal/30 hover:bg-brand-cream'
                }`}
              >
                <User className="h-3.5 w-3.5 text-brand-teal shrink-0" />
                <span className="truncate">Priyal M.</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('student3@kingdom.com')}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left font-bold transition-all ${
                  email === 'student3@kingdom.com'
                    ? 'border-brand-teal bg-brand-teal text-white shadow-sm'
                    : 'border-brand-border bg-white text-brand-navy hover:border-brand-teal/30 hover:bg-brand-cream'
                }`}
              >
                <User className="h-3.5 w-3.5 text-brand-teal shrink-0" />
                <span className="truncate">Gukesh D.</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="rounded-xl border border-destructive/30 bg-brand-pink-light p-3.5 text-xs font-semibold text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-navy" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-brand-border bg-brand-cream/30 px-3.5 py-2.5 text-sm text-brand-navy font-medium placeholder:text-brand-text-muted/60 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all"
                placeholder="name@kingdom.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-brand-navy" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-brand-border bg-brand-cream/30 px-3.5 py-2.5 text-sm text-brand-navy font-medium placeholder:text-brand-text-muted/60 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange py-3 text-sm font-bold text-white shadow-orange hover:bg-brand-orange-hover hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer mt-2"
            >
              {loginMutation.isPending ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-brand-text-muted font-medium">
          New to the academy? Contact your coach or administrator.
        </p>
      </div>
    </div>
  );
}
