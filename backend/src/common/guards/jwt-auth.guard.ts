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

    if (!token) {
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
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractTokenFromRequest(request: Request): string | null {
    // 1. Check httpOnly cookie
    if (request.cookies && request.cookies.jwt) {
      return request.cookies.jwt;
    }

    // 2. Check Authorization Bearer header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}
