const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const userModel = require('../models/user.model');
const authService = require('../services/auth.service');
const env = require('../config/env');

// Very small email/password sanity checks. Not exhaustive, but stops the
// most obvious bad input before it reaches the database.
function validateSignupInput(email, password) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new ApiError(400, 'A valid email is required');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }
}

const signup = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  validateSignupInput(email, password);

  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await authService.hashPassword(password);
  const user = await userModel.createUser({
    email,
    passwordHash,
    storageLimit: env.defaultStorageLimitBytes,
  });

  const accessToken = authService.generateAccessToken(user);
  const refreshToken = authService.generateRefreshToken(user);

  res.status(201).json({
    success: true,
    user: { id: user.id, email: user.email, storageLimit: user.storage_limit },
    accessToken,
    refreshToken,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const user = await userModel.findByEmail(email);
  if (!user) {
    // Same error for "no such user" and "wrong password" on purpose —
    // this avoids leaking which emails are registered.
    throw new ApiError(401, 'Invalid email or password');
  }

  const passwordMatches = await authService.verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const accessToken = authService.generateAccessToken(user);
  const refreshToken = authService.generateRefreshToken(user);

  res.json({
    success: true,
    user: { id: user.id, email: user.email, storageLimit: user.storage_limit },
    accessToken,
    refreshToken,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(400, 'refreshToken is required');
  }

  let payload;
  try {
    payload = authService.verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await userModel.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  const accessToken = authService.generateAccessToken(user);
  res.json({ success: true, accessToken });
});

module.exports = { signup, login, refresh };
