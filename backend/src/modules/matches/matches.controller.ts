import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MatchesService } from './matches.service';

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get(':id')
  async getMatch(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    return this.matchesService.getMatchById(id, user.sub, user.role);
  }

  @Get(':id/moves')
  async getMatchMoves(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    return this.matchesService.getMatchMoves(id, user.sub, user.role);
  }
}
