const express = require('express');
const auth_routes = require('../modules/auth/auth_routes');
const user_routes = require('../modules/users/user_routes');
const farm_routes = require('../modules/farms/farm_routes');
const plot_routes = require('../modules/plots/plot_routes');
const crop_template_routes = require('../modules/crops/crop_template_routes');
const crop_cycle_routes = require('../modules/crops/crop_cycle_routes');
const expense_routes = require('../modules/expenses/expense_routes');
const income_routes = require('../modules/incomes/income_routes');
const assistant_routes = require('../modules/assistant/assistant_routes');
const disease_routes = require('../modules/disease/disease_routes');
const reminder_routes = require('../modules/reminders/reminder_routes');
const mandi_routes = require('../modules/mandi/mandi_routes');
const { controller: expense_controller } = require('../modules/expenses/ExpenseController');
const { controller: income_controller } = require('../modules/incomes/IncomeController');
const { controller: weather_controller } = require('../modules/weather/WeatherController');
const { controller: finance_controller } = require('../modules/finance/FinanceController');
const ActivityService = require('../modules/activity/ActivityService');
const authenticate = require('../middleware/auth');
const ApiResponse = require('../utils/ApiResponse');
const db = require('../db/connection');
const redis = require('../config/redis');

const router = express.Router();

router.get('/health', async (req, res) => {
  const checks = { db: false, redis: false };

  try {
    await db.raw('SELECT 1');
    checks.db = true;
  } catch (error) {
    checks.db = false;
  }

  try {
    if (redis.status !== 'ready') {
      await redis.connect().catch(() => null);
    }

    const pong = await redis.ping();
    checks.redis = pong === 'PONG';
  } catch (error) {
    checks.redis = false;
  }

  const is_ok = checks.db && checks.redis;

  return res.status(is_ok ? 200 : 503).json({
    success: is_ok,
    data: {
      status: is_ok ? 'ok' : 'degraded',
      service: 'krishisaathi-api',
      checks,
    },
  });
});

router.use('/auth', auth_routes);
router.use('/users', user_routes);
router.use('/farms', farm_routes);
router.use('/farms/:farm_id/plots', plot_routes);
router.use('/farms/:farm_id/plots', crop_cycle_routes);
router.use('/farms/:farm_id/expenses', expense_routes);
router.use('/farms/:farm_id/incomes', income_routes);
router.use('/farms/:farm_id/disease-scans', disease_routes);
router.use('/crop-templates', crop_template_routes);
router.use('/assistant', assistant_routes);
router.use('/reminders', reminder_routes);
router.use('/mandi', mandi_routes);

router.get('/expenses/summary', authenticate, expense_controller.summary.bind(expense_controller));
router.get('/incomes/summary', authenticate, income_controller.summary.bind(income_controller));
router.get('/incomes/pending', authenticate, income_controller.pending.bind(income_controller));
router.post('/money/link-orphans', authenticate, finance_controller.linkOrphans.bind(finance_controller));
router.get('/farms/:farm_id/finance', authenticate, finance_controller.farmSeasonFinance.bind(finance_controller));
router.get('/weather', authenticate, weather_controller.getWeather.bind(weather_controller));

router.get('/activity', authenticate, async (req, res, next) => {
  try {
    const activities = await ActivityService.getRecentActivities(req.user.id);
    return ApiResponse.success(res, activities);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
