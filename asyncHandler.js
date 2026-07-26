// Express doesn't automatically catch errors thrown inside "async"
// controller functions. Wrapping a controller with asyncHandler means any
// rejected promise / thrown error is passed to next(err), which our
// centralized errorHandler middleware then deals with. This saves us from
// writing try/catch in every single controller.

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
