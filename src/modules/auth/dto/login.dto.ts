import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'usuario@email.com' })
  @IsEmail({}, { message: 'Email must have a valid format' })
  email: string;

  @ApiProperty({ example: 'MiPassword123!' })
  @IsString({ message: 'Password must be a character string' })
  @IsNotEmpty({ message: 'Password must not be empty' })
  password: string;
}
