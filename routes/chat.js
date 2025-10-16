const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Message = require('../models/Message');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
function fileFilter(req, file, cb) {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'application/pdf'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only images and PDF files are allowed.'));
}
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// Chat page for a job
router.get('/:jobId', (req, res) => {
  res.render('chat', { jobId: req.params.jobId, userId: req.session.userId });
});

// API: list recent conversations (people who contacted or were contacted by the current user)
router.get('/conversations', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const uid = req.session.userId;
    // load recent messages involving the user, sorted descending
    const msgs = await Message.find({ $or: [{ sender: uid }, { receiver: uid }] })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('sender', 'username')
      .populate('receiver', 'username')
      .lean();

    const seen = new Set();
    const convos = [];
    for (const m of msgs) {
      const otherUserId = ('' + (m.sender && m.sender._id) === '' + uid) ? (m.receiver && m.receiver._id) : (m.sender && m.sender._id);
      const otherUser = ('' + (m.sender && m.sender._id) === '' + uid) ? m.receiver : m.sender;
      if (!otherUserId) continue;
      if (seen.has('' + otherUserId)) continue;
      seen.add('' + otherUserId);
      // count unread messages in this conversation for the current user
      const unreadCount = await Message.countDocuments({ jobId: m.jobId, receiver: uid, read: false });
      convos.push({ userId: otherUserId, username: otherUser ? otherUser.username : 'User', lastMessage: m.message || '', jobId: m.jobId, createdAt: m.createdAt, unread: unreadCount });
      if (convos.length >= 50) break;
    }
    res.json(convos);
  } catch (err) {
    console.error('conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Upload attachment for chat and broadcast message with attachment metadata
router.post('/:jobId/upload', upload.single('attachment'), async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(401).send('Unauthorized');
    const jobId = req.params.jobId;
    if (!req.file) return res.status(400).send('No file uploaded');

    const attachment = { filename: req.file.filename, path: `/uploads/${req.file.filename}`, size: req.file.size, mimetype: req.file.mimetype };
    const msg = new Message({ jobId, sender: req.session.userId, receiver: req.session.userId, message: req.body.message || '', attachments: [attachment], createdAt: new Date() });
    await msg.save();

    // Broadcast via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      const user = req.session.userId;
      io.to(jobId).emit('chatMessage', { message: msg.message, sender: user, attachments: [attachment], createdAt: msg.createdAt });
    }

    res.redirect(`/chat/${jobId}`);
  } catch (err) {
    console.error('chat upload error:', err);
    res.status(500).send('Upload failed');
  }
});

module.exports = router;
