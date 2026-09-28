import { IsNotEmpty, IsUUID, IsString } from 'class-validator';

export class QueueDto {
  @IsString({ message: 'Tournament ID must be a string' })
  @IsNotEmpty({ message: 'Tournament ID is required' })
  tournamentId!: string;
}
