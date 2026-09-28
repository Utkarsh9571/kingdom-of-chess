import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { QueueDto } from './dto/queue.dto';
import { JwtAuthGuard, JwtPayload } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post('join')
  @Roles('STUDENT')
  @HttpCode(HttpStatus.OK)
  async joinQueue(@Body() dto: QueueDto, @CurrentUser() user: JwtPayload) {
    return this.matchmakingService.joinQueue(
      { sub: user.sub, role: user.role, email: user.email, name: user.name },
      dto.tournamentId,
    );
  }

  @Post('leave')
  @Roles('STUDENT')
  @HttpCode(HttpStatus.OK)
  async leaveQueue(@Body() dto: QueueDto, @CurrentUser() user: JwtPayload) {
    return this.matchmakingService.leaveQueue(user.sub, dto.tournamentId);
  }

  @Get('status')
  @Roles('STUDENT')
  async getStatus(
    @Query('tournamentId') tournamentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.matchmakingService.getQueueStatus(user.sub, tournamentId);
  }
}
