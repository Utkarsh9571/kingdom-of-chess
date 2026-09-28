import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { eq } from 'drizzle-orm';
import { AuthService } from '../auth/auth.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
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
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
  ) {}

  afterInit(server: Server) {
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

    const payload = {
      matchId: match.id,
      tournamentId: match.tournamentId,
      tournamentName: tournament?.name || 'Tournament',
      timeControl: tournament?.timeControl || '5+0',
      color,
      fen: match.currentFen,
      pgn: match.pgn,
      status: match.status,
      whitePlayer: whiteUser,
      blackPlayer: blackUser,
      whiteTimeRemainingMs: match.whiteTimeRemainingMs,
      blackTimeRemainingMs: match.blackTimeRemainingMs,
      activeTurn: match.activeTurn,
    };

    client.emit('match:joined', payload);
    client.emit('match:state', payload);
  }
}
