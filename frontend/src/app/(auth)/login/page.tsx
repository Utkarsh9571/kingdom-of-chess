'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useSocket } from '@/context/SocketContext';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { reconnectSocket } = useSocket();

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data.user);
      reconnectSocket();
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-brand-cream/30 pl-3.5 pr-10 py-2.5 text-sm text-brand-navy font-medium placeholder:text-brand-text-muted/60 focus:border-brand-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-navy focus:outline-none p-1 rounded-md transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-bold text-brand-orange hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
