import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard, JwtPayload } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Roles } from './common/decorators/roles.decorator';
import { CurrentUser } from './common/decorators/current-user.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('test/protected')
  @UseGuards(JwtAuthGuard)
  getProtected(@CurrentUser() user: JwtPayload) {
    return {
      message: 'Access granted to protected endpoint',
      user,
    };
  }

  @Get('test/coach-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COACH')
  getCoachOnly(@CurrentUser() user: JwtPayload) {
    return {
      message: 'Access granted: Coach dashboard endpoint',
      user,
    };
  }

  @Get('test/student-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  getStudentOnly(@CurrentUser() user: JwtPayload) {
    return {
      message: 'Access granted: Student arena endpoint',
      user,
    };
  }
}
