'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

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

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to server, ID:', newSocket.id);
      setIsConnected(true);
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
    newSocket.on('queue:matched', (data: MatchedEvent) => {
      console.log('[Socket] Opponent matched! Match ID:', data.matchId);
      setIsQueueing(false);
      setQueuedTournamentId(null);
      setActiveMatch(data);

      // Seamless auto-transition to the live match arena without browser refresh
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
  }, [router]);

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
