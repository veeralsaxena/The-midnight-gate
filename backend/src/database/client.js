const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.PG_USER || 'admin',
        host: process.env.PG_HOST || 'localhost',
        database: process.env.PG_DATABASE || 'midnight_drop',
        password: process.env.PG_PASSWORD || 'password',
        port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5433,
      }
);

pool.on('error', (err) => {
  console.error('Postgres Pool Error', err);
});

module.exports = pool;
