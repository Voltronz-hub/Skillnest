const express = require('express');
const router = express.Router();

// Home page
const User = require('../models/User');
router.get('/', async (req, res) => {
  let profileImage = null;
  if (req.session.userId) {
    const user = await User.findById(req.session.userId);
    if (user && user.profileImage) profileImage = user.profileImage;
  }
  res.render('index', { user: req.session.userId, role: req.session.role, profileImage });
});

// Redirect /profile to /profiles (profiles listing is at /profile via profile router)
router.get('/profiles', async (req, res) => {
  // render by delegating to profile router's list — simple redirect to mounted route
  res.redirect('/profile');
});

module.exports = router;
