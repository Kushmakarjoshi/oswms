const express = require('express');
const db = require('../config/db');
const { requireAuth, requireMajorAdmin, getCommitteeGameId } = require('../middleware/auth');
const { generateFixtures, insertKnockoutBracket } = require('../services/scheduling');
const { detectMatchConflicts, persistConflicts, listOpenConflicts, listOpenConflictsForGame, DEFAULT_DURATION } = require('../services/conflicts');
const { applyMonotonicScoreUpdate } = require('../services/safeLiveScore');
const { swapOpponentsInFixture, updateFixtureSchedule } = require('../services/opponentSwapEngine');

const router = express.Router();

async function userMayManageGame(user, gameId) {
  if (!user) return false;
  if (user.role === 'Major_Admin') return true;
  if (user.role !== 'Committee_Member') return false;
  const gid = await getCommitteeGameId(user.id);
  return gid != null && Number(gid) === Number(gameId);
}

router.get('/', async (req, res) => {
  const { game_id, status, since } = req.query;
  try {
    let sql = `
      SELECT m.*, g.name AS game_name,
        ta.name AS team_a_name, tb.name AS team_b_name,
        v.name AS venue_name, v.location AS venue_location
      FROM matches m
      JOIN games g ON g.id = m.game_id
      LEFT JOIN teams ta ON ta.id = m.team_a_id
      LEFT JOIN teams tb ON tb.id = m.team_b_id
      LEFT JOIN venues v ON v.id = m.venue_id
      WHERE 1=1`;
    const params = [];
    if (game_id) { sql += ' AND m.game_id = ?'; params.push(game_id); }
    if (status) { sql += ' AND m.status = ?'; params.push(status); }
    if (since) { sql += ' AND (m.score_updated_at >= ? OR m.scheduled_at >= ?)'; params.push(since, since); }
    sql += ' ORDER BY m.scheduled_at ASC';
    const [rows] = await db.query(sql, params);
    res.json({ matches: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT m.*, g.name AS game_name,
              ta.name AS team_a_name, tb.name AS team_b_name,
              v.name AS venue_name, v.location AS venue_location
       FROM matches m
       JOIN games g ON g.id = m.game_id
       LEFT JOIN teams ta ON ta.id = m.team_a_id
       LEFT JOIN teams tb ON tb.id = m.team_b_id
       LEFT JOIN venues v ON v.id = m.venue_id
       WHERE m.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Match not found.' });
    res.json({ match: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/live', async (req, res) => {
  const since = req.query.since || new Date(Date.now() - 60000).toISOString();
  try {
    const [rows] = await db.query(
      `SELECT m.id, m.game_id, m.score_a, m.score_b, m.status, m.score_updated_at,
              ta.name AS team_a_name, tb.name AS team_b_name, g.name AS game_name
       FROM matches m
       JOIN games g ON g.id = m.game_id
       LEFT JOIN teams ta ON ta.id = m.team_a_id
       LEFT JOIN teams tb ON tb.id = m.team_b_id
       WHERE m.score_updated_at >= ? OR m.status = 'ongoing'
       ORDER BY m.score_updated_at DESC`,
      [since]
    );
    res.json({ updates: rows, server_time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conflicts', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'Major_Admin') {
      const conflicts = await listOpenConflicts();
      return res.json({ conflicts });
    }
    if (req.user.role === 'Committee_Member') {
      const gameId = await getCommitteeGameId(req.user.id);
      if (!gameId) return res.json({ conflicts: [] });
      const conflicts = await listOpenConflictsForGame(gameId);
      return res.json({ conflicts });
    }
    return res.status(403).json({ error: 'Not authorized to list schedule conflicts.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/check-conflicts', requireAuth, async (req, res) => {
  const { match_id, team_a_id, team_b_id, scheduled_at, duration_minutes, game_id } = req.body;
  try {
    if (req.user.role === 'Major_Admin') {
      /* ok */
    } else if (req.user.role === 'Committee_Member') {
      const gid = await getCommitteeGameId(req.user.id);
      if (!gid || (game_id && Number(game_id) !== gid)) {
        return res.status(403).json({ error: 'Not your committee game.' });
      }
    } else {
      return res.status(403).json({ error: 'Committee or Major Admin only.' });
    }
    const conflicts = await detectMatchConflicts(
      match_id || 0, team_a_id, team_b_id, scheduled_at, duration_minutes || DEFAULT_DURATION
    );
    res.json({ conflicts, has_conflicts: conflicts.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/conflicts/:id/resolve', requireMajorAdmin, async (req, res) => {
  const { resolution_note, new_scheduled_at } = req.body;
  try {
    const [c] = await db.query('SELECT * FROM schedule_conflicts WHERE id = ?', [req.params.id]);
    if (!c.length) return res.status(404).json({ error: 'Conflict not found.' });

    if (new_scheduled_at) {
      await db.query('UPDATE matches SET scheduled_at = ? WHERE id = ?', [new_scheduled_at, c[0].match_id]);
    }
    await db.query(
      `UPDATE schedule_conflicts SET status = 'resolved', resolution_note = ? WHERE id = ?`,
      [resolution_note || 'Resolved by Major Admin', req.params.id]
    );
    res.json({ message: 'Conflict resolved.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-fixtures', requireAuth, async (req, res) => {
  const { game_id, venue_id, start_date, match_hours_gap, skip_conflicts } = req.body;
  if (!game_id) return res.status(400).json({ error: 'game_id is required.' });

  try {
    if (!(await userMayManageGame(req.user, game_id))) {
      return res.status(403).json({ error: 'Not authorized to generate fixtures for this game.' });
    }

    const [game] = await db.query('SELECT format FROM games WHERE id = ?', [game_id]);
    if (!game.length) return res.status(404).json({ error: 'Game not found.' });

    const [teams] = await db.query(
      'SELECT id FROM teams WHERE game_id = ? AND verification_status = ?',
      [game_id, 'verified']
    );
    if (teams.length < 2) {
      return res.status(400).json({ error: 'At least 2 verified teams are required to generate fixtures.' });
    }

    if (game[0].format === 'knockout') {
      const teamIds = teams.map((t) => t.id);
      const created = await insertKnockoutBracket({
        gameId: game_id,
        teamIds,
        venue_id,
        start_date,
        match_hours_gap,
        duration_minutes: DEFAULT_DURATION
      });
      return res.json({
        message: `${created.created} knockout fixtures created (including third-place playoff when applicable).`,
        count: created.created,
        match_ids: created.match_ids,
        skipped_conflicts: []
      });
    }

    const pairings = generateFixtures(teams.map((t) => t.id), game[0].format);
    const baseDate = start_date ? new Date(start_date) : new Date();
    const gapHours = match_hours_gap || 24;
    let created = 0;
    const allConflicts = [];

    for (let i = 0; i < pairings.length; i++) {
      const scheduled = new Date(baseDate);
      scheduled.setHours(scheduled.getHours() + i * gapHours);

      const conflicts = await detectMatchConflicts(0, pairings[i].teamA, pairings[i].teamB, scheduled);
      if (conflicts.length && !skip_conflicts) {
        allConflicts.push(...conflicts.map((c) => ({ ...c, round: pairings[i].round })));
        continue;
      }

      const bp = pairings[i].bracket_phase || 'league';
      const [result] = await db.query(
        `INSERT INTO matches (game_id, team_a_id, team_b_id, venue_id, scheduled_at, round_number, duration_minutes, bracket_phase)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [game_id, pairings[i].teamA, pairings[i].teamB, venue_id || null, scheduled, pairings[i].round, DEFAULT_DURATION, bp]
      );
      if (conflicts.length) await persistConflicts(result.insertId, conflicts);
      created++;
    }

    res.json({
      message: `${created} fixtures created.${allConflicts.length ? ` ${allConflicts.length} skipped due to conflicts.` : ''}`,
      count: created,
      skipped_conflicts: allConflicts
    });
  } catch (err) {
    if (err.message && err.message.includes('power-of-2')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { game_id, team_a_id, team_b_id, venue_id, scheduled_at, round_number, duration_minutes, force, bracket_phase } = req.body;
  if (!game_id || !team_a_id || !team_b_id) {
    return res.status(400).json({ error: 'game_id and both teams are required.' });
  }
  try {
    if (!(await userMayManageGame(req.user, game_id))) {
      return res.status(403).json({ error: 'Not authorized.' });
    }
    const conflicts = await detectMatchConflicts(
      0, team_a_id, team_b_id, scheduled_at, duration_minutes || DEFAULT_DURATION
    );
    if (conflicts.length && !force) {
      return res.status(409).json({ error: 'Schedule conflicts detected.', conflicts });
    }

    const [result] = await db.query(
      `INSERT INTO matches (game_id, team_a_id, team_b_id, venue_id, scheduled_at, round_number, duration_minutes, bracket_phase)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [game_id, team_a_id, team_b_id, venue_id || null, scheduled_at || null, round_number || 1, duration_minutes || DEFAULT_DURATION, bracket_phase || null]
    );
    if (conflicts.length) await persistConflicts(result.insertId, conflicts);

    res.status(201).json({ id: result.insertId, message: 'Match scheduled.', conflicts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Safe monotonic live score — Committee for this game or Major_Admin */
router.patch('/:id/score', requireAuth, async (req, res) => {
  try {
    const result = await applyMonotonicScoreUpdate(req.params.id, req.user, req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }
    res.json({
      message: 'Score updated.',
      winner_team_id: result.match.winner_team_id,
      score: { score_a: result.match.score_a, score_b: result.match.score_b },
      status: result.match.status,
      bracket_advance: result.bracket_advance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Committee fixture editor: swap opponents (flip or replace one side) */
router.post('/:id/swap-opponents', requireAuth, async (req, res) => {
  try {
    const result = await swapOpponentsInFixture(req.params.id, req.user, req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/schedule', requireAuth, async (req, res) => {
  try {
    const result = await updateFixtureSchedule(req.params.id, req.user, req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, conflicts: result.conflicts });
    }
    res.json({ message: 'Schedule updated.', conflicts: result.conflicts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
