import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [AuthModule, MatchmakingModule, MatchesModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
