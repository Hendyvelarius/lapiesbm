const { getDashboardStats, getAvailableYears, getLatestPeriode } = require('../models/dashboardModel');

class DashboardController {
  /**
   * Get comprehensive dashboard statistics
   * GET /api/dashboard/stats?year=2025
   */
  static async getStats(req, res) {
    try {
      const { year } = req.query;
      const stats = await getDashboardStats(year);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving dashboard statistics',
        error: error.message
      });
    }
  }

  /**
   * Get available years for dashboard
   * GET /api/dashboard/years
   */
  static async getYears(req, res) {
    try {
      const years = await getAvailableYears();
      const latestYear = await getLatestPeriode();
      
      res.status(200).json({
        success: true,
        data: {
          years,
          latestYear
        }
      });
    } catch (error) {
      console.error('Error fetching available years:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving available years',
        error: error.message
      });
    }
  }
}

module.exports = DashboardController;
