const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/error_handler');

const app = express();

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (env.cors_origin.includes(origin)) {
    return true;
  }

  if (env.is_production && /^https:\/\/([\w-]+\.)*vercel\.app$/i.test(origin)) {
    return true;
  }

  return !env.is_production && /localhost|127\.0\.0\.1/.test(origin);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (!env.is_production) {
  app.use(morgan('dev'));
}

app.use(env.api_prefix, routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
