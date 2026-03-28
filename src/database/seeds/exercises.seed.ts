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

dotenv.config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV ?? 'local'}`),
});

const ExerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    musclesPrimary: [{ type: String }],
    musclesSecondary: [{ type: String }],
    loadType: { type: String, required: true },
    bilateral: { type: Boolean, default: true },
    gifUrl: { type: String },
    videoUrl: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const EXERCISES = [
  // ── Chest (5) ──────────────────────────────────────────────────────────────
  {
    name: 'Barbell Bench Press',
    musclesPrimary: ['chest'],
    musclesSecondary: ['front_delts', 'triceps'],
    loadType: 'barbell',
    bilateral: true,
  },
  {
    name: 'Incline Dumbbell Press',
    musclesPrimary: ['chest', 'front_delts'],
    musclesSecondary: ['triceps'],
    loadType: 'dumbbell',
    bilateral: true,
  },
  {
    name: 'Dumbbell Chest Fly',
    musclesPrimary: ['chest'],
    musclesSecondary: [],
    loadType: 'dumbbell',
    bilateral: true,
  },
  {
    name: 'Cable Chest Fly',
    musclesPrimary: ['chest'],
    musclesSecondary: [],
    loadType: 'cable',
    bilateral: true,
  },
  {
    name: 'Push-Up',
    musclesPrimary: ['chest', 'triceps'],
    musclesSecondary: ['front_delts'],
    loadType: 'bodyweight',
    bilateral: true,
  },

  // ── Back (6) ───────────────────────────────────────────────────────────────
  {
    name: 'Pull-Up',
    musclesPrimary: ['lats', 'upper_back'],
    musclesSecondary: ['biceps'],
    loadType: 'bodyweight',
    bilateral: true,
  },
  {
    name: 'Barbell Bent-Over Row',
    musclesPrimary: ['upper_back', 'lats'],
    musclesSecondary: ['biceps', 'rear_delts'],
    loadType: 'barbell',
    bilateral: true,
  },
  {
    name: 'Dumbbell One-Arm Row',
    musclesPrimary: ['upper_back', 'lats'],
    musclesSecondary: ['biceps'],
    loadType: 'dumbbell',
    bilateral: false,
  },
  {
    name: 'Cable Lat Pulldown',
    musclesPrimary: ['lats'],
    musclesSecondary: ['biceps', 'upper_back'],
    loadType: 'cable',
    bilateral: true,
  },
  {
    name: 'Seated Cable Row',
    musclesPrimary: ['upper_back'],
    musclesSecondary: ['lats', 'biceps'],
    loadType: 'cable',
    bilateral: true,
  },
  {
    name: 'Face Pull',
    musclesPrimary: ['rear_delts', 'upper_back'],
    musclesSecondary: ['traps'],
    loadType: 'cable',
    bilateral: true,
  },

  // ── Shoulders (4) ─────────────────────────────────────────────────────────
  {
    name: 'Barbell Overhead Press',
    musclesPrimary: ['front_delts', 'side_delts'],
    musclesSecondary: ['triceps', 'traps'],
    loadType: 'barbell',
    bilateral: true,
  },
  {
    name: 'Dumbbell Lateral Raise',
    musclesPrimary: ['side_delts'],
    musclesSecondary: [],
    loadType: 'dumbbell',
    bilateral: true,
  },
  {
    name: 'Arnold Press',
    musclesPrimary: ['front_delts', 'side_delts'],
    musclesSecondary: ['triceps'],
    loadType: 'dumbbell',
    bilateral: true,
  },
  {
    name: 'Rear Delt Fly (Machine)',
    musclesPrimary: ['rear_delts'],
    musclesSecondary: ['upper_back'],
    loadType: 'machine',
    bilateral: true,
  },

  // ── Arms (5) ──────────────────────────────────────────────────────────────
  {
    name: 'Barbell Bicep Curl',
    musclesPrimary: ['biceps'],
    musclesSecondary: ['forearms'],
    loadType: 'barbell',
    bilateral: true,
  },
  {
    name: 'Hammer Curl',
    musclesPrimary: ['biceps', 'forearms'],
    musclesSecondary: [],
    loadType: 'dumbbell',
    bilateral: false,
  },
  {
    name: 'Preacher Curl (Machine)',
    musclesPrimary: ['biceps'],
    musclesSecondary: [],
    loadType: 'machine',
    bilateral: true,
  },
  {
    name: 'Tricep Pushdown (Cable)',
    musclesPrimary: ['triceps'],
    musclesSecondary: [],
    loadType: 'cable',
    bilateral: true,
  },
  {
    name: 'Skull Crushers',
    musclesPrimary: ['triceps'],
    musclesSecondary: [],
    loadType: 'barbell',
    bilateral: true,
  },

  // ── Legs — Quads (4) ──────────────────────────────────────────────────────
  {
    name: 'Barbell Back Squat',
    musclesPrimary: ['quads', 'glutes'],
    musclesSecondary: ['hamstrings', 'lower_back'],
    loadType: 'barbell',
    bilateral: true,
  },
  {
    name: 'Leg Press (Machine)',
    musclesPrimary: ['quads', 'glutes'],
    musclesSecondary: ['hamstrings'],
    loadType: 'machine',
    bilateral: true,
  },
  {
    name: 'Leg Extension (Machine)',
    musclesPrimary: ['quads'],
    musclesSecondary: [],
    loadType: 'machine',
    bilateral: true,
  },
  {
    name: 'Walking Lunges',
    musclesPrimary: ['quads', 'glutes'],
    musclesSecondary: ['hamstrings'],
    loadType: 'dumbbell',
    bilateral: false,
  },

  // ── Legs — Hamstrings & Glutes (4) ────────────────────────────────────────
  {
    name: 'Romanian Deadlift',
    musclesPrimary: ['hamstrings', 'glutes'],
    musclesSecondary: ['lower_back'],
    loadType: 'barbell',
    bilateral: true,
  },
  {
    name: 'Leg Curl (Machine)',
    musclesPrimary: ['hamstrings'],
    musclesSecondary: [],
    loadType: 'machine',
    bilateral: true,
  },
  {
    name: 'Hip Thrust (Barbell)',
    musclesPrimary: ['glutes', 'hamstrings'],
    musclesSecondary: [],
    loadType: 'barbell',
    bilateral: true,
  },
  {
    name: 'Bulgarian Split Squat',
    musclesPrimary: ['glutes', 'quads'],
    musclesSecondary: ['hamstrings'],
    loadType: 'dumbbell',
    bilateral: false,
  },

  // ── Calves (1) ────────────────────────────────────────────────────────────
  {
    name: 'Standing Calf Raise (Machine)',
    musclesPrimary: ['calves'],
    musclesSecondary: [],
    loadType: 'machine',
    bilateral: true,
  },

  // ── Core (4) ──────────────────────────────────────────────────────────────
  {
    name: 'Plank',
    musclesPrimary: ['abs', 'lower_back'],
    musclesSecondary: [],
    loadType: 'bodyweight',
    bilateral: true,
  },
  {
    name: 'Hanging Leg Raise',
    musclesPrimary: ['abs'],
    musclesSecondary: ['obliques'],
    loadType: 'bodyweight',
    bilateral: true,
  },
  {
    name: 'Cable Crunch',
    musclesPrimary: ['abs'],
    musclesSecondary: [],
    loadType: 'cable',
    bilateral: true,
  },
  {
    name: 'Ab Wheel Rollout',
    musclesPrimary: ['abs', 'lower_back'],
    musclesSecondary: [],
    loadType: 'bodyweight',
    bilateral: true,
  },
];

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  await mongoose.connect(mongoUri);

  const ExerciseModel = mongoose.model('Exercise', ExerciseSchema);

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
