'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Chessboard } from 'react-chessboard';
import {
  Clock,
  Swords,
  Trophy,
  ArrowLeft,
  AlertCircle,
  Shield,
  Zap,
  CheckCircle2,
  User,
  Crown,
  Flag,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { api, MatchDetails } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { useSocket } from '@/context/SocketContext';

function parsePgnToMoves(pgn?: string): Array<{ num: number; white: string; black?: string }> {
  if (!pgn) return [];
  const cleanPgn = pgn.replace(/\[.*?\]/g, '').trim();
  if (!cleanPgn) return [];

  const tokens = cleanPgn.split(/\s+/).filter(Boolean);
  const moves: Array<{ num: number; white: string; black?: string }> = [];

  let currentMoveNum: number | null = null;
  let currentWhite: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.includes('.')) {
      const numPart = parseInt(token.replace('.', ''), 10);
      if (!isNaN(numPart)) {
        currentMoveNum = numPart;
        const remainder = token.split('.')[1];
        if (remainder) {
          currentWhite = remainder;
          const next = tokens[i + 1];
          if (next && !next.includes('.') && !next.match(/^(1-0|0-1|1\/2-1\/2|\*)$/)) {
            moves.push({ num: currentMoveNum, white: remainder, black: next });
            i++;
          } else {
            moves.push({ num: currentMoveNum, white: remainder });
          }
          currentMoveNum = null;
          currentWhite = null;
        }
        continue;
      }
    }

    if (token.match(/^(1-0|0-1|1\/2-1\/2|\*)$/)) {
      break;
    }

    if (currentMoveNum !== null) {
      if (!currentWhite) {
        currentWhite = token;
        const next = tokens[i + 1];
        if (next && !next.includes('.') && !next.match(/^(1-0|0-1|1\/2-1\/2|\*)$/)) {
          moves.push({ num: currentMoveNum, white: token, black: next });
          i++;
        } else {
          moves.push({ num: currentMoveNum, white: token });
        }
        currentMoveNum = null;
        currentWhite = null;
      }
    }
  }

  return moves;
}

