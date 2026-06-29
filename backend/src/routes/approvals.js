const express = require('express');
const db = require('../config/db');
const { requireAuth, requireMajorAdmin } = require('../middleware/auth');
const { resolveEntityId } = require('../utils/resolveEntityId');

const router = express.Router();

router.get('/', requireMajorAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ea.*, g.name AS game_name, g.sport_type, g.status AS game_status,
              u.full_name AS requested_by, r.full_name AS reviewed_by
       FROM event_approvals ea
       JOIN games g ON g.id = ea.game_id
       LEFT JOIN users u ON u.id = ea.created_by
       LEFT JOIN users r ON r.id = ea.reviewed_by
       ORDER BY ea.requested_at DESC`
    );
    res.json({ approvals: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/request', requireAuth, async (req, res) => {
  const { game_id, request_notes } = req.body;
  if (!game_id) return res.status(400).json({ error: 'game_id is required.' });
  try {
    const resolvedGameId = await resolveEntityId('games', game_id, ['name', 'sport_type']);
    if (!resolvedGameId) return res.status(404).json({ error: 'Game not found.' });

    const [gameRows] = await db.query('SELECT id, approval_status FROM games WHERE id = ?', [resolvedGameId]);
    if (!gameRows.length) return res.status(404).json({ error: 'Game not found.' });

    await db.query(
      `INSERT INTO event_approvals (game_id, created_by, status, request_notes)
       VALUES (?, ?, 'pending_review', ?)`,
      [resolvedGameId, req.user.id, request_notes || null]
    );
    await db.query('UPDATE games SET approval_status = ? WHERE id = ?', ['pending_review', resolvedGameId]);
    res.status(201).json({ message: 'Approval request submitted to SWECAD.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/review', requireMajorAdmin, async (req, res) => {
  const { status, review_notes } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected.' });
  }
  try {
    const [rows] = await db.query('SELECT game_id FROM event_approvals WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Approval request not found.' });
    const gameId = rows[0].game_id;

    await db.query(
      `UPDATE event_approvals
       SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [status, review_notes || null, req.user.id, req.params.id]
    );

    await db.query('UPDATE games SET approval_status = ? WHERE id = ?', [status, gameId]);
    res.json({ message: `Approval request ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
