const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const [memberships] = await db.query(
      `SELECT tm.*, t.name AS team_name, t.verification_status, g.name AS game_name, g.id AS game_id
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       JOIN games g ON g.id = t.game_id
       WHERE tm.user_id = ?
       ORDER BY FIELD(tm.status, 'accepted', 'pending', 'rejected'), tm.created_at DESC`,
      [userId]
    );

    const teamIds = memberships.filter((m) => m.status === 'accepted').map((m) => m.team_id);
    let matches = [];
    let teamRosters = [];
    if (teamIds.length) {
      const ph = teamIds.map(() => '?').join(',');
      const [mrows] = await db.query(
        `SELECT m.*, g.name AS game_name, ta.name AS team_a_name, tb.name AS team_b_name,
                v.name AS venue_name,
                CASE WHEN m.team_a_id IN (${ph}) THEN 'home' ELSE 'away' END AS side
         FROM matches m
         JOIN games g ON g.id = m.game_id
         LEFT JOIN teams ta ON ta.id = m.team_a_id
         LEFT JOIN teams tb ON tb.id = m.team_b_id
         LEFT JOIN venues v ON v.id = m.venue_id
         WHERE m.team_a_id IN (${ph}) OR m.team_b_id IN (${ph})
         ORDER BY m.scheduled_at ASC`,
        [...teamIds, ...teamIds, ...teamIds]
      );
      matches = mrows;

      const [rosterRows] = await db.query(
        `SELECT tm.team_id, t.name AS team_name, g.name AS game_name,
                u.id AS user_id, u.full_name, u.email, u.student_class,
                CASE WHEN t.captain_user_id = u.id THEN 'Captain' ELSE COALESCE(NULLIF(tm.role, ''), 'Player') END AS role_label,
                tm.status
         FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         JOIN games g ON g.id = t.game_id
         JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id IN (${ph}) AND tm.status = 'accepted'
         ORDER BY t.name, FIELD(CASE WHEN t.captain_user_id = u.id THEN 'Captain' ELSE COALESCE(NULLIF(tm.role, ''), 'Player') END, 'Captain', 'Player'), u.full_name`,
        teamIds
      );

      const grouped = {};
      rosterRows.forEach((member) => {
        if (!grouped[member.team_id]) {
          grouped[member.team_id] = {
            team_id: member.team_id,
            team_name: member.team_name,
            game_name: member.game_name,
            members: []
          };
        }
        grouped[member.team_id].members.push({
          user_id: member.user_id,
          full_name: member.full_name,
          email: member.email,
          student_class: member.student_class,
          role_label: member.role_label
        });
      });
      teamRosters = Object.values(grouped);
    }

    const [notifications] = await db.query(
      `SELECT * FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
      [userId]
    );

    const [unread] = await db.query(
      `SELECT COUNT(*) AS c FROM user_notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    const [conflicts] = await db.query(
      `SELECT sc.*, g.name AS game_name FROM schedule_conflicts sc
       JOIN matches m ON m.id = sc.match_id
       JOIN games g ON g.id = m.game_id
       WHERE sc.user_id = ? AND sc.status = 'open'`,
      [userId]
    );

    const progress = {
      total_requests: memberships.length,
      accepted: memberships.filter((m) => m.status === 'accepted').length,
      pending: memberships.filter((m) => m.status === 'pending').length,
      rejected: memberships.filter((m) => m.status === 'rejected').length,
      upcoming_matches: matches.filter((m) => m.status === 'scheduled').length,
      completed_matches: matches.filter((m) => m.status === 'completed').length
    };

    res.json({
      memberships,
      matches,
      notifications,
      unread_count: unread[0].c,
      conflicts,
      progress,
      team_rosters: teamRosters
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
