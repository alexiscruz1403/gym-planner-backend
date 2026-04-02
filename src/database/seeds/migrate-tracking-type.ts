/**
 * Migration: backfill trackingType on existing Exercise documents
 *
 * Sets trackingType = 'reps' on all exercises that do not yet have the field.
 * The only exception is 'Plank', which is set to 'duration'.
 *
 * Idempotent: safe to run multiple times.
 * Run with: npm run migrate:tracking-type
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

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  await mongoose.connect(mongoUri);

  const ExerciseModel = mongoose.model(Exercise.name, ExerciseSchema);

  // Backfill all exercises that do not have trackingType with 'reps'
  const repsResult = await ExerciseModel.updateMany(
    { trackingType: { $exists: false } },
    { $set: { trackingType: 'reps' } },
  );

  console.log(
    `Set trackingType = 'reps' on ${repsResult.modifiedCount} exercise(s)`,
  );

  // Override Plank specifically to 'duration'
  const plankResult = await ExerciseModel.updateOne(
    { name: 'Plank', trackingType: 'reps' },
    { $set: { trackingType: 'duration' } },
  );

  if (plankResult.modifiedCount > 0) {
    console.log(`Set trackingType = 'duration' on 'Plank'`);
  }

  await mongoose.disconnect();
  console.log('Migration complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
