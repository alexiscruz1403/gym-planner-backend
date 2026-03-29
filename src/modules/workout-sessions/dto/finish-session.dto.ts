import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../../../common/enums/session-status.enum';

// Only terminal statuses initiated by the user are accepted.
// 'abandoned' is set internally by the service — never by the user.
const FINISH_STATUSES = [
  SessionStatus.COMPLETED,
  SessionStatus.PARTIAL,
] as const;
type FinishStatus = (typeof FINISH_STATUSES)[number];

export class FinishSessionDto {
  @ApiProperty({
    enum: FINISH_STATUSES,
    description: 'Final status of the session. Use "completed" or "partial".',
  })
  @IsEnum(FINISH_STATUSES)
  @IsNotEmpty()
  status: FinishStatus;
}
