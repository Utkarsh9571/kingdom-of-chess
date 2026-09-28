import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../../common/guards/jwt-auth.guard';

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
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly authService: AuthService) {}

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
      console.warn(`[Socket] Connection rejected: Invalid token for client ${client.id}: ${err.message}`);
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
}
