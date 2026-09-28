'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold">
            ♚
          </div>
          <h1 className="text-2xl font-bold text-foreground">Sign In to Academy</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Access tournament dashboard and live match arena
          </p>
        </div>

        {/* Quick-fill accounts panel */}
        <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quick-Fill Seeded Accounts
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickFill('coach@kingdom.com')}
              className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-left font-medium text-amber-300 hover:bg-amber-500/20"
            >
              ♚ Coach Garry
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('student1@kingdom.com')}
              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-left font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              ♟ Anand Jr. (Student)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('student2@kingdom.com')}
              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-left font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              ♟ Pragg R. (Student)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('student3@kingdom.com')}
              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-left font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              ♟ Gukesh D. (Student)
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="user@kingdom.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow"
          >
            {loginMutation.isPending ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
