const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Registration
router.get('/register', (req, res) => {
  res.render('register');
});

router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  const formData = { username: username || '', email: email || '', role: role || 'client' };

  // Basic server-side validation
  if (!username || !email || !password) return res.render('register', { error: 'Username, email and password are required.', formData });

  try {
    const emailLower = email.toLowerCase().trim();

    // If user selected admin, validate admin registration is enabled and code matches
    if (role === 'admin') {
      const adminEnabled = process.env.ADMIN_REGISTRATION_ENABLED === 'true';
      const adminCode = process.env.ADMIN_REGISTRATION_CODE || '';
      const provided = (req.body.adminCode || '').toString();
      if (!adminEnabled) return res.render('register', { error: 'Admin registration is not enabled.', formData });
      if (!adminCode || provided !== adminCode) return res.render('register', { error: 'Invalid admin registration code.', formData });
    }

    // Check for existing email or username first to give friendly errors
    const existingEmail = await User.findOne({ email: emailLower });
    if (existingEmail) return res.render('register', { error: 'An account with that email already exists.', formData });

  // We allow duplicate usernames; only email must be unique.

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email: emailLower, password: hashedPassword, role });
    await user.save();
    req.session.userId = user._id;
    req.session.role = user.role;
    res.redirect('/');
  } catch (err) {
    console.error('Registration error:', err);
    // handle duplicate key errors (race conditions)
    if (err.code === 11000 && err.keyValue) {
      const dupField = Object.keys(err.keyValue)[0];
      return res.render('register', { error: `${dupField} already exists. Please choose another.`, formData });
    }
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(' ');
      return res.render('register', { error: messages || 'Registration failed due to invalid input.', formData });
    }
    res.render('register', { error: 'Registration failed. Please try again.', formData });
  }
});

// Login
router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email) return res.render('login', { error: 'Email is required.' });
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user._id;
    req.session.role = user.role;
    res.redirect('/');
  } else {
    res.render('login', { error: 'Invalid credentials.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
