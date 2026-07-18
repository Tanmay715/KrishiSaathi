const Joi = require('joi');
const IncomeService = require('./IncomeService');
const ApiResponse = require('../../utils/ApiResponse');

const INCOME_CATEGORIES = ['harvest', 'sale', 'subsidy', 'other'];

class IncomeController {
  async list(req, res, next) {
    try {
      const incomes = await IncomeService.listFarmIncomes(req.user.id, req.params.farm_id);
      return ApiResponse.success(res, incomes);
    } catch (error) {
      return next(error);
    }
  }

  async summary(req, res, next) {
    try {
      const summary = await IncomeService.getIncomeSummary(req.user.id);
      return ApiResponse.success(res, summary);
    } catch (error) {
      return next(error);
    }
  }

  async pending(req, res, next) {
    try {
      const crops = await IncomeService.getPendingIncomeCrops(req.user.id);
      return ApiResponse.success(res, crops);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const income = await IncomeService.createIncome(req.user.id, req.params.farm_id, req.body);
      return ApiResponse.created(res, income, 'Income logged');
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await IncomeService.deleteIncome(req.user.id, req.params.farm_id, req.params.income_id);
      return ApiResponse.success(res, null, 'Income deleted');
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const income = await IncomeService.updateIncome(
        req.user.id,
        req.params.farm_id,
        req.params.income_id,
        req.body,
      );
      return ApiResponse.success(res, income, 'Income updated');
    } catch (error) {
      return next(error);
    }
  }
}

const create_income_schema = Joi.object({
  plot_id: Joi.string().uuid().optional().allow(null, ''),
  crop_cycle_id: Joi.string().uuid().optional().allow(null, ''),
  category: Joi.string()
    .valid(...INCOME_CATEGORIES)
    .optional(),
  title: Joi.string().max(150).required(),
  amount: Joi.number().positive().required(),
  quantity: Joi.number().min(0).optional().allow(null),
  unit: Joi.string().max(40).optional().allow('', null),
  income_date: Joi.date().iso().required(),
  notes: Joi.string().allow('', null).optional(),
});

const update_income_schema = create_income_schema
  .fork(['title', 'amount', 'income_date'], (schema) => schema.optional())
  .min(1);

module.exports = {
  controller: new IncomeController(),
  create_income_schema,
  update_income_schema,
  INCOME_CATEGORIES,
};
