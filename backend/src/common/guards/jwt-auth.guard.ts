import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'COACH' | 'STUDENT';
  name: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromRequest(request);

    const hasCookieObj = Boolean(request.cookies);
    const cookieNames = request.cookies ? Object.keys(request.cookies) : [];
    const hasJwtCookie = Boolean(request.cookies && request.cookies.jwt);
    const hasToken = Boolean(token);

    if (!token) {
      console.warn(
        `[AuthGuard Diagnostic] Token missing. Path: ${request.path}, HasCookieObj: ${hasCookieObj}, CookieNames: [${cookieNames.join(', ')}], HasJwtCookie: ${hasJwtCookie}`,
      );
      throw new UnauthorizedException('Authentication token missing or invalid');
    }

    try {
      const secret = this.configService.get<string>(
        'JWT_SECRET',
        'super_secret_jwt_key_for_kingdom_chess_2026_dev_only',
      );
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      // Attach user to request
      request.user = payload;
      return true;
    } catch (err: any) {
      console.warn(
        `[AuthGuard Diagnostic] Token verification failed. Path: ${request.path}, Reason: ${err?.message || err}`,
      );
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractTokenFromRequest(request: Request): string | null {
    // 1. Check Authorization Bearer header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 2. Check httpOnly cookie
    if (request.cookies && request.cookies.jwt) {
      return request.cookies.jwt;
    }

    // 3. Check query string token
    if (typeof request.query?.token === 'string') {
      return request.query.token;
    }

    return null;
  }
}
