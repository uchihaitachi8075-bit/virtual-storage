// A small custom Error subclass that carries an HTTP status code.
// Controllers/services throw `new ApiError(404, "File not found")` and the
// centralized error handler turns that into a proper JSON response.

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = ApiError;
