const { getDashboardStats, getAvailableYears, getLatestPeriode, getHPPActualVsStandard, getActualVsStandardTrend, getActualVsStandardByPeriode, getActualDashboardStats } = require('../models/dashboardModel');

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

  /**
   * Get HPP Actual vs Standard 12-month trend
   * GET /api/dashboard/actual-vs-standard/trend?lob=ALL
   */
  static async getActualVsStandardTrend(req, res) {
    try {
      const { lob = 'ALL' } = req.query;
      
      const data = await getActualVsStandardTrend(lob);
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error fetching HPP Actual vs Standard trend:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving HPP Actual vs Standard trend',
        error: error.message
      });
    }
  }

  /**
   * Get HPP Actual vs Standard batches for a specific periode
   * GET /api/dashboard/actual-vs-standard/by-periode?periode=202601&lob=ALL
   */
  static async getActualVsStandardByPeriode(req, res) {
    try {
      const { periode, lob = 'ALL' } = req.query;
      
      if (!periode) {
        return res.status(400).json({
          success: false,
          message: 'Periode is required'
        });
      }
      
      const data = await getActualVsStandardByPeriode(periode, lob);
      
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error fetching HPP Actual vs Standard by periode:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving HPP Actual vs Standard by periode',
        error: error.message
      });
    }
  }

  /**
   * Get dashboard statistics from HPP Actual batches
   * GET /api/dashboard/stats/actual?year=2026
   */
  static async getActualStats(req, res) {
    try {
      const { year } = req.query;
      const stats = await getActualDashboardStats(year);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching actual dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving actual dashboard statistics',
        error: error.message
      });
    }
  }
}

module.exports = DashboardController;
