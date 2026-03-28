import { PartialType } from '@nestjs/swagger';
import { CreateWorkoutPlanDto } from './create-workout-plan.dto';

export class UpdateWorkoutPlanDto extends PartialType(CreateWorkoutPlanDto) {}
