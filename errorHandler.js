// Express recognizes this as an "error-handling middleware" because it takes
// FOUR arguments (err, req, res, next). It must be registered LAST, after all
// routes, in app.js. Every thrown/forwarded error in the app ends up here so
// error responses stay consistent instead of each route formatting its own.

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (statusCode === 500) {
    // Only log unexpected errors loudly — expected errors (400s, 404s) are
    // normal application flow, not bugs.
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

module.exports = errorHandler;
