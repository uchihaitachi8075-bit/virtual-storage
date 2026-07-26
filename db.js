// A single shared PostgreSQL connection pool for the whole app.
// "Pooling" means we reuse a small number of open DB connections instead of
// opening a brand new one for every request, which would be slow.

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
});

pool.on('error', (err) => {
  // This fires if an idle client in the pool throws an error in the
  // background (e.g. the DB connection was dropped). We log it instead of
  // crashing the whole server.
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = {
  // Use this for simple one-off queries: db.query('SELECT ...', [params])
  query: (text, params) => pool.query(text, params),
  pool,
};
