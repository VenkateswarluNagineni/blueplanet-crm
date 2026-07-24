'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';

export type LoginState = { error?: string };

function isDbUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'P1001' ||
    /ECONNREFUSED|Can't reach database|Connection refused|connect ECONNREFUSED|PrismaClientInitializationError/i.test(
      msg,
    )
  );
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') || '').toLowerCase().trim();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: 'Email and password are required.' };

  try {
    const user = await db.user.findFirst({ where: { email, deletedAt: null } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return { error: 'Invalid email or password.' };
    }

    await createSession(user.id);
  } catch (err) {
    console.error('[loginAction]', err);
    if (isDbUnavailable(err)) {
      return {
        error:
          'Database is offline. Start PostgreSQL (Docker container blueplanet-pg on port 5432), then try again.',
      };
    }
    return { error: 'Sign-in failed due to a server error. Check the app logs and try again.' };
  }

  redirect('/');
}
