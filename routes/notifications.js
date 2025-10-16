// notifications routes
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

// Middleware to check if user is logged in
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// Get notifications for logged-in user (most recent first)
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to get notifications' });
  }
});

// unread count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const c = await Notification.countDocuments({ user: req.session.userId, read: false });
    res.json({ unread: c });
  } catch (err) {
    console.error('unread-count error', err);
    res.status(500).json({ unread: 0 });
  }
});

// Mark notification as read (single)
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.session.userId },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

// Mark multiple notifications as read (bulk)
router.post('/mark-read', requireAuth, async (req, res) => {
  try {
    const ids = req.body.ids || [];
    if (!Array.isArray(ids) || !ids.length) return res.json({ ok: true });
    await Notification.updateMany({ _id: { $in: ids }, user: req.session.userId }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error('mark read', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Mark all notifications as read
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.session.userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read' });
  }
});

module.exports = router;
