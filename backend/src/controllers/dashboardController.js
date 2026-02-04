const { getDashboardStats, getAvailableYears, getLatestPeriode, getHPPActualVsStandard } = require('../models/dashboardModel');

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

  /**
   * Get HPP Actual vs Standard comparison
   * GET /api/dashboard/actual-vs-standard?year=2026&mode=YTD&month=1
   */
  static async getActualVsStandard(req, res) {
    try {
      const { year, mode = 'YTD', month } = req.query;
      const monthNum = month ? parseInt(month) : null;
      
      const data = await getHPPActualVsStandard(year, mode, monthNum);
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error fetching HPP Actual vs Standard:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving HPP Actual vs Standard comparison',
        error: error.message
      });
    }
  }
}

module.exports = DashboardController;
