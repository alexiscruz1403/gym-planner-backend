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
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'NombreUsuario123' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
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
