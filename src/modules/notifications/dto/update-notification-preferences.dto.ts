import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowFollow?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowFollowRequest?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowPostLike?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowPostComment?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowNewPost?: boolean;
}
