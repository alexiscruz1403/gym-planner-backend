import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type StatsPeriod = 'week' | 'month' | 'year';

export class StatsQueryDto {
  @ApiProperty({
    description: 'Aggregation granularity',
    enum: ['week', 'month', 'year'],
  })
  @IsEnum(['week', 'month', 'year'])
  period: StatsPeriod;

  @ApiProperty({
    description:
      'Reference date. Format: YYYY-Www (week), YYYY-MM (month), YYYY (year)',
    examples: {
      week: { value: '2026-W13' },
      month: { value: '2026-03' },
      year: { value: '2026' },
    },
  })
  @IsString()
  @IsNotEmpty()
  date: string;
}
