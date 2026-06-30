const express = require('express');
const db = require('../config/db');
const { requireAuth, requireMajorAdmin, getCommitteeGameId } = require('../middleware/auth');
const { listOpenConflictsForGame } = require('../services/conflicts');

const router = express.Router();

async function resolveCommitteeGameId(user) {
  if (user.role === 'Major_Admin') return null;
  if (user.role !== 'Committee_Member') return undefined;
  return getCommitteeGameId(user.id);
}

/** Committee member dashboard — scoped to assigned game only */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const gameId = await resolveCommitteeGameId(req.user);
    if (gameId === undefined) {
      return res.status(403).json({ error: 'Committee member access required.' });
    }
    if (gameId === null) {
      return res.status(400).json({ error: 'Major Admin has no committee game binding. Use /admin instead.' });
    }

    const [[game]] = await db.query(
      `SELECT g.*, g.rules_regulations AS rules FROM games g WHERE g.id = ?`,
      [gameId]
    );
    if (!game) return res.status(404).json({ error: 'Assigned game not found.' });

    const [teams] = await db.query(
      `SELECT t.*, u.full_name AS captain_name,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND status = 'accepted') AS member_count
       FROM teams t
       JOIN users u ON u.id = t.captain_user_id
       WHERE t.game_id = ?
       ORDER BY FIELD(t.verification_status, 'pending_verification', 'open', 'verified', 'rejected'), t.name`,
      [gameId]
    );

    const [matches] = await db.query(
      `SELECT m.*, ta.name AS team_a_name, tb.name AS team_b_name,
              v.name AS venue_name, v.location AS venue_location
       FROM matches m
       LEFT JOIN teams ta ON ta.id = m.team_a_id
       LEFT JOIN teams tb ON tb.id = m.team_b_id
       LEFT JOIN venues v ON v.id = m.venue_id
       WHERE m.game_id = ?
       ORDER BY m.scheduled_at ASC, m.round_number ASC, m.id ASC`,
      [gameId]
    );

    const [verifiedTeams] = await db.query(
      `SELECT id, name FROM teams WHERE game_id = ? AND verification_status = 'verified' ORDER BY name`,
      [gameId]
    );

    const [teamMembers] = await db.query(
      `SELECT tm.id, tm.team_id, tm.status, tm.role, tm.request_message, tm.reviewed_at, tm.reviewed_by,
              u.id AS user_id, u.full_name AS player_name, u.email, u.student_class, u.phone,
              t.name AS team_name, t.verification_status, g.name AS game_name,
              COALESCE(NULLIF(tm.role, ''), CASE WHEN t.captain_user_id = u.id THEN 'Captain' ELSE 'Player' END) AS role
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       JOIN teams t ON t.id = tm.team_id
       JOIN games g ON g.id = t.game_id
       WHERE t.game_id = ?
       ORDER BY t.name, FIELD(tm.status, 'accepted', 'pending', 'rejected'), u.full_name`,
      [gameId]
    );

    const [venues] = await db.query('SELECT id, name, location FROM venues ORDER BY name');

    const conflicts = await listOpenConflictsForGame(gameId);

    const stats = {
      teams_total: teams.length,
      teams_pending_verification: teams.filter((t) => ['pending_verification', 'open'].includes(t.verification_status)).length,
      teams_verified: teams.filter((t) => t.verification_status === 'verified').length,
      team_members_total: teamMembers.length,
      team_members_accepted: teamMembers.filter((member) => member.status === 'accepted').length,
      join_requests_pending: teamMembers.filter((member) => member.status === 'pending' && member.role !== 'Captain').length,
      matches_total: matches.length,
      matches_ongoing: matches.filter((m) => m.status === 'ongoing').length,
      open_conflicts: conflicts.length
    };

    res.json({
      game,
      game_id: gameId,
      teams,
      team_members: teamMembers,
      matches,
      verified_teams: verifiedTeams,
      venues,
      conflicts,
      stats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'Committee_Member') {
      return res.json({ role: req.user.role, game_id: null, game: null });
    }
    const gameId = await getCommitteeGameId(req.user.id);
    if (!gameId) return res.json({ role: req.user.role, game_id: null, game: null });
    const [[game]] = await db.query('SELECT id, name, sport_type, format, status FROM games WHERE id = ?', [gameId]);
    res.json({ role: req.user.role, game_id: gameId, game });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/available-students', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'Major_Admin' && req.user.role !== 'Committee_Member') {
      return res.status(403).json({ error: 'Admin or committee access required.' });
    }

    let gameId = null;
    if (req.user.role === 'Committee_Member') {
      gameId = await getCommitteeGameId(req.user.id);
      if (!gameId) {
        return res.status(400).json({ error: 'Assigned game not found.' });
      }
    }

    let rows;
    if (req.user.role === 'Committee_Member') {
      [rows] = await db.query(
        `SELECT u.id, u.username, u.full_name, u.email, u.student_class, u.phone, u.role
         FROM users u
         WHERE u.role = 'Student'
           AND NOT EXISTS (
             SELECT 1 FROM committee_memberships cm2
             WHERE cm2.user_id = u.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM team_members tm2
             JOIN teams t2 ON tm2.team_id = t2.id
             WHERE tm2.user_id = u.id AND tm2.status = 'accepted'
           )
           AND NOT EXISTS (
             SELECT 1 FROM teams t3
             WHERE t3.captain_user_id = u.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM volunteers v2
             WHERE v2.user_id = u.id
           )
         ORDER BY u.full_name`
      );
    } else {
      [rows] = await db.query(
        `SELECT u.id, u.username, u.full_name, u.email, u.student_class, u.phone, u.role
         FROM users u
         WHERE u.role = 'Student'
           AND NOT EXISTS (
             SELECT 1 FROM committee_memberships cm2
             WHERE cm2.user_id = u.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM team_members tm2
             JOIN teams t2 ON tm2.team_id = t2.id
             WHERE tm2.user_id = u.id AND tm2.status = 'accepted'
           )
           AND NOT EXISTS (
             SELECT 1 FROM teams t3
             WHERE t3.captain_user_id = u.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM volunteers v2
             WHERE v2.user_id = u.id
           )
         ORDER BY u.full_name`
      );
    }

    res.json({ students: rows, game_id: gameId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/available-games', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT g.id, g.name, g.sport_type, g.status
       FROM games g
       WHERE NOT EXISTS (
         SELECT 1 FROM committee_memberships cm
         WHERE cm.game_id = g.id
       )
       ORDER BY g.name`
    );
    res.json({ games: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Major_Admin binds exactly one game committee to a user (promotes Student -> Committee_Member). */
router.post('/assign', requireMajorAdmin, async (req, res) => {
  const { user_id, game_id } = req.body;
  if (!user_id || !game_id) {
    return res.status(400).json({ error: 'user_id and game_id are required.' });
  }
  try {
    const [u] = await db.query('SELECT id, role FROM users WHERE id = ?', [user_id]);
    if (!u.length) return res.status(404).json({ error: 'User not found.' });
    const user = u[0];
    if (user.role !== 'Student') {
      return res.status(400).json({ error: 'Only students without a current committee assignment may be assigned.' });
    }

    const [g] = await db.query('SELECT id FROM games WHERE id = ?', [game_id]);
    if (!g.length) return res.status(404).json({ error: 'Game not found.' });

    const [existing] = await db.query('SELECT id FROM committee_memberships WHERE game_id = ? LIMIT 1', [game_id]);
    if (existing.length) {
      return res.status(400).json({ error: 'This game already has a committee assignment.' });
    }

    await db.query(
      `INSERT INTO committee_memberships (user_id, game_id, assigned_by_user_id)
       VALUES (?, ?, ?)`,
      [user_id, game_id, req.user.id]
    );

    await db.query(
      `UPDATE users SET role = 'Committee_Member' WHERE id = ?`,
      [user_id]
    );

    res.json({ message: 'Committee assignment saved.', user_id, game_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/assign/:userId', requireMajorAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM committee_memberships WHERE user_id = ?', [req.params.userId]);
    await db.query(
      `UPDATE users SET role = 'Student' WHERE id = ? AND role = 'Committee_Member'`,
      [req.params.userId]
    );
    res.json({ message: 'Committee membership removed; user reverted to Student.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
