const express = require('express');
const db = require('../config/db');
const { requireAuth, requireMajorAdmin, getCommitteeGameId } = require('../middleware/auth');

const router = express.Router();

const COMMITTEE_GAME_FIELDS = ['description', 'rules_regulations', 'equipment_required', 'scoring_criteria', 'scoring_mode', 'scoring_parameters'];

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT g.*,
              (SELECT COUNT(*) FROM teams t WHERE t.game_id = g.id) AS team_count
       FROM games g
       ORDER BY g.created_at DESC`
    );
    const games = rows.map((row) => ({
      ...row,
      rules: row.rules_regulations,
      scoring_parameters: row.scoring_parameters ? JSON.parse(row.scoring_parameters) : null
    }));
    res.json({ games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM games WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Game not found.' });
    const g = rows[0];
    res.json({
      game: {
        ...g,
        rules: g.rules_regulations,
        scoring_parameters: g.scoring_parameters ? JSON.parse(g.scoring_parameters) : null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireMajorAdmin, async (req, res) => {
  const { name, sport_type, format, description, rules_regulations, scoring_criteria, scoring_mode, scoring_parameters, equipment_required, max_teams, max_players_per_team, status } = req.body;
  if (!name || !sport_type) {
    return res.status(400).json({ error: 'Name and sport type are required.' });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO games (name, sport_type, format, description, rules_regulations, scoring_criteria, scoring_mode, scoring_parameters, equipment_required, max_teams, max_players_per_team, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        sport_type,
        format || 'round_robin',
        description || null,
        rules_regulations || null,
        scoring_criteria || null,
        scoring_mode || 'points',
        scoring_parameters ? JSON.stringify(scoring_parameters) : null,
        equipment_required || null,
        max_teams || 8,
        max_players_per_team || 15,
        status || 'draft'
      ]
    );
    res.status(201).json({ id: result.insertId, message: 'Game created.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const gameId = Number(req.params.id);
  try {
    const isMajor = req.user.role === 'Major_Admin';
    let allowedKeys;
    if (isMajor) {
      allowedKeys = [
        'name', 'sport_type', 'format', 'description', 'rules_regulations', 'scoring_criteria',
        'scoring_mode', 'scoring_parameters', 'equipment_required', 'max_teams', 'max_players_per_team', 'status'
      ];
    } else if (req.user.role === 'Committee_Member') {
      const gid = await getCommitteeGameId(req.user.id);
      if (!gid || gid !== gameId) {
        return res.status(403).json({ error: 'You may only edit games assigned to your committee.' });
      }
      allowedKeys = COMMITTEE_GAME_FIELDS;
    } else {
      return res.status(403).json({ error: 'Not authorized to edit games.' });
    }

    const updates = [];
    const values = [];
    allowedKeys.forEach((f) => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        if (f === 'scoring_parameters' && typeof req.body[f] === 'object') {
          values.push(JSON.stringify(req.body[f]));
        } else {
          values.push(req.body[f]);
        }
      }
    });
    if (!updates.length) return res.status(400).json({ error: 'No permitted fields to update.' });
    values.push(gameId);
    await db.query(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Game updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireMajorAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM games WHERE id = ?', [req.params.id]);
    res.json({ message: 'Game deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
