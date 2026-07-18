const MandiService = require('./MandiService');
const ApiResponse = require('../../utils/ApiResponse');

class MandiController {
  async getRates(req, res, next) {
    try {
      const rates = await MandiService.getRates(req.user.id, {
        crop: req.query.crop,
        commodity: req.query.commodity,
        state: req.query.state,
        district: req.query.district,
        farm_id: req.query.farm_id,
        expense_total: req.query.expense_total,
        quantity: req.query.quantity,
      });
      return ApiResponse.success(res, rates);
    } catch (error) {
      return next(error);
    }
  }

  async listCommodities(req, res, next) {
    try {
      return ApiResponse.success(res, MandiService.listCommodities());
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = {
  controller: new MandiController(),
};
