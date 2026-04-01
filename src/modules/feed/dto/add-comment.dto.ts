import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddCommentDto {
  @ApiProperty({ description: 'Comment text (1–300 chars)' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text: string;
}
