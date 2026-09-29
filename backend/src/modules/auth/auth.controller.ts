import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard, JwtPayload } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.register(registerDto, response);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    return this.authService.login(user, response);
  }

  @Post('auth/logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response) {
    return this.authService.logout(response);
  }

  @Get('auth/me')
  @UseGuards(JwtAuthGuard)
  async getAuthMe(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  // Explicit GET /me endpoint as stated in assignment requirement 01
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
