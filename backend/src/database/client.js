const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'midnight_gate',
  password: process.env.PG_PASSWORD || 'postgres',
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5433,
});

pool.on('error', (err) => {
  console.error('Postgres Pool Error', err);
});

module.exports = pool;
