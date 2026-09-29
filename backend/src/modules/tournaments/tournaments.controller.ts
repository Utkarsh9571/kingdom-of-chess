import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { JwtAuthGuard, JwtPayload } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('tournaments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @Roles('COACH')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTournamentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.create(dto, user.sub);
  }

  @Get()
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.tournamentsService.findAll(user.role, user.sub);
  }

  @Get('my/enrolled')
  @Roles('STUDENT')
  async getMyTournaments(@CurrentUser() user: JwtPayload) {
    return this.tournamentsService.getStudentTournaments(user.sub);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.findById(id, user.role, user.sub);
  }

  @Patch(':id')
  @Roles('COACH')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTournamentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles('COACH')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.delete(id, user.sub);
  }

  @Post(':id/join')
  @Roles('STUDENT')
  @HttpCode(HttpStatus.OK)
  async join(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.joinTournament(id, user.sub);
  }

  @Get(':id/participants')
  async getParticipants(@Param('id') id: string) {
    return this.tournamentsService.getParticipants(id);
  }

  @Get(':id/leaderboard')
  async getLeaderboard(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tournamentsService.getLeaderboard(id, user.sub, user.role);
  }
}
