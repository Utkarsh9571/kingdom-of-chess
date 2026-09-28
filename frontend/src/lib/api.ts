const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const API_URL = `${API_BASE}/api/v1`;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: null | { code: string; message: string };
  timestamp: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'COACH' | 'STUDENT';
}

export interface Tournament {
  id: string;
  name: string;
  timeControl: string;
  initialTimeSeconds: number;
  incrementSeconds: number;
  startDate: string;
  status: 'draft' | 'open' | 'ongoing' | 'completed';
  winnerId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  participantsCount: number;
  isEnrolled: boolean;
}

export interface Participant {
  participantId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface TournamentDetails extends Tournament {
  participants: Participant[];
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // sends and receives httpOnly cookies
  });

  const json: ApiResponse<T> = await response.json();

  if (!response.ok || !json.success) {
    const errorMsg = json.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return json.data;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ user: UserProfile; token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () => request<UserProfile>('/me'),

  // Tournaments
  getTournaments: () => request<Tournament[]>('/tournaments'),

  getMyTournaments: () => request<Tournament[]>('/tournaments/my/enrolled'),

  getTournament: (id: string) => request<TournamentDetails>(`/tournaments/${id}`),

  createTournament: (data: {
    name: string;
    timeControl: string;
    startDate: string;
    status?: 'draft' | 'open' | 'ongoing' | 'completed';
  }) =>
    request<Tournament>('/tournaments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTournament: (
    id: string,
    data: Partial<{
      name: string;
      timeControl: string;
      startDate: string;
      status: 'draft' | 'open' | 'ongoing' | 'completed';
    }>,
  ) =>
    request<Tournament>(`/tournaments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteTournament: (id: string) =>
    request<{ message: string; id: string }>(`/tournaments/${id}`, {
      method: 'DELETE',
    }),

  joinTournament: (id: string) =>
    request<{ message: string; participantId: string; tournamentId: string; userId: string }>(
      `/tournaments/${id}/join`,
      {
        method: 'POST',
      },
    ),

  getParticipants: (id: string) => request<Participant[]>(`/tournaments/${id}/participants`),

  // Matches
  getMatch: (id: string) => request<MatchDetails>(`/matches/${id}`),
};

export interface MatchDetails {
  id: string;
  tournamentId: string;
  tournamentName: string;
  timeControl: string;
  initialTimeSeconds: number;
  incrementSeconds: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  result?: 'white_win' | 'black_win' | 'draw' | null;
  reason?: string | null;
  winnerId?: string | null;
  currentFen: string;
  pgn: string;
  whitePlayer: { id: string; name: string; email: string };
  blackPlayer: { id: string; name: string; email: string };
  whiteTimeRemainingMs: number;
  blackTimeRemainingMs: number;
  activeTurn: 'w' | 'b';
  userRole: 'white' | 'black' | 'coach';
  createdAt: string;
}

