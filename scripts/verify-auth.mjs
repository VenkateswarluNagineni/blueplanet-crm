import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { SignJWT, jwtVerify } from 'jose';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-insecure-secret-change-me');

try {
  const user = await db.user.findFirst({ where: { email: 'admin@blueplanet.com', deletedAt: null } });
  if (!user) throw new Error('no admin user');
  const ok = await bcrypt.compare('admin123', user.passwordHash);
  console.log('password ok', ok);
  const token = await new SignJWT({ uid: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
  const { payload } = await jwtVerify(token, SECRET);
  console.log('jwt ok', payload.uid === user.id);
  const again = await db.user.findFirst({ where: { id: user.id, deletedAt: null } });
  console.log('session user load ok', !!again);
  console.log('LOGIN_PATH_OK');
} catch (e) {
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
  await pool.end();
}
