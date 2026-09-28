import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { MatchesModule } from './modules/matches/matches.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    GatewayModule,
    TournamentsModule,
    MatchmakingModule,
    MatchesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
