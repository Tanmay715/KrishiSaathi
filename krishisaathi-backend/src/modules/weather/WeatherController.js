const WeatherService = require('./WeatherService');
const ApiResponse = require('../../utils/ApiResponse');

class WeatherController {
  async getWeather(req, res, next) {
    try {
      const weather = await WeatherService.getWeatherForUser(req.user.id, req.query.farm_id || null);
      return ApiResponse.success(res, weather);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = {
  controller: new WeatherController(),
};
