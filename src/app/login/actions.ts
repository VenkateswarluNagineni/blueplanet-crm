'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') || '').toLowerCase().trim();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: 'Email and password are required.' };

  const user = await db.user.findFirst({ where: { email, deletedAt: null } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: 'Invalid email or password.' };
  }

  await createSession(user.id);
  redirect('/');
}
