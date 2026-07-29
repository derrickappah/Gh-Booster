const ServiceService = require('../services/serviceService');

class ServiceController {
  static async getServices(req, res, next) {
    try {
      const data = await ServiceService.getAllServices();
      res.json({
        success: true,
        ...data
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ServiceController;
