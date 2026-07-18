const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const db = require('../db/connection');

async function authenticate(req, res, next) {
  try {
    const auth_header = req.headers.authorization;

    if (!auth_header || !auth_header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication token required');
    }

    const token = auth_header.split(' ')[1];
    const payload = jwt.verify(token, env.jwt_secret);

    const user = await db('users')
      .where({ id: payload.user_id, is_active: true })
      .first();

    if (!user) {
      throw ApiError.unauthorized('Invalid or expired session');
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Invalid or expired session'));
    }

    return next(error);
  }
}

module.exports = authenticate;
