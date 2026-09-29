import { IsNotEmpty, IsString, IsEmail, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  name!: string;

  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email address is required' })
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;
}
