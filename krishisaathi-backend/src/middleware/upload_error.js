const ApiError = require('../utils/ApiError');

function handleUploadError(error, req, res, next) {
  if (!error) {
    return next();
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return next(ApiError.badRequest('Image must be 5 MB or smaller'));
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return next(ApiError.badRequest('Unexpected file field'));
  }

  return next(error);
}

module.exports = handleUploadError;
