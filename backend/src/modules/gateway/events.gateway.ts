import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { eq } from 'drizzle-orm';
import { AuthService } from '../auth/auth.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { MatchesService } from '../matches/matches.service';
import { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { DRIZZLE, DrizzleDb } from '../../database/database.module';
import * as schema from '../../database/schema';

function parseCookie(cookieString: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieString) return cookies;

  cookieString.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(rest.join('='));
    }
  });

  return cookies;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly matchmakingService: MatchmakingService,
    private readonly matchesService: MatchesService,
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
  ) {}

  afterInit(server: Server) {
    // 1. Listen for matchmaking pairings and notify players in their private user rooms
    this.matchmakingService.onMatchNotification((notification) => {
      console.log(
        `[Socket] Emitting queue:matched to White (${notification.whitePlayerId}) and Black (${notification.blackPlayerId}) for match ${notification.matchId}`,
      );
      this.server
        .to(`user:${notification.whitePlayerId}`)
        .emit('queue:matched', notification.whitePayload);
      this.server
        .to(`user:${notification.blackPlayerId}`)
        .emit('queue:matched', notification.blackPayload);
    });

    // 2. Listen for matches ended by timeout or internal triggers
    this.matchesService.onMatchEnded((state) => {
      console.log(
        `[Socket] Match ${state.matchId} ended with result: ${state.result} (${state.reason})`,
      );
      this.server.to(`match:${state.matchId}`).emit('match:state', state);
      this.server.to(`match:${state.matchId}`).emit('match:ended', {
        matchId: state.matchId,
        result: state.result,
        winnerId: state.winnerId,
        reason: state.reason,
        pgn: state.pgn,
      });
    });
  }

  async handleConnection(client: Socket) {
    try {
      const cookieHeader = client.handshake.headers.cookie;
      const parsedCookies = parseCookie(cookieHeader);

      // Support token from cookie or handshake auth/query
      const token =
        parsedCookies.jwt ||
        client.handshake.auth?.token ||
        (client.handshake.query?.token as string);

      if (!token) {
        console.warn(`[Socket] Connection rejected: No token found for client ${client.id}`);
        client.emit('auth:error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const payload: JwtPayload = await this.authService.verifyToken(token);
      client.data.user = payload;

      // Join private user room for direct pushes
      client.join(`user:${payload.sub}`);

      console.log(
        `[Socket] Authenticated connection: ${client.id} (User: ${payload.email}, Role: ${payload.role})`,
      );

      client.emit('auth:success', {
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          name: payload.name,
        },
      });
    } catch (err: any) {
      console.warn(
        `[Socket] Connection rejected: Invalid token for client ${client.id}: ${err.message}`,
      );
      client.emit('auth:error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (user) {
      console.log(`[Socket] Disconnected: ${client.id} (User: ${user.email})`);
    } else {
      console.log(`[Socket] Disconnected: ${client.id}`);
    }
  }

  @SubscribeMessage('auth:whoami')
  handleWhoAmI(client: Socket) {
    return {
      event: 'auth:whoami',
      data: {
        authenticated: true,
        user: client.data?.user || null,
      },
    };
  }

  @SubscribeMessage('queue:join')
  async handleQueueJoin(client: Socket, data: { tournamentId: string }) {
    const user = client.data?.user;
    if (!user) {
      client.emit('queue:error', { code: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    if (!data?.tournamentId) {
      client.emit('queue:error', { code: 'BAD_REQUEST', message: 'Tournament ID is required' });
      return;
    }

    try {
      const result = await this.matchmakingService.joinQueue(
        { sub: user.sub, role: user.role, email: user.email, name: user.name },
        data.tournamentId,
        client.id,
      );
      return { event: 'queue:status', data: result };
    } catch (err: any) {
      client.emit('queue:error', { code: 'QUEUE_ERROR', message: err.message });
    }
  }

  @SubscribeMessage('queue:leave')
  async handleQueueLeave(client: Socket, data: { tournamentId: string }) {
    const user = client.data?.user;
    if (!user) return;

    if (!data?.tournamentId) return;

    try {
      const result = await this.matchmakingService.leaveQueue(user.sub, data.tournamentId);
      return { event: 'queue:status', data: result };
    } catch (err: any) {
      client.emit('queue:error', { code: 'QUEUE_ERROR', message: err.message });
    }
  }

  @SubscribeMessage('match:join')
  async handleMatchJoin(client: Socket, data: { matchId: string }) {
    const user = client.data?.user;
    if (!user) {
      client.emit('match:error', { code: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    if (!data?.matchId) {
      client.emit('match:error', { code: 'BAD_REQUEST', message: 'Match ID required' });
      return;
    }

    const [match] = await this.db
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.id, data.matchId))
      .limit(1);

    if (!match) {
      client.emit('match:error', { code: 'NOT_FOUND', message: 'Match not found' });
      return;
    }

    const isWhite = match.whitePlayerId === user.sub;
    const isBlack = match.blackPlayerId === user.sub;
    const isCoach = user.role === 'COACH';

    if (!isWhite && !isBlack && !isCoach) {
      client.emit('match:error', {
        code: 'FORBIDDEN',
        message: 'Unauthorized: You are not a participant in this match room',
      });
      return;
    }

    // Securely join room
    client.join(`match:${data.matchId}`);

    const color = isWhite ? 'w' : isBlack ? 'b' : 'observer';

    const [tournament] = await this.db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, match.tournamentId))
      .limit(1);

    const [whiteUser] = await this.db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, match.whitePlayerId))
      .limit(1);

    const [blackUser] = await this.db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, match.blackPlayerId))
      .limit(1);

    // Ensure timer is ticking if match is in progress
    if (match.status === 'in_progress') {
      this.matchesService.ensureMatchTimer(match);
    }

    const payload = {
      matchId: match.id,
      tournamentId: match.tournamentId,
      tournamentName: tournament?.name || 'Tournament',
      timeControl: tournament?.timeControl || '5+0',
      initialTimeSeconds: tournament?.initialTimeSeconds || 300,
      incrementSeconds: tournament?.incrementSeconds || 0,
      color,
      fen: match.currentFen,
      pgn: match.pgn,
      status: match.status,
      result: match.result,
      reason: match.reason,
      winnerId: match.winnerId,
      whitePlayer: whiteUser,
      blackPlayer: blackUser,
      whiteTimeRemainingMs: match.whiteTimeRemainingMs,
      blackTimeRemainingMs: match.blackTimeRemainingMs,
      activeTurn: match.activeTurn,
      lastTurnStartTime: match.lastTurnStartTime,
    };

    client.emit('match:joined', payload);
    client.emit('match:state', payload);
  }

  @SubscribeMessage('match:move')
  async handleMatchMove(
    client: Socket,
    data: { matchId: string; from: string; to: string; promotion?: string },
  ) {
    const user = client.data?.user;
    if (!user) {
      client.emit('match:error', { code: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    if (!data?.matchId || !data?.from || !data?.to) {
      client.emit('match:error', {
        code: 'BAD_REQUEST',
        message: 'matchId, from, and to are required for a move',
      });
      return;
    }

    try {
      const state = await this.matchesService.makeMove(user.sub, user.role, data);

      // Broadcast move event and updated state to the entire match room
      this.server.to(`match:${data.matchId}`).emit('match:moved', state);
      this.server.to(`match:${data.matchId}`).emit('match:state', state);

      // If move completed the game (checkmate/stalemate/draw), emit match:ended
      if (state.status === 'completed') {
        this.server.to(`match:${data.matchId}`).emit('match:ended', {
          matchId: state.matchId,
          result: state.result,
          winnerId: state.winnerId,
          reason: state.reason,
          pgn: state.pgn,
        });
      }

      return { event: 'match:move_ack', data: state };
    } catch (err: any) {
      client.emit('match:error', {
        code: err.status === 400 ? 'INVALID_MOVE' : 'MOVE_ERROR',
        message: err.message,
      });
    }
  }

  @SubscribeMessage('match:resign')
  async handleMatchResign(client: Socket, data: { matchId: string }) {
    const user = client.data?.user;
    if (!user) {
      client.emit('match:error', { code: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    if (!data?.matchId) {
      client.emit('match:error', { code: 'BAD_REQUEST', message: 'matchId is required' });
      return;
    }

    try {
      const state = await this.matchesService.resignMatch(user.sub, user.role, data.matchId);

      this.server.to(`match:${data.matchId}`).emit('match:state', state);
      this.server.to(`match:${data.matchId}`).emit('match:ended', {
        matchId: state.matchId,
        result: state.result,
        winnerId: state.winnerId,
        reason: state.reason,
        pgn: state.pgn,
      });

      return { event: 'match:resign_ack', data: state };
    } catch (err: any) {
      client.emit('match:error', {
        code: 'RESIGN_ERROR',
        message: err.message,
      });
    }
  }
}
