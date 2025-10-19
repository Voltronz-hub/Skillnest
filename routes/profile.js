const express = require('express');
const router = express.Router();
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
// File filters and limits
function fileFilter(req, file, cb) {
  // Accept images for profileImage and images or pdf for verificationDoc
  const allowedImage = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
  const allowedDoc = [...allowedImage, 'application/pdf'];
  const field = file.fieldname;
  if (field === 'profileImage') {
    if (allowedImage.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only image files are allowed for profile image'));
  }
  if (field === 'verificationDoc') {
    if (allowedDoc.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only image or PDF files are allowed for verification documents'));
  }
  if (field === 'portfolio') {
    // portfolio accepts images only
    if (allowedImage.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only image files are allowed for portfolio items'));
  }
  cb(new Error('Unexpected field'));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max per file

router.get('/edit', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const user = await User.findById(req.session.userId).lean();
  if (!user) return res.redirect('/auth/login');
  const flash = req.session.userFlash || null;
  delete req.session.userFlash;
  res.render('edit-profile', { profile: user, profileImage: user.profileImage, verificationStatus: user.verificationStatus || 'none', verificationDocs: user.verificationDocs || [], user: user, role: user.role, flash });
});

// Public: list freelancers (Find talent)
router.get('/', async (req, res) => {
  try {
    const freelancers = await User.find({ role: 'freelancer' }).select('username profileImage createdAt');
    res.render('profiles', { freelancers, user: req.session.userId, role: req.session.role });
  } catch (err) {
    console.error('Profiles list error:', err);
    res.status(500).send('Failed to load profiles');
  }
});

// Public: view a single profile
router.get('/view/:id', async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select('-password');
    if (!u) return res.status(404).send('Profile not found');
    res.render('profile-view', { profile: u, user: req.session.userId, role: req.session.role });
  } catch (err) {
    console.error('Profile view error:', err);
    res.status(500).send('Failed to load profile');
  }
});

// Public API: return profile JSON (safe, no password)
router.get('/json/:id', async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select('-password -email').lean();
    if (!u) return res.status(404).json({ error: 'Profile not found' });
    res.json(u);
  } catch (err) {
    console.error('Profile JSON error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Extended profile JSON with reviews summary
router.get('/jsonExtended/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    const u = await User.findById(uid).select('-password -email').lean();
    if (!u) return res.status(404).json({ error: 'Profile not found' });
    const Review = require('../models/Review');
    const Job = require('../models/Job');
    // Find jobs where this user was involved (client or freelancer)
    const jobs = await Job.find({ $or: [{ client: uid }] }).select('_id').lean();
    const jobIds = jobs.map(j => j._id);
    // Find reviews made about these jobs
    const reviews = await Review.find({ job: { $in: jobIds } }).sort({ createdAt: -1 }).limit(5).populate('reviewer', 'username').lean();
    // compute average rating for these reviews
    const agg = await Review.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const avgRating = agg && agg[0] ? Math.round(agg[0].avg * 10) / 10 : null;
    // pick a relevant job id (most recent job)
    const relevantJobId = jobIds.length ? jobIds[0] : null;
    res.json({ profile: u, reviews: reviews, avgRating, relevantJobId });
  } catch (err) {
    console.error('Profile extended error:', err);
    res.status(500).json({ error: 'Failed to load extended profile' });
  }
});

router.post('/edit', upload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'verificationDoc', maxCount: 5 }, { name: 'portfolio', maxCount: 12 }]), async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  try {
    const updates = {};
    const { username, email, name, bio, skills, hourlyRate, location, company } = req.body;

    if (username) updates.username = username;
    if (email) updates.email = email.toLowerCase().trim();
    if (name) updates.name = name;
    if (bio) updates.bio = bio;
    if (skills) {
      // allow comma-separated skills
      updates.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (hourlyRate) updates.hourlyRate = Number(hourlyRate) || undefined;
    if (location) updates.location = location;
    if (company) updates.company = company;

    // If email is changed, ensure uniqueness
    if (updates.email) {
      const existing = await User.findOne({ email: updates.email, _id: { $ne: req.session.userId } });
      if (existing) {
        const cur = await User.findById(req.session.userId).lean();
        return res.render('edit-profile', {
          profile: cur,
          profileImage: req.files && req.files['profileImage'] ? req.files['profileImage'][0].filename : (cur ? cur.profileImage : undefined),
          verificationStatus: cur ? cur.verificationStatus : 'none',
          verificationDocs: cur ? cur.verificationDocs : [],
          error: 'Email already in use by another account.',
          user: cur,
          role: cur ? cur.role : undefined
        });
      }
    }

    // Persist basic updates
    if (Object.keys(updates).length) {
      await User.findByIdAndUpdate(req.session.userId, updates);
    }

    // Handle profile image with 2MB limit
    if (req.files && req.files['profileImage'] && req.files['profileImage'][0]) {
      const f = req.files['profileImage'][0];
      if (f.size > 2 * 1024 * 1024) throw new Error('Profile image must be 2MB or smaller');
      const profileImage = f.filename;
      await User.findByIdAndUpdate(req.session.userId, { profileImage });
    }

    // Handle verification documents with 10MB per file (enforced by multer global limit)
    if (req.files && req.files['verificationDoc'] && req.files['verificationDoc'].length > 0) {
      const docs = req.files['verificationDoc'].map(f => f.filename);
      await User.findByIdAndUpdate(req.session.userId, { $push: { verificationDocs: { $each: docs } }, verificationStatus: 'pending' });
    }

    // Handle portfolio uploads
    if (req.files && req.files['portfolio'] && req.files['portfolio'].length > 0) {
      const files = req.files['portfolio'].map(f => f.filename);
      await User.findByIdAndUpdate(req.session.userId, { $push: { portfolio: { $each: files } } });
    }
  } catch (err) {
    console.error('Profile update error:', err.message);
    // Render with error
  const cur = await User.findById(req.session.userId).lean();
  return res.render('edit-profile', { profile: cur, profileImage: cur ? cur.profileImage : null, verificationStatus: cur ? cur.verificationStatus : 'none', verificationDocs: cur ? cur.verificationDocs : [], error: 'Profile update failed: ' + err.message, user: cur, role: cur ? cur.role : undefined });
  }
  res.redirect('/profile/edit');
});

module.exports = router;