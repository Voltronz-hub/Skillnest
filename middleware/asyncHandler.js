// Async handler wrapper for Express routes/controllers
// Usage: const asyncHandler = require('../middleware/asyncHandler');
// exports.myRoute = asyncHandler(async (req, res, next) => { ... });
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
