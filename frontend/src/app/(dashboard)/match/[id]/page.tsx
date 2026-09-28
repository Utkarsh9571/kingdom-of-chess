'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Chessboard } from 'react-chessboard';
import { api, MatchDetails } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { useSocket } from '@/context/SocketContext';

export default function MatchArenaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { socket, isConnected } = useSocket();
  const [matchState, setMatchState] = useState<Partial<MatchDetails> | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [userColor, setUserColor] = useState<'white' | 'black' | 'observer' | 'coach'>('white');

  // Fetch initial match details via REST
  const {
    data: initialMatch,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.getMatch(id),
    enabled: !!id,
    retry: 1,
  });

  // Keep state synced with REST response
  useEffect(() => {
    if (initialMatch) {
      setMatchState(initialMatch);
      setUserColor(initialMatch.userRole);
    }
  }, [initialMatch]);

  // Handle Socket.IO room joining and real-time state
  useEffect(() => {
    if (!socket || !isConnected || !id) return;

    // Join the match room
    socket.emit('match:join', { matchId: id });

    const handleMatchJoined = (data: any) => {
      console.log('[Socket] Successfully joined match room:', data);
      setJoinError(null);
      if (data.color === 'w') setUserColor('white');
      else if (data.color === 'b') setUserColor('black');
      else setUserColor('observer');

      setMatchState((prev) => ({
        ...prev,
        ...data,
      }));
    };

    const handleMatchState = (data: any) => {
      console.log('[Socket] Received match:state update:', data);
      setMatchState((prev) => ({
        ...prev,
        ...data,
      }));
    };

    const handleMatchError = (err: { code: string; message: string }) => {
      console.error('[Socket] Match room error:', err);
      setJoinError(err.message || 'Failed to join match room');
    };

    socket.on('match:joined', handleMatchJoined);
    socket.on('match:state', handleMatchState);
    socket.on('match:error', handleMatchError);

    return () => {
      socket.off('match:joined', handleMatchJoined);
      socket.off('match:state', handleMatchState);
      socket.off('match:error', handleMatchError);
    };
  }, [socket, isConnected, id]);

  const activeMatch = matchState || initialMatch;

  const boardOrientation = userColor === 'black' ? 'black' : 'white';

  const formatClock = (ms?: number) => {
    if (ms === undefined || ms === null) return '05:00';
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-6 space-y-6 max-w-6xl">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {activeMatch?.tournamentId ? (
                <Link
                  href={`/student/tournaments/${activeMatch.tournamentId}`}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  ← Back to Tournament Hub
                </Link>
              ) : (
                <Link href="/student/tournaments" className="hover:text-primary transition-colors">
                  ← Back to Tournaments
                </Link>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-3">
              <span>{activeMatch?.tournamentName || 'Live Chess Arena'}</span>
              <span className="rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 text-xs font-semibold uppercase">
                {activeMatch?.status || 'in_progress'}
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                }`}
              />
              <span className="text-muted-foreground">
                {isConnected ? 'Real-Time Connected' : 'Connecting...'}
              </span>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-400">
              TimeControl: {activeMatch?.timeControl || '5+0'}
            </div>
          </div>
        </div>

        {/* Error States */}
        {joinError && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
            <span className="text-xl">🚫</span>
            <div>
              <div className="font-bold">Access Denied</div>
              <div>{joinError}</div>
            </div>
          </div>
        )}

        {isError && !joinError && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load match: {(error as Error)?.message}
          </div>
        )}

        {/* Arena Body */}
        {!isLoading && activeMatch && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Chessboard Column */}
            <div className="lg:col-span-8 flex flex-col items-center space-y-4">
              {/* Opponent Card (Top) */}
              <div className="w-full max-w-[560px] rounded-xl border border-border bg-card p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-lg border border-zinc-700">
                    {boardOrientation === 'white' ? '♚' : '♔'}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">
                      {boardOrientation === 'white'
                        ? activeMatch.blackPlayer?.name || 'Player Black'
                        : activeMatch.whitePlayer?.name || 'Player White'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {boardOrientation === 'white' ? 'Playing Black' : 'Playing White'}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 font-mono text-base font-bold text-foreground">
                  {boardOrientation === 'white'
                    ? formatClock(activeMatch.blackTimeRemainingMs)
                    : formatClock(activeMatch.whiteTimeRemainingMs)}
                </div>
              </div>

              {/* Dedicated Chessboard Container */}
              <div className="w-full max-w-[560px] aspect-square rounded-2xl overflow-hidden border-2 border-border shadow-2xl bg-zinc-900 flex items-center justify-center">
                <Chessboard
                  position={activeMatch.currentFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
                  boardOrientation={boardOrientation}
                  arePiecesDraggable={false}
                  customBoardStyle={{
                    borderRadius: '8px',
                    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
                  }}
                  customDarkSquareStyle={{ backgroundColor: '#779952' }}
                  customLightSquareStyle={{ backgroundColor: '#edeed1' }}
                />
              </div>

              {/* Current Player Card (Bottom) */}
              <div className="w-full max-w-[560px] rounded-xl border border-amber-500/30 bg-card p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-lg border border-amber-500/40 text-amber-300">
                    {boardOrientation === 'white' ? '♔' : '♚'}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <span>
                        {boardOrientation === 'white'
                          ? activeMatch.whitePlayer?.name || 'Player White (You)'
                          : activeMatch.blackPlayer?.name || 'Player Black (You)'}
                      </span>
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                        YOU
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {boardOrientation === 'white' ? 'Playing White (Bottom)' : 'Playing Black (Bottom)'}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-900 border border-amber-500/30 px-3.5 py-1.5 font-mono text-base font-bold text-amber-300">
                  {boardOrientation === 'white'
                    ? formatClock(activeMatch.whiteTimeRemainingMs)
                    : formatClock(activeMatch.blackTimeRemainingMs)}
                </div>
              </div>
            </div>

            {/* Sidebar / Match Details */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="font-bold text-base text-foreground flex items-center justify-between">
                  <span>Match Information</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    #{activeMatch.id?.slice(0, 8)}
                  </span>
                </h3>

                <div className="space-y-2 text-xs border-y border-border py-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tournament</span>
                    <span className="font-medium text-foreground">{activeMatch.tournamentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Color</span>
                    <span className="font-bold text-amber-400 capitalize">{userColor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Match Status</span>
                    <span className="font-semibold text-emerald-400 capitalize">
                      {activeMatch.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Turn</span>
                    <span className="font-semibold text-foreground">
                      {activeMatch.activeTurn === 'w' ? 'White to move' : 'Black to move'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">PGN Move History</div>
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 min-h-[140px] text-xs font-mono text-zinc-300">
                    {activeMatch.pgn ? (
                      <p className="whitespace-pre-wrap">{activeMatch.pgn}</p>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-center py-8">
                        Auto-paired! Live game engine starts in Phase 5.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300 flex items-center gap-2">
                    <span>✓</span>
                    <span>Matched and synchronized in real-time over Socket.IO.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
