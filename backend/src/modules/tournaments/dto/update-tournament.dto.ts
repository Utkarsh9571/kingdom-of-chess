import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  IsISO8601,
} from 'class-validator';

export class UpdateTournamentDto {
  @IsOptional()
  @IsString({ message: 'Tournament name must be a string' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Time control must be a string (e.g., 5+0, 3+2)' })
  timeControl?: string;

  @IsOptional()
  @IsInt({ message: 'Initial time must be an integer (in seconds)' })
  @Min(30, { message: 'Initial time must be at least 30 seconds' })
  initialTimeSeconds?: number;

  @IsOptional()
  @IsInt({ message: 'Increment must be an integer (in seconds)' })
  @Min(0, { message: 'Increment cannot be negative' })
  incrementSeconds?: number;

  @IsOptional()
  @IsISO8601({}, { message: 'Start date must be a valid ISO8601 date string' })
  startDate?: string;

  @IsOptional()
  @IsIn(['draft', 'open', 'ongoing', 'completed'], {
    message: 'Status must be one of: draft, open, ongoing, completed',
  })
  status?: 'draft' | 'open' | 'ongoing' | 'completed';
}
