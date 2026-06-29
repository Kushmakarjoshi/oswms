const express = require('express');
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notifyBroadcast } = require('../services/notifications');

const router = express.Router();

router.get('/public', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, message, type, created_at FROM user_notifications
       WHERE user_id IS NULL AND type = 'broadcast'
       ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ notifications: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    await db.query(
      'UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE user_notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/broadcast', requireAdmin, async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Title and message required.' });
  try {
    await notifyBroadcast(title, message);
    res.status(201).json({ message: 'Broadcast published.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
