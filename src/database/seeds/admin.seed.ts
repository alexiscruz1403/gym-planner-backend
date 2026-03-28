/**
 * Admin Seed Script
 *
 * Creates or promotes an admin user.
 * Run with: npm run seed:admin
 *
 * Required env vars:
 *   MONGODB_URI        — MongoDB connection string
 *   SEED_ADMIN_EMAIL   — Admin email (default: admin@gymplanner.dev)
 *   SEED_ADMIN_USERNAME — Admin username (default: admin)
 *   SEED_ADMIN_PASSWORD — Admin plain-text password (required)
 */

import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV ?? 'local'}`),
});

const BCRYPT_ROUNDS = 10;

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String },
    username: { type: String, required: true, unique: true },
    avatar: { type: String },
    googleId: { type: String, sparse: true, unique: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is not defined in environment variables',
    );
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@gymplanner.dev';
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';

  await mongoose.connect(mongoUri);

  const UserModel = mongoose.model('User', UserSchema);

  const existing = await UserModel.findOne({ email: adminEmail }).exec();

  if (existing) {
    await UserModel.updateOne(
      { email: adminEmail },
      { $set: { role: 'admin' } },
    ).exec();
    console.log(`Admin role granted to existing user: ${adminEmail}`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    await UserModel.create({
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      role: 'admin',
    });
    console.log(`Admin user created: ${adminEmail}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
