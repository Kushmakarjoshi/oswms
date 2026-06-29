const express = require('express');
const db = require('../config/db');
const { requireAuth, requireMajorAdmin, getCommitteeGameId } = require('../middleware/auth');
const { notifyUser } = require('../services/notifications');
const { getActiveMembershipForGame } = require('../services/teamMemberships');
const { resolveEntityId } = require('../utils/resolveEntityId');

const router = express.Router();

router.get('/', async (req, res) => {
  const { game_id, verified_only } = req.query;
  try {
    let resolvedGameId = null;
    if (game_id) {
      resolvedGameId = await resolveEntityId('games', game_id, ['name', 'sport_type']);
      if (!resolvedGameId) return res.status(404).json({ error: 'Game not found.' });
    }

    let sql = `
      SELECT t.*, g.name AS game_name, u.full_name AS captain_name,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND status = 'accepted') AS member_count
      FROM teams t
      JOIN games g ON g.id = t.game_id
      JOIN users u ON u.id = t.captain_user_id
      WHERE 1=1`;
    const params = [];
    if (resolvedGameId) { sql += ' AND t.game_id = ?'; params.push(resolvedGameId); }
    if (verified_only === '1' || verified_only === 'true') {
      sql += " AND t.verification_status = 'verified'";
    }
    sql += ' ORDER BY t.name';
    const [rows] = await db.query(sql, params);
    res.json({ teams: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, department, game_id } = req.body;
  if (!name || !game_id) {
    return res.status(400).json({ error: 'Team name and game are required.' });
  }
  try {
    const resolvedGameId = await resolveEntityId('games', game_id, ['name', 'sport_type']);
    if (!resolvedGameId) return res.status(404).json({ error: 'Game not found.' });

    const [game] = await db.query('SELECT max_teams FROM games WHERE id = ?', [resolvedGameId]);
    if (!game.length) return res.status(404).json({ error: 'Game not found.' });

    const [count] = await db.query('SELECT COUNT(*) AS c FROM teams WHERE game_id = ?', [resolvedGameId]);
    if (count[0].c >= game[0].max_teams) {
      return res.status(400).json({ error: 'Maximum teams reached for this game.' });
    }

    const [existingCaptain] = await db.query(
      `SELECT t.id FROM teams t WHERE t.captain_user_id = ? AND t.game_id = ?`,
      [req.user.id, resolvedGameId]
    );
    if (existingCaptain.length) {
      return res.status(400).json({ error: 'You already captain a team in this game.' });
    }

    const activeMembership = await getActiveMembershipForGame(req.user.id, resolvedGameId);
    if (activeMembership) {
      const label = activeMembership.status === 'accepted' ? 'already on' : 'already requested to join';
      return res.status(400).json({ error: `You are ${label} team "${activeMembership.team_name}" for this game.` });
    }

    const [result] = await db.query(
      `INSERT INTO teams (name, department, game_id, captain_user_id, verification_status)
       VALUES (?, ?, ?, ?, 'open')`,
      [name, department || null, game_id, req.user.id]
    );
    const teamId = result.insertId;

    await db.query(
      `INSERT INTO team_members (team_id, user_id, status, reviewed_at, reviewed_by) VALUES (?, ?, 'accepted', NULL, NULL)`,
      [teamId, req.user.id]
    );
    await db.query(
      'INSERT INTO standings (game_id, team_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE team_id = team_id',
      [game_id, teamId]
    );

    await notifyUser(req.user.id, 'Team created', `You are captain of "${name}". Invite members to request joining.`, 'general', teamId);

    res.status(201).json({ id: teamId, message: 'Team created. You are the captain.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/submit-for-verification', requireAuth, async (req, res) => {
  const teamId = req.params.id;
  try {
    const [team] = await db.query('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!team.length) return res.status(404).json({ error: 'Team not found.' });
    if (team[0].captain_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the team captain can finalize the roster.' });
    }
    const [accepted] = await db.query(
      `SELECT COUNT(*) AS c FROM team_members WHERE team_id = ? AND status = 'accepted'`,
      [teamId]
    );
    if (accepted[0].c < 2) {
      return res.status(400).json({ error: 'At least two accepted members are required before submitting for verification.' });
    }
    await db.query(
      `UPDATE teams SET verification_status = 'pending_verification' WHERE id = ?`,
      [teamId]
    );
    res.json({ message: 'Team submitted for committee verification.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/verify', requireAuth, async (req, res) => {
  const teamId = req.params.id;
  const { decision } = req.body;
  if (!['verified', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be "verified" or "rejected".' });
  }
  try {
    const [team] = await db.query('SELECT game_id FROM teams WHERE id = ?', [teamId]);
    if (!team.length) return res.status(404).json({ error: 'Team not found.' });
    if (req.user.role === 'Major_Admin') {
      /* ok */
    } else if (req.user.role === 'Committee_Member') {
      const gid = await getCommitteeGameId(req.user.id);
      if (!gid || gid !== team[0].game_id) {
        return res.status(403).json({ error: 'Not your game committee.' });
      }
    } else {
      return res.status(403).json({ error: 'Committee or Major Admin only.' });
    }

    await db.query(
      `UPDATE teams SET verification_status = ? WHERE id = ?`,
      [decision, teamId]
    );
    res.json({ message: `Team marked ${decision}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/join', requireAuth, async (req, res) => {
  const { message } = req.body;
  const teamId = req.params.id;
  try {
    const [team] = await db.query('SELECT t.*, g.name AS game_name FROM teams t JOIN games g ON g.id = t.game_id WHERE t.id = ?', [teamId]);
    if (!team.length) return res.status(404).json({ error: 'Team not found.' });
    if (team[0].captain_user_id === req.user.id) {
      return res.status(400).json({ error: 'You are already the captain of this team.' });
    }

    const [dup] = await db.query('SELECT id, status FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, req.user.id]);
    if (dup.length) {
      const st = dup[0].status;
      if (st === 'accepted') return res.status(400).json({ error: 'You are already on this team.' });
      if (st === 'pending') return res.status(400).json({ error: 'Your join request is already pending captain review.' });
    }

    const activeMembership = await getActiveMembershipForGame(req.user.id, team[0].game_id);
    if (activeMembership) {
      const label = activeMembership.status === 'accepted' ? 'already on' : 'already requested to join';
      return res.status(400).json({ error: `You are ${label} team "${activeMembership.team_name}" for this game.` });
    }

    const [result] = await db.query(
      `INSERT INTO team_members (team_id, user_id, status, request_message)
       VALUES (?, ?, 'pending', ?)
       ON DUPLICATE KEY UPDATE status = 'pending', request_message = VALUES(request_message), reviewed_at = NULL, reviewed_by = NULL`,
      [teamId, req.user.id, message || null]
    );

    await notifyUser(
      team[0].captain_user_id,
      'New join request',
      `${req.user.full_name || req.user.username} requested to join "${team[0].name}".`,
      'team_request',
      teamId
    );

    await notifyUser(
      req.user.id,
      'Join request submitted',
      `Your request to join "${team[0].name}" is pending captain approval.`,
      'team_request',
      teamId
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Join request sent. The team captain will accept or reject.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/members', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT tm.*, u.full_name, u.email, u.student_class
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ? ORDER BY FIELD(tm.status, 'accepted', 'pending', 'rejected'), tm.created_at`,
      [req.params.id]
    );
    res.json({ members: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireMajorAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM teams WHERE id = ?', [req.params.id]);
    res.json({ message: 'Team removed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
