// Everything related to passwords and tokens lives here, separate from the
// HTTP layer (controllers). This makes it testable and reusable.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const SALT_ROUNDS = 10; // higher = slower but more secure; 10 is a solid default

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

// Access tokens are short-lived and sent with every API request.
function generateAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

// Refresh tokens are long-lived and only used to obtain a new access token
// once the access token expires, so the user doesn't have to log in again
// every 15 minutes.
function generateRefreshToken(user) {
  return jwt.sign({ sub: user.id }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
