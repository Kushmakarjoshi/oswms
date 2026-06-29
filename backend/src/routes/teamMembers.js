const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { notifyUser } = require('../services/notifications');

const router = express.Router();

async function assertCaptainForMembership(captainUserId, membershipId) {
  const [rows] = await db.query(
    `SELECT tm.*, t.captain_user_id, t.name AS team_name, t.game_id,
      g.max_players_per_team,
      (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND status = 'accepted') AS accepted_count
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     JOIN games g ON g.id = t.game_id
     WHERE tm.id = ?`,
    [membershipId]
  );
  if (!rows.length) return { error: 'Request not found.' };
  if (rows[0].captain_user_id !== captainUserId) {
    return { error: 'Only the team captain can review join requests.', row: rows[0] };
  }
  return { row: rows[0] };
}

/** Pending join requests for teams where the caller is captain */
router.get('/captain/pending', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT tm.*, u.full_name, u.email, u.student_class, t.name AS team_name, g.name AS game_name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       JOIN teams t ON t.id = tm.team_id
       JOIN games g ON g.id = t.game_id
       WHERE tm.status = 'pending' AND t.captain_user_id = ?
       ORDER BY tm.created_at ASC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/captain/members', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT tm.*, u.full_name, u.email, u.student_class, t.name AS team_name, g.name AS game_name,
        reviewer.full_name AS reviewed_by_name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       JOIN teams t ON t.id = tm.team_id
       JOIN games g ON g.id = t.game_id
       LEFT JOIN users reviewer ON reviewer.id = tm.reviewed_by
       WHERE t.captain_user_id = ?
       ORDER BY t.name, FIELD(tm.status, 'accepted', 'pending', 'rejected'), tm.created_at ASC`,
      [req.user.id]
    );
    res.json({ members: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const { request_message } = req.body;
  try {
    const check = await assertCaptainForMembership(req.user.id, req.params.id);
    if (check.error) {
      const status = check.row ? 403 : 404;
      return res.status(status).json({ error: check.error });
    }

    await db.query('UPDATE team_members SET request_message = ? WHERE id = ?', [request_message ?? null, req.params.id]);
    res.json({ message: 'Request updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/accept', requireAuth, async (req, res) => {
  let { role } = req.body;
  role = typeof role === 'string' && role.trim() ? role.trim() : 'player';
  if (role.length > 50) {
    return res.status(400).json({ error: 'Role must be 50 characters or fewer.' });
  }
  try {
    const check = await assertCaptainForMembership(req.user.id, req.params.id);
    if (check.error) {
      const status = check.row ? 403 : 404;
      return res.status(status).json({ error: check.error });
    }
    const reqRow = check.row;

    if (reqRow.accepted_count >= reqRow.max_players_per_team) {
      return res.status(400).json({ error: 'Team roster is full.' });
    }

    const [otherApproved] = await db.query(
      `SELECT tm.id, tm.status, t.name FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = ? AND tm.id != ? AND tm.status IN ('accepted', 'pending') AND t.game_id = ?`,
      [reqRow.user_id, req.params.id, reqRow.game_id]
    );
    if (otherApproved.length) {
      const label = otherApproved[0].status === 'accepted' ? 'already on' : 'already pending on';
      return res.status(400).json({
        error: `Player is ${label} team "${otherApproved[0].name}" for this game.`
      });
    }

    await db.query(
      `UPDATE team_members SET status = 'accepted', role = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`,
      [role || 'player', req.user.id, req.params.id]
    );
    await db.query(
      `UPDATE team_members SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ?
       WHERE user_id = ? AND team_id = ? AND id != ? AND status = 'pending'`,
      [req.user.id, reqRow.user_id, reqRow.team_id, req.params.id]
    );

    await notifyUser(
      reqRow.user_id,
      'Team request accepted',
      `You have been accepted into team "${reqRow.team_name}".`,
      'team_approved',
      reqRow.team_id
    );

    res.json({ message: 'Member accepted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/reject', requireAuth, async (req, res) => {
  const { reason } = req.body;
  try {
    const check = await assertCaptainForMembership(req.user.id, req.params.id);
    if (check.error) {
      const status = check.row ? 403 : 404;
      return res.status(status).json({ error: check.error });
    }
    const row = check.row;

    await db.query(
      `UPDATE team_members SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`,
      [req.user.id, req.params.id]
    );
    await notifyUser(
      row.user_id,
      'Team request declined',
      reason || `Your request to join "${row.team_name}" was rejected.`,
      'team_rejected',
      row.team_id
    );
    res.json({ message: 'Request rejected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const [memberships] = await db.query(
      `SELECT tm.*, t.name AS team_name, t.verification_status, g.name AS game_name, g.id AS game_id
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       JOIN games g ON g.id = t.game_id
       WHERE tm.user_id = ?
       ORDER BY tm.created_at DESC`,
      [req.user.id]
    );
    res.json({ memberships });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
