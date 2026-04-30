import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AiEquipment,
  AiExperienceLevel,
  AiFitnessGoal,
  AiPhysicalLimitation,
  AiPreference,
  AiSex,
} from '../../../common/enums';

export class PhysicalProfileDto {
  @ApiProperty({ minimum: 13, maximum: 100 })
  @IsInt()
  @Min(13)
  @Max(100)
  age: number;

  @ApiProperty({ enum: AiSex })
  @IsEnum(AiSex)
  sex: AiSex;

  @ApiProperty({
    description: 'Height in centimeters',
    minimum: 100,
    maximum: 250,
  })
  @IsNumber()
  @Min(100)
  @Max(250)
  heightCm: number;

  @ApiProperty({
    description: 'Current weight in kilograms',
    minimum: 30,
    maximum: 300,
  })
  @IsNumber()
  @Min(30)
  @Max(300)
  currentWeightKg: number;

  @ApiPropertyOptional({
    description: 'Target weight in kilograms',
    minimum: 30,
    maximum: 300,
  })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(300)
  targetWeightKg?: number;

  @ApiPropertyOptional({
    description: 'Estimated body fat percentage',
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  estimatedBodyFatPercent?: number;
}

export class GeneratePlanDto {
  @ApiProperty({ type: PhysicalProfileDto })
  @ValidateNested()
  @Type(() => PhysicalProfileDto)
  physicalProfile: PhysicalProfileDto;

  @ApiProperty({ enum: AiFitnessGoal })
  @IsEnum(AiFitnessGoal)
  goal: AiFitnessGoal;

  @ApiProperty({ enum: AiExperienceLevel })
  @IsEnum(AiExperienceLevel)
  experience: AiExperienceLevel;

  @ApiProperty({ minimum: 1, maximum: 6 })
  @IsInt()
  @Min(1)
  @Max(6)
  daysPerWeek: number;

  @ApiProperty({
    description: 'Available minutes per session',
    minimum: 20,
    maximum: 180,
  })
  @IsInt()
  @Min(20)
  @Max(180)
  minutesPerSession: number;

  @ApiProperty({ enum: AiEquipment, isArray: true })
  @IsArray()
  @IsEnum(AiEquipment, { each: true })
  equipment: AiEquipment[];

  @ApiProperty({ enum: AiPhysicalLimitation, isArray: true })
  @IsArray()
  @IsEnum(AiPhysicalLimitation, { each: true })
  physicalLimitations: AiPhysicalLimitation[];

  @ApiProperty({ enum: AiPreference, isArray: true })
  @IsArray()
  @IsEnum(AiPreference, { each: true })
  preferences: AiPreference[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: 3,
    description: 'Up to 3 exercise IDs the AI must exclude from the plan',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsMongoId({ each: true })
  excludedExerciseIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    maxItems: 3,
    description: 'Up to 3 exercise IDs the AI must include in the plan',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsMongoId({ each: true })
  includedExerciseIds?: string[];
}
