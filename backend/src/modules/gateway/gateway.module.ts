import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';

@Module({
  imports: [AuthModule, MatchmakingModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
