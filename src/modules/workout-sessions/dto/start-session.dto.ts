import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DayOfWeek } from '../../../common/enums/day-of-week.enum';

export class StartSessionDto {
  @ApiProperty({
    enum: DayOfWeek,
    description: 'Day of the week to execute from the active plan',
  })
  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  dayOfWeek: DayOfWeek;
}
