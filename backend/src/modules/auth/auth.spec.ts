import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException, ConflictException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { User } from '../../database/schema';

describe('Authentication & Authorization Suite', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockHashedPassword = bcrypt.hashSync('Password123!', 10);

  const mockCoach: User = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'coach@kingdom.com',
    passwordHash: mockHashedPassword,
    name: 'Coach Garry',
    role: 'COACH',
    createdAt: new Date(),
  };

  const mockStudent: User = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'student1@kingdom.com',
    passwordHash: mockHashedPassword,
    name: 'Anand Jr.',
    role: 'STUDENT',
    createdAt: new Date(),
  };

  const mockUsersService = {
    findByEmail: jest.fn(async (email: string) => {
      if (email === 'coach@kingdom.com') return mockCoach;
      if (email === 'student1@kingdom.com') return mockStudent;
      return null;
    }),
    findById: jest.fn(async (id: string) => {
      if (id === mockCoach.id) return mockCoach;
      if (id === mockStudent.id) return mockStudent;
      return null;
    }),
    create: jest.fn(async (data: any) => ({
      id: '33333333-3333-3333-3333-333333333333',
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role || 'STUDENT',
      createdAt: new Date(),
    })),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'JWT_SECRET') return 'test_jwt_secret';
      if (key === 'NODE_ENV') return 'test';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        Reflector,
        RolesGuard,
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('1. Credentials Validation (AuthService.validateUser)', () => {
    it('should validate user with correct password and return user entity', async () => {
      const user = await authService.validateUser('coach@kingdom.com', 'Password123!');
      expect(user).toBeDefined();
      expect(user.email).toBe('coach@kingdom.com');
      expect(user.role).toBe('COACH');
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      await expect(
        authService.validateUser('coach@kingdom.com', 'WrongPassword!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on non-existent email', async () => {
      await expect(
        authService.validateUser('nonexistent@kingdom.com', 'Password123!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2. Login & Cookie Issuance (AuthService.login & logout)', () => {
    it('should issue httpOnly cookie and return user profile', async () => {
      const mockRes: any = {
        cookie: jest.fn(),
      };

      const result = await authService.login(mockCoach, mockRes);
      expect(result.user.email).toBe('coach@kingdom.com');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'jwt',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
    });

    it('should clear cookie upon logout', () => {
      const mockRes: any = {
        clearCookie: jest.fn(),
      };

      const result = authService.logout(mockRes);
      expect(result.message).toBe('Logged out successfully');
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'jwt',
        expect.objectContaining({
          httpOnly: true,
        }),
      );
    });
  });

  describe('3. Protected Route Verification (JwtAuthGuard)', () => {
    let guard: JwtAuthGuard;

    beforeEach(() => {
      guard = new JwtAuthGuard(jwtService, configService);
    });

    it('should allow request with valid cookie token', async () => {
      const token = await jwtService.signAsync(
        { sub: mockCoach.id, email: mockCoach.email, role: mockCoach.role, name: mockCoach.name },
        { secret: 'test_jwt_secret' },
      );

      const mockRequest: any = {
        cookies: { jwt: token },
        headers: {},
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user.sub).toBe(mockCoach.id);
      expect(mockRequest.user.role).toBe('COACH');
    });

    it('should allow request with valid Bearer authorization header', async () => {
      const token = await jwtService.signAsync(
        { sub: mockStudent.id, email: mockStudent.email, role: mockStudent.role, name: mockStudent.name },
        { secret: 'test_jwt_secret' },
      );

      const mockRequest: any = {
        cookies: {},
        headers: { authorization: `Bearer ${token}` },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockRequest.user.role).toBe('STUDENT');
    });

    it('should reject request when token is missing', async () => {
      const mockRequest: any = { cookies: {}, headers: {} };
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject request when token is invalid', async () => {
      const mockRequest: any = { cookies: { jwt: 'invalid.token.signature' }, headers: {} };
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('4. Role-based Authorization (RolesGuard)', () => {
    it('should allow access when endpoint has no role requirements', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'STUDENT' } }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it('should grant access when user has required COACH role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['COACH']);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'COACH' } }),
        }),
      } as unknown as ExecutionContext;

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it('should deny access (throw ForbiddenException) when STUDENT attempts COACH endpoint', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['COACH']);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'STUDENT' } }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should deny access when COACH attempts STUDENT-only endpoint', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['STUDENT']);

      const mockContext = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'COACH' } }),
        }),
      } as unknown as ExecutionContext;

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('5. Public Student Registration & Security (AuthService.register)', () => {
    it('should register a new user as STUDENT and return auth token', async () => {
      const mockResponse: any = { cookie: jest.fn() };
      const res = await authService.register(
        { name: 'Praggnanandhaa R.', email: 'pragg@kingdom.com', password: 'Password123!' },
        mockResponse,
      );

      expect(res.user).toBeDefined();
      expect(res.user.name).toBe('Praggnanandhaa R.');
      expect(res.user.email).toBe('pragg@kingdom.com');
      expect(res.user.role).toBe('STUDENT');
      expect(mockResponse.cookie).toHaveBeenCalledWith('jwt', expect.any(String), expect.anything());
    });

    it('should reject registration if email already exists with ConflictException (409)', async () => {
      const mockResponse: any = { cookie: jest.fn() };
      await expect(
        authService.register(
          { name: 'Duplicate User', email: 'coach@kingdom.com', password: 'Password123!' },
          mockResponse,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('CRITICAL SECURITY: Public registration MUST force role=STUDENT even if attacker passes role=COACH', async () => {
      const mockResponse: any = { cookie: jest.fn() };
      // Pass malicious role in payload (simulating manual API call bypassing frontend)
      const maliciousPayload: any = {
        name: 'Attacker Coach',
        email: 'attacker@kingdom.com',
        password: 'Password123!',
        role: 'COACH',
      };

      const res = await authService.register(maliciousPayload, mockResponse);
      expect(res.user.role).toBe('STUDENT');
      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'STUDENT' }),
      );
    });
  });
});
