import { ApiProperty } from '@nestjs/swagger';
// prettier-ignore
import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'usuario@email.com' })
  @IsEmail({}, { message: 'Email must have a valid format' })
  email: string;

  @ApiProperty({ example: 'NombreUsuario123' })
  @IsString({ message: 'Username must be a character string' })
  @MinLength(3, { message: 'Username must have at least 3 characters' })
  @MaxLength(20, { message: 'Username must have less than 20 characters' })
  username: string;

  // IsStrongPassword enforces: min 8 chars, 1 uppercase, 1 number, 1 symbol
  @ApiProperty({ example: 'MiPassword123!' })
  @IsStrongPassword(
    {},
    {
      message:
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo',
    },
  )
  password: string;
}
