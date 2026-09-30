'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { api } from '@/lib/api';

export interface MatchedEvent {
  matchId: string;
  tournamentId: string;
  color: 'w' | 'b';
  opponent: {
    id: string;
    name: string;
    email: string;
  };
  timeControl: string;
  initialTimeMs: number;
  fen: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  activeMatch: MatchedEvent | null;
  joinMatchmaking: (tournamentId: string) => void;
  leaveMatchmaking: (tournamentId: string) => void;
  reconnectSocket: () => void;
  isQueueing: boolean;
  queuedTournamentId: string | null;
  queueError: string | null;
  clearQueueError: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  activeMatch: null,
  joinMatchmaking: () => {},
  leaveMatchmaking: () => {},
  reconnectSocket: () => {},
  isQueueing: false,
  queuedTournamentId: null,
  queueError: null,
  clearQueueError: () => {},
});

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeMatch, setActiveMatch] = useState<MatchedEvent | null>(null);
  const [isQueueing, setIsQueueing] = useState(false);
  const [queuedTournamentId, setQueuedTournamentId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [connectionKey, setConnectionKey] = useState(0);

  const reconnectSocket = useCallback(() => {
    setConnectionKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: {
        token: token || undefined,
      },
      query: token ? { token } : undefined,
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to server, ID:', newSocket.id);
      setIsConnected(true);
      // Immediately refresh authentication with latest session credentials
      newSocket.emit('auth:refresh');
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('auth:success', (data) => {
      console.log('[Socket] Handshake auth success:', data.user.email);
    });

    newSocket.on('auth:error', (err) => {
      console.warn('[Socket] Handshake auth error:', err.message);
    });

    // Listen for automatic matchmaking pairing
    newSocket.on('queue:matched', async (data: MatchedEvent) => {
      console.log('[Socket] Opponent matched! Match ID:', data.matchId);

      // Defense-in-depth: Verify authenticated user is actually a participant
      try {
        const me = await api.getMe();
        if (me && data.opponent?.id === me.id) {
          console.warn('[Socket] Ignored queue:matched where opponent ID matches self');
          return;
        }
      } catch {}

      setIsQueueing(false);
      setQueuedTournamentId(null);
      setActiveMatch(data);

      // Transition to match arena
      router.push(`/match/${data.matchId}`);
    });

    newSocket.on('queue:status', (data) => {
      if (data && typeof data.inQueue === 'boolean') {
        setIsQueueing(data.inQueue);
        if (!data.inQueue) {
          setQueuedTournamentId(null);
        }
      }
    });

    newSocket.on('queue:error', (err: { message: string }) => {
      console.error('[Socket] Queue error:', err.message);
      setQueueError(err.message);
      setIsQueueing(false);
      setQueuedTournamentId(null);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [connectionKey, router]);

  const joinMatchmaking = (tournamentId: string) => {
    if (!socket || !isConnected) {
      setQueueError('Real-time connection not established. Please check connection.');
      return;
    }
    setQueueError(null);
    setIsQueueing(true);
    setQueuedTournamentId(tournamentId);
    socket.emit('queue:join', { tournamentId });
  };

  const leaveMatchmaking = (tournamentId: string) => {
    if (!socket) return;
    setIsQueueing(false);
    setQueuedTournamentId(null);
    socket.emit('queue:leave', { tournamentId });
  };

  const clearQueueError = () => setQueueError(null);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        activeMatch,
        joinMatchmaking,
        leaveMatchmaking,
        reconnectSocket,
        isQueueing,
        queuedTournamentId,
        queueError,
        clearQueueError,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
