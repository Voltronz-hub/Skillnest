const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware to check freelancer role
const requireFreelancer = (req, res, next) => {
  if (req.session.role !== 'freelancer') {
    return res.status(403).render('error', {
      message: 'Access Denied',
      error: 'This page is only accessible to freelancers',
      status: 403
    });
  }
  next();
};

// Middleware to check client role
const requireClient = (req, res, next) => {
  if (req.session.role !== 'client') {
    return res.status(403).render('error', {
      message: 'Access Denied',
      error: 'This page is only accessible to clients',
      status: 403
    });
  }
  next();
};

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.session.role !== 'admin') {
    return res.status(403).render('error', {
      message: 'Access Denied',
      error: 'This page is only accessible to administrators',
      status: 403
    });
  }
  next();
};

// Freelancer earnings analytics
router.get('/freelancer/earnings', requireAuth, requireFreelancer, analyticsController.getFreelancerAnalytics);

// Client performance analytics
router.get('/client/performance', requireAuth, requireClient, analyticsController.getClientAnalytics);

// Admin platform insights
router.get('/admin/insights', requireAuth, requireAdmin, analyticsController.getAdminAnalytics);

module.exports = router;
