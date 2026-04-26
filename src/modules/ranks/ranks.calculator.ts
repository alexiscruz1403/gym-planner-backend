import { Injectable } from '@nestjs/common';
import { LoadType, MuscleGroup } from '../../common/enums';
import { SessionSet } from '../../schemas/workout-session.schema';

@Injectable()
export class RanksCalculator {
  private readonly NAMED_THRESHOLDS: Record<string, number[]> = {
    squat: [0, 40, 80, 120, 160, 200, 250],
    deadlift: [0, 50, 100, 150, 200, 250, 300],
    'bench press': [0, 30, 60, 100, 140, 180, 220],
    'overhead press': [0, 20, 40, 70, 100, 130, 160],
    'barbell row': [0, 30, 60, 90, 130, 170, 210],
  };

  private readonly HEAVY_THRESHOLDS = [0, 40, 80, 120, 160, 200, 250];
  private readonly MEDIUM_THRESHOLDS = [0, 20, 40, 70, 100, 130, 160];
  private readonly LIGHT_THRESHOLDS = [0, 10, 20, 35, 55, 75, 100];
  private readonly BW_THRESHOLDS = [0, 5, 12, 25, 40, 60, 80];
  private readonly DUR_THRESHOLDS = [0, 20, 45, 90, 150, 240, 360];

  private readonly HEAVY_MUSCLES = new Set<MuscleGroup>([
    MuscleGroup.QUADS,
    MuscleGroup.HAMSTRINGS,
    MuscleGroup.GLUTES,
    MuscleGroup.LATS,
    MuscleGroup.UPPER_BACK,
    MuscleGroup.CHEST,
  ]);

  private readonly MEDIUM_MUSCLES = new Set<MuscleGroup>([
    MuscleGroup.FRONT_DELTS,
    MuscleGroup.SIDE_DELTS,
    MuscleGroup.REAR_DELTS,
    MuscleGroup.TRICEPS,
    MuscleGroup.BICEPS,
    MuscleGroup.TRAPS,
    MuscleGroup.LOWER_BACK,
  ]);

  getThresholds(
    exerciseName: string,
    trackingType: 'reps' | 'duration',
    loadType: LoadType,
    musclesPrimary: MuscleGroup[],
  ): number[] {
    if (trackingType === 'duration') return this.DUR_THRESHOLDS;
    if (loadType === LoadType.BODYWEIGHT) return this.BW_THRESHOLDS;

    const normalizedName = exerciseName.trim().toLowerCase();
    if (this.NAMED_THRESHOLDS[normalizedName]) {
      return this.NAMED_THRESHOLDS[normalizedName];
    }

    const primaryMuscle = musclesPrimary[0];
    const isHeavy = this.HEAVY_MUSCLES.has(primaryMuscle);

    // Heavy muscle + dumbbell → Medium thresholds (per-hand weight is lower)
    if (isHeavy && loadType === LoadType.DUMBBELL) {
      return this.MEDIUM_THRESHOLDS;
    }
    if (isHeavy) return this.HEAVY_THRESHOLDS;
    if (this.MEDIUM_MUSCLES.has(primaryMuscle)) return this.MEDIUM_THRESHOLDS;
    return this.LIGHT_THRESHOLDS;
  }

  deriveRank(value: number, thresholds: number[]): number {
    let rank = 1;
    for (let level = 1; level < 7; level++) {
      if (value >= thresholds[level]) rank = level + 1;
    }
    return rank;
  }

  computeBestValue(
    sets: SessionSet[],
    trackingType: 'reps' | 'duration',
    loadType: LoadType,
    bilateral: boolean,
  ): number {
    const completed = sets.filter((s) => s.completed);
    if (completed.length === 0) return 0;

    if (trackingType === 'duration') {
      return Math.max(
        0,
        ...completed.map((s) => {
          if (!bilateral) {
            return Math.max(s.left?.duration ?? 0, s.right?.duration ?? 0);
          }
          return s.duration ?? 0;
        }),
      );
    }

    if (loadType === LoadType.BODYWEIGHT) {
      return Math.max(
        0,
        ...completed.map((s) => {
          if (!bilateral) {
            return Math.max(s.left?.reps ?? 0, s.right?.reps ?? 0);
          }
          return s.reps ?? 0;
        }),
      );
    }

    // Weighted: Epley e1RM = weight × (1 + reps / 30)
    // Weights passed in are already normalized to kg by the caller
    return Math.max(
      0,
      ...completed.map((s) => {
        if (!bilateral) {
          const lw = s.left?.weight ?? 0;
          const lr = s.left?.reps ?? 0;
          const rw = s.right?.weight ?? 0;
          const rr = s.right?.reps ?? 0;
          const leftE1rm = lw > 0 && lr > 0 ? lw * (1 + lr / 30) : 0;
          const rightE1rm = rw > 0 && rr > 0 ? rw * (1 + rr / 30) : 0;
          return Math.max(leftE1rm, rightE1rm);
        }
        const w = s.weight ?? 0;
        const r = s.reps ?? 0;
        return w > 0 && r > 0 ? w * (1 + r / 30) : 0;
      }),
    );
  }
}
