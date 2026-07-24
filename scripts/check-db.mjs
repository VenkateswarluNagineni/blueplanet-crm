import pg from 'pg';

const url =
  process.env.DATABASE_URL ||
  'postgresql://blueplanet:enterprise_secret@127.0.0.1:5432/blueplanet_crm';

const c = new pg.Client({ connectionString: url });
try {
  await c.connect();
  const r = await c.query('SELECT email FROM "User" LIMIT 5');
  console.log('OK users:', r.rows.map((x) => x.email).join(', ') || '(none)');
  process.exit(0);
} catch (e) {
  console.error('DB FAIL:', e.message);
  process.exit(1);
} finally {
  await c.end().catch(() => {});
}
