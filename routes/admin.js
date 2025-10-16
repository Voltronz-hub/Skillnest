const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Proposal = require('../models/Proposal');
const Dispute = require('../models/Dispute');
const bcrypt = require('bcryptjs');

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');
  if (req.session.role !== 'admin') return res.status(403).render('error', { message: 'Access Denied', error: 'You do not have permission to access this page', status: 403 });
  next();
};

// Minimal admin dashboard
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [userCount, jobCount, proposalCount] = await Promise.all([User.countDocuments(), Job.countDocuments(), Proposal.countDocuments()]);
    const escrowJobs = await Job.find({ paymentStatus: 'held' });
    const escrowTotal = escrowJobs.reduce((total, job) => total + (job.escrowAmount || 0), 0);
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('username email role createdAt');
  const recentJobs = await Job.find().populate('client', 'username').sort({ createdAt: -1 }).limit(5);
    res.render('admin/dashboard', { user: req.session.userId, role: req.session.role, stats: { userCount, jobCount, proposalCount, escrowTotal }, recentUsers, recentJobs });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).render('error', { message: 'Dashboard Error', error: 'Failed to load dashboard data', status: 500 });
  }
});

// List pending verification requests
router.get('/verifications', requireAdmin, async (req, res) => {
  try {
    const pending = await User.find({ verificationStatus: 'pending' }).select('username verificationDocs verificationStatus');
    // read and clear any admin flash message stored in session
    const flash = req.session.adminFlash || null;
    delete req.session.adminFlash;
    res.render('admin/verifications', { pending, flash });
  } catch (err) {
    console.error('Verifications list error:', err);
    res.status(500).render('error', { message: 'Verifications Error', error: 'Failed to load verifications', status: 500 });
  }
});

// Approve a verification
router.post('/verifications/:id/approve', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await User.findByIdAndUpdate(id, { verificationStatus: 'approved', verified: true });
    req.session.adminFlash = `User ${id} approved.`;
    res.redirect('/admin/verifications');
  } catch (err) {
    console.error('Approve verification error:', err);
    res.status(500).render('error', { message: 'Approve Error', error: 'Failed to approve verification', status: 500 });
  }
});

// Reject a verification
router.post('/verifications/:id/reject', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const reason = req.body.reason || null;
    await User.findByIdAndUpdate(id, { verificationStatus: 'rejected', verified: false });
    req.session.adminFlash = `User ${id} rejected.` + (reason ? ` Reason: ${reason}` : '');
    res.redirect('/admin/verifications');
  } catch (err) {
    console.error('Reject verification error:', err);
    res.status(500).render('error', { message: 'Reject Error', error: 'Failed to reject verification', status: 500 });
  }
});

// Admin Tools page
router.get('/tools', requireAdmin, async (req, res) => {
  try {
    const flash = req.session.adminFlash || null;
    delete req.session.adminFlash;
    res.render('admin/tools', { flash });
  } catch (err) {
    console.error('Admin tools error:', err);
    res.status(500).render('error', { message: 'Tools Error', error: 'Failed to load admin tools', status: 500 });
  }
});

// Purge orphaned jobs
router.post('/tools/purge-orphan-jobs', requireAdmin, async (req, res) => {
  try {
    const jobs = await Job.find().select('_id client');
    const orphanIds = [];
    for (const j of jobs) {
      if (!j.client) {
        orphanIds.push(j._id);
        continue;
      }
      const exists = await User.exists({ _id: j.client });
      if (!exists) orphanIds.push(j._id);
    }
    if (orphanIds.length) await Job.deleteMany({ _id: { $in: orphanIds } });
    req.session.adminFlash = `Purged ${orphanIds.length} orphaned job(s).`;
    res.redirect('/admin/tools');
  } catch (err) {
    console.error('Purge orphan jobs error:', err);
    res.status(500).render('error', { message: 'Purge Error', error: 'Failed to purge orphan jobs', status: 500 });
  }
});

// Export users as CSV
router.get('/tools/export-users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('username email role createdAt');
    const header = ['username', 'email', 'role', 'createdAt'];
    const lines = [header.join(',')];
    for (const u of users) {
      const row = [
        '"' + (u.username || '') + '"',
        '"' + (u.email || '') + '"',
        '"' + (u.role || '') + '"',
        '"' + (u.createdAt ? u.createdAt.toISOString() : '') + '"'
      ];
      lines.push(row.join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-disposition', 'attachment; filename=users.csv');
    res.set('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) {
    console.error('Export users error:', err);
    res.status(500).render('error', { message: 'Export Error', error: 'Failed to export users', status: 500 });
  }
});

// --- User management endpoints used by admin UI ---
// List users (paginated)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const perPage = 20;
    const total = await User.countDocuments();
    const totalPages = Math.ceil(total / perPage);
    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();
    // Add small flags for UI
    users.forEach(u => { u.isActive = true; u.suspended = !!u.suspended; });
    res.render('admin/users', { users, totalPages, currentPage: page, hasPrev: page > 1, hasNext: page < totalPages });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).render('error', { message: 'Users Error', error: 'Failed to load users', status: 500 });
  }
});

// Delete user
router.post('/users/:id/delete', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await User.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.json({ success: false, message: 'Delete failed' });
  }
});

// Suspend/Unsuspend user
router.post('/users/:id/suspend', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const suspended = req.body.suspended === 'true' || req.body.suspended === '1' || req.body.suspended === true;
    await User.findByIdAndUpdate(id, { suspended });
    res.json({ success: true });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.json({ success: false, message: 'Suspend failed' });
  }
});

module.exports = router;

