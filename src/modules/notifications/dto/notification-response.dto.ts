import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../common/enums/notification-type.enum';

export class NotificationResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Null for SYSTEM notifications',
  })
  actorId: string | null;

  @ApiProperty({
    description:
      'Type-specific payload. Shape depends on type — see NotificationType for keys.',
  })
  data: Record<string, any>;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;
}
