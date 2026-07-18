const FarmFinanceService = require('./FarmFinanceService');
const OrphanMoneyService = require('./OrphanMoneyService');
const ApiResponse = require('../../utils/ApiResponse');

class FinanceController {
  async farmSeasonFinance(req, res, next) {
    try {
      const data = await FarmFinanceService.getSeasonFinance(req.user.id, req.params.farm_id, {
        season: req.query.season,
        year: req.query.year,
      });
      return ApiResponse.success(res, data);
    } catch (error) {
      return next(error);
    }
  }

  async linkOrphans(req, res, next) {
    try {
      const result = await OrphanMoneyService.linkOrphanRecords(req.user.id);
      return ApiResponse.success(res, result, 'Orphan records linked');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = {
  controller: new FinanceController(),
};
