// "Model" here just means: a module whose only job is talking to the
// `users` table. Controllers/services never write raw SQL themselves — they
// call these functions instead. That way, if you ever swap PostgreSQL for
// something else, only this file needs to change.

const db = require('../config/db');

async function createUser({ email, passwordHash, storageLimit }) {
  const result = await db.query(
    `INSERT INTO users (email, password_hash, storage_limit, storage_used)
     VALUES ($1, $2, $3, 0)
     RETURNING id, email, storage_limit, storage_used, created_at`,
    [email, passwordHash, storageLimit]
  );
  return result.rows[0];
}

async function findByEmail(email) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await db.query(
    'SELECT id, email, storage_limit, storage_used, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// Atomically increases storage_used. Using "storage_used + $2" in SQL
// (instead of reading the value in JS, adding, then writing it back) avoids
// a race condition if two uploads finish at nearly the same time.
async function incrementStorageUsed(userId, deltaBytes) {
  const result = await db.query(
    `UPDATE users SET storage_used = storage_used + $2
     WHERE id = $1
     RETURNING storage_used, storage_limit`,
    [userId, deltaBytes]
  );
  return result.rows[0];
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  incrementStorageUsed,
};
