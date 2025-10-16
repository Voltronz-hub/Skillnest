const express = require('express');
const router = express.Router();
const SavedSearch = require('../models/SavedSearch');
const Notification = require('../models/Notification');

// list user's saved searches
router.get('/', async (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const list = await SavedSearch.find({ user: req.session.userId }).sort({ createdAt: -1 }).lean();
  res.json(list);
});

// create
router.post('/', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, query } = req.body;
    if (!name || !query) return res.status(400).json({ error: 'Missing fields' });
    const obj = { user: req.session.userId, name: name.trim(), query: JSON.parse(query) };
    const s = new SavedSearch(obj);
    await s.save();
    res.json(s);
  } catch (err) {
    console.error('save search', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// delete
router.delete('/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const s = await SavedSearch.findById(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    if ('' + s.user != '' + req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    await s.remove();
    res.json({ ok: true });
  } catch (err) {
    console.error('delete search', err);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
