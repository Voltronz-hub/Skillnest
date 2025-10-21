const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Proposal = require('../models/Proposal');
const Milestone = require('../models/Milestone');
const Review = require('../models/Review');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });
const SavedSearch = require('../models/SavedSearch');
const Notification = require('../models/Notification');
const requireProfileComplete = require('../middleware/requireProfileComplete');

// List jobs
router.get('/', async (req, res) => {
  try {
    // populate client; if client was deleted or missing, filter those jobs out
    let jobs = await Job.find().populate('client');
    jobs = jobs.filter(j => j.client && j.client.username);
    res.render('jobs', {
      jobs,
      user: req.session.userId,
      role: req.session.role
    });
  } catch (err) {
    console.error('Failed loading jobs:', err);
    res.status(500).send('Server error');
  }
});

// Post a job (client only)
router.get('/post', (req, res) => {
  if (req.session.role !== 'freelancer') return res.redirect('/jobs');
  res.render('post-job');
});

// Require freelancer profile completeness before posting
// Require freelancer profile complete and admin approval before posting a job
router.post('/post', requireProfileComplete('freelancer', { requireAdminApproval: true }), upload.single('attachment'), async (req, res) => {
  if (req.session.role !== 'freelancer') return res.redirect('/jobs');
  const { title, description } = req.body;
  let attachment = null;
  if (req.file) {
    attachment = req.file.filename;
  }
  const job = new Job({ title, description, client: req.session.userId, attachment });
  await job.save();

  // After saving a job, match against saved searches and create notifications
  try {
    const searches = await SavedSearch.find({});
    const text = (title + ' ' + (req.body.tags || '') + ' ' + (description || '')).toLowerCase();
    for (const s of searches) {
      const q = s.query || {};
      // simple matching: if query.q exists and is contained in text, or tags overlap
      let matched = false;
      if (q.q && typeof q.q === 'string' && text.includes(q.q.toLowerCase())) matched = true;
      if (!matched && q.tags && Array.isArray(q.tags)) {
        const tags = (req.body.tags || '').split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);
        for (const t of q.tags) { if (tags.includes((t||'').toLowerCase())) { matched = true; break; } }
      }
      if (matched) {
        // create a notification for the user
        const n = new Notification({ user: s.user, type: 'job_match', message: `New job matched your saved search "${s.name}"`, link: `/jobs/${job._id}` });
        await n.save();
        // if socket.io available, emit to that user
        const io = req.app.get('io');
        if (io && global.__onlineUsers && global.__onlineUsers.has('' + s.user)) {
          io.emit('notification', { user: s.user, notification: { message: n.message, link: n.link, createdAt: n.createdAt } });
        }
      }
    }
  } catch (err) { console.error('saved search matching error', err); }
  res.redirect('/jobs');
});

// Job details
router.get('/:id', async (req, res) => {
  const job = await Job.findById(req.params.id).populate('client proposals milestones');
  res.render('job-details', {
    job,
    user: req.session.userId,
    role: req.session.role
  });
});

module.exports = router;
