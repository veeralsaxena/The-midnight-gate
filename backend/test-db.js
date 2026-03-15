const pool = require('./src/database/client');

async function test() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Postgres Connected:', res.rows[0]);
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tables:', tables.rows.map(t => t.table_name));
    process.exit(0);
  } catch (err) {
    console.error('❌ Postgres Connection Failed:', err.message);
    process.exit(1);
  }
}

test();
