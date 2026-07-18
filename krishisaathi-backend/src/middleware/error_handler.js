const ApiError = require('../utils/ApiError');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Image must be 5 MB or smaller',
      errors: null,
    });
  }

  const status_code = error.status_code || 500;
  const message = error.is_operational ? error.message : 'Internal server error';

  if (!error.is_operational) {
    console.error('[error]', error);
  }

  return res.status(status_code).json({
    success: false,
    message,
    errors: error.errors || null,
  });
}

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
