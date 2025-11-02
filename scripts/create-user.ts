import dotenv from 'dotenv';
import path from 'path';
import { hashPassword } from '../src/lib/password-utils';

async function createUser() {
  try {
    const User = (await import('../src/models/User')).default;
    const password = await hashPassword('qazwsxedc');
    const newUser = new User({
      name: 'Mastwal Mesfin',
      email: 'anime.game7415@protonmail.com',
      password_hash: password,
      gender: 'Male',
      userTag: 'mastwalmesfin',
      user_type: 'admin',
      createdAt: new Date(),
      tags: ['developer', 'admin'],
      credentials: [],
      subscribersCount: 0,
      totalViews: 0,
      provider: 'credentials',
    });
    await newUser.save();
    console.log('User created successfully:', newUser);
  } catch (error) {
    console.error('Error creating user:', error);
  }
}

export async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  console.log('Environment variables loaded.');

  const dbConnect = (await import('@/lib/mongodb')).default;
  await dbConnect();
  console.log('Connected to MongoDB.');

  await createUser();

  process.exit(0);
}

main();
