const Joi = require('joi');
const ExpenseService = require('./ExpenseService');
const ExpenseParseService = require('./ExpenseParseService');
const ApiResponse = require('../../utils/ApiResponse');
const { parseDateRange } = require('../../utils/date_range');

const EXPENSE_CATEGORIES = [
  'seed',
  'fertilizer',
  'pesticide',
  'irrigation',
  'labor',
  'equipment',
  'transport',
  'other',
];

class ExpenseController {
  async list(req, res, next) {
    try {
      const expenses = await ExpenseService.listFarmExpenses(req.user.id, req.params.farm_id);
      return ApiResponse.success(res, expenses);
    } catch (error) {
      return next(error);
    }
  }

  async listForPlot(req, res, next) {
    try {
      const expenses = await ExpenseService.listPlotExpenses(
        req.user.id,
        req.params.farm_id,
        req.params.plot_id,
      );
      return ApiResponse.success(res, expenses);
    } catch (error) {
      return next(error);
    }
  }

  async summary(req, res, next) {
    try {
      const summary = await ExpenseService.getExpenseSummary(
        req.user.id,
        parseDateRange(req.query),
      );
      return ApiResponse.success(res, summary);
    } catch (error) {
      return next(error);
    }
  }

  async parse(req, res, next) {
    try {
      const draft = await ExpenseParseService.parseTranscript(
        req.user.id,
        req.params.farm_id,
        req.body,
      );
      return ApiResponse.success(res, draft);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const expense = await ExpenseService.createExpense(req.user.id, req.params.farm_id, req.body);
      return ApiResponse.created(res, expense, 'Expense logged');
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const expense = await ExpenseService.updateExpense(
        req.user.id,
        req.params.farm_id,
        req.params.expense_id,
        req.body,
      );
      return ApiResponse.success(res, expense, 'Expense updated');
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await ExpenseService.deleteExpense(req.user.id, req.params.farm_id, req.params.expense_id);
      return ApiResponse.success(res, null, 'Expense deleted');
    } catch (error) {
      return next(error);
    }
  }
}

const create_expense_schema = Joi.object({
  plot_id: Joi.string().uuid().optional().allow(null, ''),
  crop_cycle_id: Joi.string().uuid().optional().allow(null, ''),
  category: Joi.string()
    .valid(...EXPENSE_CATEGORIES)
    .optional(),
  title: Joi.string().max(150).required(),
  amount: Joi.number().positive().required(),
  quantity: Joi.number().min(0).optional().allow(null),
  unit: Joi.string().max(40).optional().allow('', null),
  expense_date: Joi.date().iso().required(),
  notes: Joi.string().allow('', null).optional(),
});

const update_expense_schema = create_expense_schema
  .fork(['title', 'amount', 'expense_date'], (schema) => schema.optional())
  .min(1);

const parse_expense_schema = Joi.object({
  transcript: Joi.string().min(2).max(2000).required(),
  plot_id: Joi.string().uuid().optional().allow(null),
  crop_cycle_id: Joi.string().uuid().optional().allow(null),
});

module.exports = {
  controller: new ExpenseController(),
  create_expense_schema,
  update_expense_schema,
  parse_expense_schema,
  EXPENSE_CATEGORIES,
};
