import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const r = await pool.query(
    `select id, email, role, left("passwordHash", 25) as hash_prefix from "User" where "deletedAt" is null order by email`,
  );
  console.log('USERS', r.rows);
  const admin = r.rows.find((u) => u.email === 'admin@blueplanet.com');
  if (!admin) {
    console.log('NO admin@blueplanet.com user — need seed');
  } else {
    const full = await pool.query(`select "passwordHash" from "User" where email = $1`, [
      'admin@blueplanet.com',
    ]);
    const ok = await bcrypt.compare('admin123', full.rows[0].passwordHash);
    console.log('admin123 matches:', ok);
  }
  console.log('AUTH_SECRET set:', !!process.env.AUTH_SECRET);
  console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
} catch (e) {
  console.error('DB ERROR', e.message);
  console.error(e);
} finally {
  await pool.end();
}