export default function MatchArenaPage() {
  const params = useParams();
  const id = params?.id as string;

  const { socket, isConnected } = useSocket();
  const [matchState, setMatchState] = useState<Partial<MatchDetails> | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [userColor, setUserColor] = useState<'white' | 'black' | 'observer' | 'coach'>('white');
  const [showResignModal, setShowResignModal] = useState(false);
  const [isResigning, setIsResigning] = useState(false);

  // Wall-clock ticker to update displayed timers without drift
  const [now, setNow] = useState(Date.now());

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

  const activeMatch = matchState || initialMatch;

  // Local ticker for live clocks while in_progress
  useEffect(() => {
    if (activeMatch?.status !== 'in_progress') return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 200);
    return () => clearInterval(interval);
  }, [activeMatch?.status]);

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
      setMoveError(null);
    };

    const handleMatchMoved = (data: any) => {
      console.log('[Socket] Received match:moved event:', data);
      setMatchState((prev) => ({
        ...prev,
        ...data,
      }));
      setMoveError(null);
    };

    const handleMatchEnded = (data: any) => {
      console.log('[Socket] Received match:ended event:', data);
      setMatchState((prev) => ({
        ...prev,
        status: 'completed',
        result: data.result,
        reason: data.reason,
        winnerId: data.winnerId,
        pgn: data.pgn || prev?.pgn,
      }));
      setShowResignModal(false);
    };

    const handleMatchError = (err: { code: string; message: string }) => {
      console.error('[Socket] Match room error:', err);
      if (err.code === 'INVALID_MOVE' || err.code === 'MOVE_ERROR') {
        setMoveError(err.message || 'Illegal or rejected move');
        setTimeout(() => setMoveError(null), 4000);
      } else {
        setJoinError(err.message || 'Failed to join match room');
      }
    };

    socket.on('match:joined', handleMatchJoined);
    socket.on('match:state', handleMatchState);
    socket.on('match:moved', handleMatchMoved);
    socket.on('match:ended', handleMatchEnded);
    socket.on('match:error', handleMatchError);

    return () => {
      socket.off('match:joined', handleMatchJoined);
      socket.off('match:state', handleMatchState);
      socket.off('match:moved', handleMatchMoved);
      socket.off('match:ended', handleMatchEnded);
      socket.off('match:error', handleMatchError);
    };
  }, [socket, isConnected, id]);

  const boardOrientation = userColor === 'black' ? 'black' : 'white';

  // Compute authoritative, drift-free clocks
  const { whiteDisplayMs, blackDisplayMs } = useMemo(() => {
    let whiteMs = activeMatch?.whiteTimeRemainingMs ?? 300000;
    let blackMs = activeMatch?.blackTimeRemainingMs ?? 300000;

    if (activeMatch?.status === 'in_progress' && activeMatch?.lastTurnStartTime) {
      const elapsed = Math.max(0, now - new Date(activeMatch.lastTurnStartTime).getTime());
      if (activeMatch.activeTurn === 'w') {
        whiteMs = Math.max(0, whiteMs - elapsed);
      } else if (activeMatch.activeTurn === 'b') {
        blackMs = Math.max(0, blackMs - elapsed);
      }
    }

    return { whiteDisplayMs: whiteMs, blackDisplayMs: blackMs };
  }, [activeMatch, now]);

  const formatClock = (ms?: number) => {
    if (ms === undefined || ms === null) return '05:00';
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isMyTurn =
    activeMatch?.status === 'in_progress' &&
    ((userColor === 'white' && activeMatch?.activeTurn === 'w') ||
      (userColor === 'black' && activeMatch?.activeTurn === 'b'));

  const isDraggablePiece = ({ piece }: { piece: string }) => {
    if (activeMatch?.status !== 'in_progress') return false;
    if (!isMyTurn) return false;
    if (userColor === 'white' && piece.startsWith('w')) return true;
    if (userColor === 'black' && piece.startsWith('b')) return true;
    return false;
  };

  // Handle piece drop with auto queen promotion
  const onPieceDrop = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    if (!isMyTurn || activeMatch?.status !== 'in_progress') return false;

    // Detect pawn promotion
    const isPawn = piece[1]?.toLowerCase() === 'p';
    const isPromotion =
      isPawn &&
      ((piece[0] === 'w' && targetSquare.endsWith('8')) ||
        (piece[0] === 'b' && targetSquare.endsWith('1')));
    const promotion = isPromotion ? 'q' : undefined;

    socket?.emit('match:move', {
      matchId: id,
      from: sourceSquare,
      to: targetSquare,
      promotion,
    });

    return true;
  };

  const handleResign = () => {
    if (!socket || !id || isResigning) return;
    setIsResigning(true);
    socket.emit('match:resign', { matchId: id }, () => {
      setIsResigning(false);
      setShowResignModal(false);
    });
  };

  // Parse moves from PGN
  const parsedMoves = useMemo(() => parsePgnToMoves(activeMatch?.pgn), [activeMatch?.pgn]);

  // Determine game-end card details
  const gameEndInfo = useMemo(() => {
    if (activeMatch?.status !== 'completed') return null;

    const result = activeMatch.result;
    const reason = activeMatch.reason;
    const isDraw = result === 'draw';
    const won =
      (result === 'white_win' && userColor === 'white') ||
      (result === 'black_win' && userColor === 'black');

    let title = 'Game Finished';
    let subtitle = '';
    let isWinner = false;

    if (isDraw) {
      title = 'Match Drawn';
      subtitle = reason === 'stalemate' ? 'Drawn by Stalemate' : 'Drawn by Agreement or Repetition';
    } else if (won) {
      isWinner = true;
      title = 'Victory! You Won';
      subtitle =
        reason === 'checkmate'
          ? 'Checkmate! Beautiful checkmate.'
          : reason === 'timeout'
          ? 'Opponent ran out of time.'
          : 'Opponent resigned.';
    } else if (userColor === 'white' || userColor === 'black') {
      title = 'Match Lost';
      subtitle =
        reason === 'checkmate'
          ? 'You were checkmated.'
          : reason === 'timeout'
          ? 'You ran out of time.'
          : 'You resigned.';
    } else {
      title = result === 'white_win' ? 'White Won' : 'Black Won';
      subtitle = `Decided by ${reason || 'normal play'}`;
    }

    return { title, subtitle, isWinner, isDraw };
  }, [activeMatch, userColor]);

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col selection:bg-brand-orange/20 selection:text-brand-navy">
      <Navbar />

      <main className="container mx-auto flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-text-muted">
              {activeMatch?.tournamentId ? (
                <Link
                  href={`/student/tournaments/${activeMatch.tournamentId}`}
                  className="hover:text-brand-orange transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Tournament Hub</span>
                </Link>
              ) : (
                <Link
                  href="/student/tournaments"
                  className="hover:text-brand-orange transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Tournaments</span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy">
                {activeMatch?.tournamentName || 'Live Chess Arena'}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold border ${
                  activeMatch?.status === 'in_progress'
                    ? 'bg-brand-teal-light text-brand-teal border-brand-teal/30'
                    : 'bg-brand-cream-dark text-brand-navy border-brand-border'
                }`}
              >
                {activeMatch?.status === 'in_progress' ? 'Live In Progress' : activeMatch?.status?.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-brand-border bg-white px-3.5 py-1.5 text-xs font-bold shadow-soft">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? 'bg-brand-green animate-pulse' : 'bg-destructive'
                }`}
              />
              <span className="text-brand-navy">
                {isConnected ? 'Real-Time Connected' : 'Connecting...'}
              </span>
            </div>

            <div className="rounded-full bg-brand-orange-light border border-brand-orange/30 px-3.5 py-1.5 text-xs font-extrabold text-brand-orange shadow-sm">
              Clock: {activeMatch?.timeControl || '5+0'}
            </div>
          </div>
        </div>

        {/* Error States */}
        {joinError && (
          <div className="rounded-2xl border border-destructive/30 bg-brand-pink-light p-4 text-xs font-bold text-destructive flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <div className="font-extrabold">Access Denied</div>
              <div>{joinError}</div>
            </div>
          </div>
        )}

        {moveError && (
          <div className="rounded-2xl border border-destructive/30 bg-brand-pink-light p-3.5 text-xs font-bold text-destructive flex items-center gap-2.5 animate-bounce">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Move Rejected: {moveError}</span>
          </div>
        )}

        {isError && !joinError && (
          <div className="rounded-2xl border border-destructive/30 bg-brand-pink-light p-4 text-xs font-bold text-destructive">
            Failed to load match: {(error as Error)?.message}
          </div>
        )}

        {/* Game Completed Banner */}
        {gameEndInfo && (
          <div
            className={`rounded-3xl p-6 border-2 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-soft-lg ${
              gameEndInfo.isWinner
                ? 'bg-gradient-to-r from-brand-orange-light via-white to-brand-cream border-brand-orange'
                : gameEndInfo.isDraw
                ? 'bg-brand-teal-light border-brand-teal/40'
                : 'bg-white border-brand-border'
            }`}
          >
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div
                className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl border font-bold ${
                  gameEndInfo.isWinner
                    ? 'bg-brand-orange text-white border-brand-orange'
                    : 'bg-brand-cream text-brand-navy border-brand-border'
                }`}
              >
                {gameEndInfo.isWinner ? <Crown className="h-8 w-8 text-yellow-300" /> : <Trophy className="h-7 w-7 text-brand-navy" />}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-brand-navy">{gameEndInfo.title}</h2>
                <p className="text-xs font-bold text-brand-text-muted mt-0.5">{gameEndInfo.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeMatch?.tournamentId && (
                <Link
                  href={`/student/tournaments/${activeMatch.tournamentId}`}
                  className="rounded-xl bg-brand-orange hover:bg-brand-orange-dark text-white font-extrabold text-xs px-5 py-2.5 shadow-soft transition-all"
                >
                  Return to Tournament Hub
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Arena Body */}
        {!isLoading && activeMatch && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT / PRIMARY AREA: Chessboard Column */}
            <div className="lg:col-span-8 flex flex-col items-center space-y-4">
              {/* Opponent Card (Top) */}
              <div className="w-full max-w-[560px] rounded-2xl border border-brand-border bg-white p-4 flex items-center justify-between shadow-soft">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-cream-dark text-brand-navy text-xl border border-brand-border font-bold">
                    {boardOrientation === 'white' ? '♚' : '♔'}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-brand-navy">
                      {boardOrientation === 'white'
                        ? activeMatch.blackPlayer?.name || 'Player Black'
                        : activeMatch.whitePlayer?.name || 'Player White'}
                    </div>
                    <div className="text-[11px] font-semibold text-brand-text-muted">
                      {boardOrientation === 'white' ? 'Playing Black' : 'Playing White'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!isMyTurn && activeMatch.status === 'in_progress' && (
                    <span className="hidden sm:inline-block rounded-full bg-brand-orange-light px-2.5 py-0.5 text-[10px] font-bold text-brand-orange border border-brand-orange/30 animate-pulse">
                      Active Turn
                    </span>
                  )}
                  <div className="rounded-xl bg-brand-cream border border-brand-border px-4 py-2 font-mono text-lg font-extrabold text-brand-navy shadow-inner">
                    {boardOrientation === 'white'
                      ? formatClock(blackDisplayMs)
                      : formatClock(whiteDisplayMs)}
                  </div>
                </div>
              </div>

              {/* Dedicated Chessboard Container */}
              <div className="w-full max-w-[560px] aspect-square rounded-3xl overflow-hidden border-4 border-white shadow-soft-lg bg-white flex items-center justify-center p-1.5 sm:p-2">
                <div className="w-full h-full rounded-2xl overflow-hidden border border-brand-border/60">
                  <Chessboard
                    position={
                      activeMatch.currentFen ||
                      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
                    }
                    boardOrientation={boardOrientation}
                    arePiecesDraggable={isMyTurn && activeMatch.status === 'in_progress'}
                    isDraggablePiece={isDraggablePiece}
                    onPieceDrop={onPieceDrop}
                    customBoardStyle={{
                      borderRadius: '12px',
                    }}
                    customDarkSquareStyle={{ backgroundColor: '#B88B4A' }}
                    customLightSquareStyle={{ backgroundColor: '#F0D9B5' }}
                  />
                </div>
              </div>

              {/* Current Player Card (Bottom) */}
              <div className="w-full max-w-[560px] rounded-2xl border-2 border-brand-orange/40 bg-white p-4 flex items-center justify-between shadow-soft">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange-light text-brand-orange text-xl border border-brand-orange/30 font-bold shadow-sm">
                    {boardOrientation === 'white' ? '♔' : '♚'}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-brand-navy flex items-center gap-2">
                      <span>
                        {boardOrientation === 'white'
                          ? activeMatch.whitePlayer?.name || 'Player White (You)'
                          : activeMatch.blackPlayer?.name || 'Player Black (You)'}
                      </span>
                      <span className="rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-extrabold text-white uppercase tracking-wider">
                        YOU
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-brand-text-muted">
                      {boardOrientation === 'white'
                        ? 'Playing White (Bottom)'
                        : 'Playing Black (Bottom)'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isMyTurn && (
                    <span className="hidden sm:inline-block rounded-full bg-brand-orange px-2.5 py-0.5 text-[10px] font-extrabold text-white animate-pulse">
                      Your Turn!
                    </span>
                  )}
                  <div className="rounded-xl bg-brand-orange-light border border-brand-orange/30 px-4 py-2 font-mono text-lg font-extrabold text-brand-orange shadow-inner">
                    {boardOrientation === 'white'
                      ? formatClock(whiteDisplayMs)
                      : formatClock(blackDisplayMs)}
                  </div>
                </div>
              </div>

              {/* Game Action Controls: Resign Button */}
              {activeMatch.status === 'in_progress' && (userColor === 'white' || userColor === 'black') && (
                <div className="w-full max-w-[560px] flex justify-end">
                  <button
                    onClick={() => setShowResignModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-white hover:bg-brand-pink-light px-4 py-2 text-xs font-extrabold text-destructive transition-colors shadow-soft"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    <span>Resign Game</span>
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT / SECONDARY AREA: Sidebar / Match Details */}
            <div className="lg:col-span-4 space-y-6 w-full">
              <div className="rounded-3xl border border-brand-border bg-white p-6 sm:p-7 space-y-5 shadow-soft">
                <div className="flex items-center justify-between border-b border-brand-border pb-4">
                  <h3 className="font-extrabold text-lg text-brand-navy">Match Information</h3>
                  <span className="text-xs font-mono font-bold text-brand-text-muted">
                    #{activeMatch.id?.slice(0, 8)}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-brand-border/60">
                    <span className="font-semibold text-brand-text-muted">Tournament</span>
                    <span className="font-bold text-brand-navy">{activeMatch.tournamentName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-brand-border/60">
                    <span className="font-semibold text-brand-text-muted">Your Color</span>
                    <span className="font-extrabold text-brand-orange capitalize">{userColor}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-brand-border/60">
                    <span className="font-semibold text-brand-text-muted">Match Status</span>
                    <span className="font-bold text-brand-teal capitalize">
                      {activeMatch.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-semibold text-brand-text-muted">Turn</span>
                    <span className="font-extrabold text-brand-navy">
                      {activeMatch.status !== 'in_progress'
                        ? 'Match Concluded'
                        : activeMatch.activeTurn === 'w'
                        ? 'White to move'
                        : 'Black to move'}
                    </span>
                  </div>
                </div>

                {/* Structured Move List (Phase 10) */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-brand-navy uppercase tracking-wider">
                      Move History
                    </div>
                    <span className="text-[10px] font-extrabold text-brand-text-muted bg-brand-cream px-2 py-0.5 rounded-full border border-brand-border">
                      {parsedMoves.length} Rounds
                    </span>
                  </div>

                  <div className="rounded-2xl bg-brand-cream border border-brand-border p-3 max-h-[220px] overflow-y-auto text-xs font-mono text-brand-navy leading-relaxed">
                    {parsedMoves.length > 0 ? (
                      <div className="grid grid-cols-12 gap-y-1.5 py-1">
                        {parsedMoves.map((m) => (
                          <React.Fragment key={m.num}>
                            <div className="col-span-2 text-brand-text-muted font-bold text-right pr-2">
                              {m.num}.
                            </div>
                            <div className="col-span-5 font-bold text-brand-navy px-1 rounded hover:bg-brand-cream-dark">
                              {m.white}
                            </div>
                            <div className="col-span-5 font-bold text-brand-orange px-1 rounded hover:bg-brand-cream-dark">
                              {m.black || ''}
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-brand-text-muted text-center py-8 font-medium">
                        Paired & synchronized. Moves will record here during play.
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw PGN Collapsible / Subtext */}
                {activeMatch.pgn && (
                  <div className="text-[11px] font-mono text-brand-text-muted break-words bg-brand-cream-dark/50 p-2.5 rounded-xl border border-brand-border">
                    <span className="font-bold text-brand-navy">PGN: </span>
                    {activeMatch.pgn}
                  </div>
                )}

                <div className="pt-2">
                  <div className="rounded-2xl bg-brand-teal-light border border-brand-teal/30 p-3.5 text-xs font-bold text-brand-teal flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Real-time Socket.IO room connected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Resignation Confirmation Modal */}
      {showResignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-brand-border space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-brand-pink-light text-destructive flex items-center justify-center border border-destructive/20 mx-auto">
              <Flag className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-extrabold text-brand-navy">Resign this match?</h3>
              <p className="text-xs font-semibold text-brand-text-muted">
                Conceding will immediately forfeit the game and award the victory to your opponent.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResignModal(false)}
                disabled={isResigning}
                className="flex-1 rounded-xl border border-brand-border bg-white px-4 py-2.5 text-xs font-bold text-brand-navy hover:bg-brand-cream transition-colors"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={handleResign}
                disabled={isResigning}
                className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 text-white px-4 py-2.5 text-xs font-extrabold shadow-sm transition-colors"
              >
                {isResigning ? 'Resigning...' : 'Yes, Resign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
