// Loads and validates environment variables in ONE place, so the rest of the
// app never touches process.env directly. That makes it easy to swap config
// sources later (e.g. a secrets manager on a VPS) without hunting through
// every file.

require('dotenv').config();
const path = require('path');

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 4000),

  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(process.env.DB_PORT || 5432),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  storage: {
    // Resolved to absolute paths so it doesn't matter which directory you
    // run "npm start" from.
    root: path.resolve(process.env.STORAGE_ROOT || './storage/uploads'),
    chunksRoot: path.resolve(process.env.CHUNKS_ROOT || './storage/chunks'),
  },

  defaultStorageLimitBytes: Number(
    process.env.DEFAULT_STORAGE_LIMIT_BYTES || 5 * 1024 * 1024 * 1024
  ),
};
