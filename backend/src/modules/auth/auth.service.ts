import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../../database/schema';
import { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto, response: Response) {
    const normalizedEmail = registerDto.email.toLowerCase().trim();

    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('An account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // CRITICAL SECURITY: Public registration MUST ONLY create STUDENT accounts.
    const newUser = await this.usersService.create({
      name: registerDto.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'STUDENT',
    });

    return this.login(newUser, response);
  }

  async validateUser(email: string, pass: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  async login(user: User, response: Response) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const secret = this.configService.get<string>(
      'JWT_SECRET',
      'super_secret_jwt_key_for_kingdom_chess_2026_dev_only',
    );

    const token = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '7d',
    });

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    // Issue httpOnly secure cookie
    response.cookie('jwt', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token, // Also returned in data envelope for flexible client use if needed
    };
  }

  logout(response: Response) {
    response.clearCookie('jwt', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return {
      message: 'Logged out successfully',
    };
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    const secret = this.configService.get<string>(
      'JWT_SECRET',
      'super_secret_jwt_key_for_kingdom_chess_2026_dev_only',
    );
    return this.jwtService.verifyAsync<JwtPayload>(token, { secret });
  }
}
