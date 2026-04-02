/**
 * Exercises Seed Script
 *
 * Inserts the initial exercise catalog (33 exercises).
 * Idempotent: skips insertion if exercises already exist.
 * Run with: npm run seed:exercises
 *
 * Required env vars:
 *   MONGODB_URI — MongoDB connection string
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Exercise, ExerciseSchema } from '../../schemas/exercise.schema';

dotenv.config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV ?? 'local'}`),
});

const EXERCISES = [
  // ── Chest (5) ──────────────────────────────────────────────────────────────
  {
    name: 'Barbell Bench Press',
    musclesPrimary: ['chest'],
    musclesSecondary: ['front_delts', 'triceps'],
    loadType: 'barbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Incline Dumbbell Press',
    musclesPrimary: ['chest', 'front_delts'],
    musclesSecondary: ['triceps'],
    loadType: 'dumbbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Dumbbell Chest Fly',
    musclesPrimary: ['chest'],
    musclesSecondary: [],
    loadType: 'dumbbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Cable Chest Fly',
    musclesPrimary: ['chest'],
    musclesSecondary: [],
    loadType: 'cable',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Push-Up',
    musclesPrimary: ['chest', 'triceps'],
    musclesSecondary: ['front_delts'],
    loadType: 'bodyweight',
    trackingType: 'reps',
    bilateral: true,
  },

  // ── Back (6) ───────────────────────────────────────────────────────────────
  {
    name: 'Pull-Up',
    musclesPrimary: ['lats', 'upper_back'],
    musclesSecondary: ['biceps'],
    loadType: 'bodyweight',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Barbell Bent-Over Row',
    musclesPrimary: ['upper_back', 'lats'],
    musclesSecondary: ['biceps', 'rear_delts'],
    loadType: 'barbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Dumbbell One-Arm Row',
    musclesPrimary: ['upper_back', 'lats'],
    musclesSecondary: ['biceps'],
    loadType: 'dumbbell',
    trackingType: 'reps',
    bilateral: false,
  },
  {
    name: 'Cable Lat Pulldown',
    musclesPrimary: ['lats'],
    musclesSecondary: ['biceps', 'upper_back'],
    loadType: 'cable',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Seated Cable Row',
    musclesPrimary: ['upper_back'],
    musclesSecondary: ['lats', 'biceps'],
    loadType: 'cable',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Face Pull',
    musclesPrimary: ['rear_delts', 'upper_back'],
    musclesSecondary: ['traps'],
    loadType: 'cable',
    trackingType: 'reps',
    bilateral: true,
  },

  // ── Shoulders (4) ─────────────────────────────────────────────────────────
  {
    name: 'Barbell Overhead Press',
    musclesPrimary: ['front_delts', 'side_delts'],
    musclesSecondary: ['triceps', 'traps'],
    loadType: 'barbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Dumbbell Lateral Raise',
    musclesPrimary: ['side_delts'],
    musclesSecondary: [],
    loadType: 'dumbbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Arnold Press',
    musclesPrimary: ['front_delts', 'side_delts'],
    musclesSecondary: ['triceps'],
    loadType: 'dumbbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Rear Delt Fly (Machine)',
    musclesPrimary: ['rear_delts'],
    musclesSecondary: ['upper_back'],
    loadType: 'machine',
    trackingType: 'reps',
    bilateral: true,
  },

  // ── Arms (5) ──────────────────────────────────────────────────────────────
  {
    name: 'Barbell Bicep Curl',
    musclesPrimary: ['biceps'],
    musclesSecondary: ['forearms'],
    loadType: 'barbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Hammer Curl',
    musclesPrimary: ['biceps', 'forearms'],
    musclesSecondary: [],
    loadType: 'dumbbell',
    trackingType: 'reps',
    bilateral: false,
  },
  {
    name: 'Preacher Curl (Machine)',
    musclesPrimary: ['biceps'],
    musclesSecondary: [],
    loadType: 'machine',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Tricep Pushdown (Cable)',
    musclesPrimary: ['triceps'],
    musclesSecondary: [],
    loadType: 'cable',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Skull Crushers',
    musclesPrimary: ['triceps'],
    musclesSecondary: [],
    loadType: 'barbell',
    trackingType: 'reps',
    bilateral: true,
  },

  // ── Legs — Quads (4) ──────────────────────────────────────────────────────
  {
    name: 'Barbell Back Squat',
    musclesPrimary: ['quads', 'glutes'],
    musclesSecondary: ['hamstrings', 'lower_back'],
    loadType: 'barbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Leg Press (Machine)',
    musclesPrimary: ['quads', 'glutes'],
    musclesSecondary: ['hamstrings'],
    loadType: 'machine',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Leg Extension (Machine)',
    musclesPrimary: ['quads'],
    musclesSecondary: [],
    loadType: 'machine',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Walking Lunges',
    musclesPrimary: ['quads', 'glutes'],
    musclesSecondary: ['hamstrings'],
    loadType: 'dumbbell',
    trackingType: 'reps',
    bilateral: false,
  },

  // ── Legs — Hamstrings & Glutes (4) ────────────────────────────────────────
  {
    name: 'Romanian Deadlift',
    musclesPrimary: ['hamstrings', 'glutes'],
    musclesSecondary: ['lower_back'],
    loadType: 'barbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Leg Curl (Machine)',
    musclesPrimary: ['hamstrings'],
    musclesSecondary: [],
    loadType: 'machine',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Hip Thrust (Barbell)',
    musclesPrimary: ['glutes', 'hamstrings'],
    musclesSecondary: [],
    loadType: 'barbell',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Bulgarian Split Squat',
    musclesPrimary: ['glutes', 'quads'],
    musclesSecondary: ['hamstrings'],
    loadType: 'dumbbell',
    trackingType: 'reps',
    bilateral: false,
  },

  // ── Calves (1) ────────────────────────────────────────────────────────────
  {
    name: 'Standing Calf Raise (Machine)',
    musclesPrimary: ['calves'],
    musclesSecondary: [],
    loadType: 'machine',
    trackingType: 'reps',
    bilateral: true,
  },

  // ── Core (4) ──────────────────────────────────────────────────────────────
  {
    name: 'Plank',
    musclesPrimary: ['abs', 'lower_back'],
    musclesSecondary: [],
    loadType: 'bodyweight',
    trackingType: 'duration', // timed hold — no reps
    bilateral: true,
  },
  {
    name: 'Hanging Leg Raise',
    musclesPrimary: ['abs'],
    musclesSecondary: ['obliques'],
    loadType: 'bodyweight',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Cable Crunch',
    musclesPrimary: ['abs'],
    musclesSecondary: [],
    loadType: 'cable',
    trackingType: 'reps',
    bilateral: true,
  },
  {
    name: 'Ab Wheel Rollout',
    musclesPrimary: ['abs', 'lower_back'],
    musclesSecondary: [],
    loadType: 'bodyweight',
    trackingType: 'reps',
    bilateral: true,
  },
];

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  await mongoose.connect(mongoUri);

  const ExerciseModel = mongoose.model(Exercise.name, ExerciseSchema);

  const existingCount = await ExerciseModel.countDocuments().exec();
  if (existingCount > 0) {
    console.log(
      `Skipping seed: ${existingCount} exercises already exist in the catalog`,
    );
    await mongoose.disconnect();
    return;
  }

  const result = await ExerciseModel.insertMany(EXERCISES);
  console.log(`Inserted ${result.length} exercises into the catalog`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
