const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { game_id } = req.query;
  try {
    let sql = `
      SELECT s.*, t.name AS team_name, g.name AS game_name,
        (s.goals_for - s.goals_against) AS goal_difference
      FROM standings s
      JOIN teams t ON t.id = s.team_id
      JOIN games g ON g.id = s.game_id
      WHERE t.verification_status = 'verified'`;
    const params = [];
    if (game_id) {
      sql += ' AND s.game_id = ?';
      params.push(game_id);
    }
    sql += ' ORDER BY s.game_id, s.points DESC, goal_difference DESC, s.goals_for DESC';
    const [rows] = await db.query(sql, params);
    res.json({ leaderboard: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
