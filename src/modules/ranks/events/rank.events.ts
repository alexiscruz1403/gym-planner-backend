import { WeightUnit } from '../../../common/enums/weight-unit.enum';
import { SessionSet } from '../../../schemas/workout-session.schema';

export const RANK_EVENTS = {
  SESSION_COMPLETED: 'ranks.session.completed',
} as const;

export class SessionCompletedForRanksEvent {
  constructor(
    public readonly userId: string,
    public readonly exercises: Array<{
      exerciseId: string;
      exerciseName: string;
      trackingType: 'reps' | 'duration';
      bilateral: boolean;
      weightUnit: WeightUnit;
      sets: SessionSet[];
    }>,
  ) {}
}
