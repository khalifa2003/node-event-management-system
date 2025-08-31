const express = require('express');
const {
  getDashboardStats,
  getSalesAnalytics,
  getAudienceDemographics,
  getEventPerformance,
  exportAnalytics
} = require('../services/analyticsService');

const authService = require('../services/authService');

const router = express.Router();

// All routes require admin access
router.use(authService.protect);
router.use(authService.allowedTo('admin', 'manager'));

router.get('/dashboard', getDashboardStats);
router.get('/sales', getSalesAnalytics);
router.get('/demographics', getAudienceDemographics);
router.get('/events/performance', getEventPerformance);
router.get('/export', exportAnalytics);

module.exports = router;