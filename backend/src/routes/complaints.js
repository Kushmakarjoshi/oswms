const express = require('express');
const db = require('../config/db');
const { optionalAuth, requireMajorAdmin } = require('../middleware/auth');

const router = express.Router();

function nextComplaintCode() {
  return `CMP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Only Major_Admin may list complaints (hidden from Committee_Member). */
router.get('/', requireMajorAdmin, async (req, res) => {
  const { status } = req.query;
  try {
    let sql = 'SELECT * FROM complaints';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json({ complaints: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', optionalAuth, async (req, res) => {
  const { submitted_by, email, category, subject, description, is_anonymous } = req.body;
  if (!subject || !description) {
    return res.status(400).json({ error: 'Subject and description are required.' });
  }
  const anon = Boolean(is_anonymous);
  const displayName = anon
    ? 'Anonymous'
    : (submitted_by || req.user?.full_name || req.user?.username);
  if (!displayName) {
    return res.status(400).json({ error: 'Provide a name for a signed complaint, or submit as anonymous.' });
  }
  const code = nextComplaintCode();
  try {
    const uid = anon ? null : (req.user?.id || null);
    const [result] = await db.query(
      `INSERT INTO complaints (complaint_code, user_id, is_anonymous, submitted_by, email, category, subject, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, uid, anon ? 1 : 0, displayName, email || null, category || 'other', subject, description]
    );
    res.status(201).json({ id: result.insertId, complaint_code: code, message: 'Complaint submitted to Major Admin.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireMajorAdmin, async (req, res) => {
  const { status, admin_response } = req.body;
  try {
    const resolvedAt = status === 'resolved' ? new Date() : null;
    await db.query(
      'UPDATE complaints SET status = ?, admin_response = ?, resolved_at = ? WHERE id = ?',
      [status, admin_response || null, resolvedAt, req.params.id]
    );
    res.json({ message: 'Complaint updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
