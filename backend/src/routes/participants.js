const express = require('express');
const db = require('../config/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { resolveEntityId } = require('../utils/resolveEntityId');

const router = express.Router();

router.get('/', async (req, res) => {
  const { game_id, team_id } = req.query;
  try {
    let resolvedGameId = null;
    let resolvedTeamId = null;
    if (game_id) {
      resolvedGameId = await resolveEntityId('games', game_id, ['name', 'sport_type']);
      if (!resolvedGameId) {
        return res.status(404).json({ error: 'Game not found.' });
      }
    }
    if (team_id) {
      resolvedTeamId = await resolveEntityId('teams', team_id, ['name', 'department']);
      if (!resolvedTeamId) {
        return res.status(404).json({ error: 'Team not found.' });
      }
    }

    let sql = `SELECT p.*, g.name AS game_name, t.name AS team_name
               FROM participants p
               JOIN games g ON g.id = p.game_id
               LEFT JOIN teams t ON t.id = p.team_id WHERE 1=1`;
    const params = [];
    if (resolvedGameId) { sql += ' AND p.game_id = ?'; params.push(resolvedGameId); }
    if (resolvedTeamId) { sql += ' AND p.team_id = ?'; params.push(resolvedTeamId); }
    sql += ' ORDER BY p.full_name';
    const [rows] = await db.query(sql, params);
    res.json({ participants: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', optionalAuth, async (req, res) => {
  if (req.user?.role === 'Committee_Member') {
    return res.status(403).json({ error: 'Committee members may not participate in games as individual participants.' });
  }

  const { full_name, student_class, email, phone, game_id, team_id, verification_status } = req.body;
  if (!full_name || !game_id) {
    return res.status(400).json({ error: 'Full name and game are required.' });
  }
  try {
    const resolvedGameId = await resolveEntityId('games', game_id, ['name', 'sport_type']);
    if (!resolvedGameId) return res.status(404).json({ error: 'Game not found.' });

    let resolvedTeamId = null;
    if (team_id) {
      resolvedTeamId = await resolveEntityId('teams', team_id, ['name', 'department']);
      if (!resolvedTeamId) return res.status(404).json({ error: 'Team not found.' });
    }

    const [result] = await db.query(
      'INSERT INTO participants (full_name, student_class, email, phone, game_id, team_id, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [full_name, student_class || null, email || null, phone || null, resolvedGameId, resolvedTeamId, verification_status || 'pending']
    );
    res.status(201).json({ id: result.insertId, message: 'Participant registered.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const { verification_status } = req.body;
  if (!['pending','approved','rejected'].includes(verification_status)) {
    return res.status(400).json({ error: 'verification_status must be pending, approved, or rejected.' });
  }
  try {
    const [row] = await db.query('SELECT id FROM participants WHERE id = ?', [req.params.id]);
    if (!row.length) return res.status(404).json({ error: 'Participant not found.' });

    await db.query('UPDATE participants SET verification_status = ? WHERE id = ?', [verification_status, req.params.id]);
    res.json({ message: 'Participant updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
