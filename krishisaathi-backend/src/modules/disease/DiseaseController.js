const DiseaseService = require('./DiseaseService');
const ApiResponse = require('../../utils/ApiResponse');

class DiseaseController {
  async list(req, res, next) {
    try {
      const scans = await DiseaseService.listScans(req.user.id, req.params.farm_id);
      return ApiResponse.success(res, scans);
    } catch (error) {
      return next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const scan = await DiseaseService.getScan(
        req.user.id,
        req.params.farm_id,
        req.params.scan_id,
      );
      return ApiResponse.success(res, scan);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const scan = await DiseaseService.createScan(
        req.user.id,
        req.params.farm_id,
        req.file,
        {
          plot_id: req.body.plot_id || null,
          crop_cycle_id: req.body.crop_cycle_id || null,
        },
      );
      return ApiResponse.created(res, scan, 'Disease scan completed');
    } catch (error) {
      return next(error);
    }
  }

  async image(req, res, next) {
    try {
      const scan = await DiseaseService.getScan(
        req.user.id,
        req.params.farm_id,
        req.params.scan_id,
      );
      const file_path = DiseaseService.getImageAbsolutePath(scan.image_path);
      return res.sendFile(file_path);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = {
  controller: new DiseaseController(),
};
