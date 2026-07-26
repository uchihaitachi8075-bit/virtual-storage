// Protects routes by requiring a valid "Bearer <token>" Authorization header.
// On success it attaches req.userId so downstream controllers know who is
// making the request.

const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../services/auth.service');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Missing or invalid Authorization header'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = requireAuth;
