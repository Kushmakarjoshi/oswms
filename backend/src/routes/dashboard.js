const express = require('express');
const db = require('../config/db');
const { requireAuth, requireMajorAdmin } = require('../middleware/auth');
const { buildAdminReport } = require('../services/reporting');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const [[games]] = await db.query('SELECT COUNT(*) AS total FROM games');
    const [[teams]] = await db.query('SELECT COUNT(*) AS total FROM teams');
    const [[students]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE role = 'Student'");
    const [[matches]] = await db.query('SELECT COUNT(*) AS total FROM matches');
    const [[upcoming]] = await db.query(
      "SELECT COUNT(*) AS total FROM matches WHERE status = 'scheduled' AND scheduled_at > NOW()"
    );
    const [[completed]] = await db.query("SELECT COUNT(*) AS total FROM matches WHERE status = 'completed'");
    const [[complaintsPending]] = await db.query(
      "SELECT COUNT(*) AS total FROM complaints WHERE status = 'pending'"
    );
    const [[pendingJoins]] = await db.query(
      "SELECT COUNT(*) AS total FROM team_members WHERE status = 'pending'"
    );
    const [[openConflicts]] = await db.query(
      "SELECT COUNT(*) AS total FROM schedule_conflicts WHERE status = 'open'"
    );
    const [[pendingVerification]] = await db.query(
      "SELECT COUNT(*) AS total FROM teams WHERE verification_status = 'pending_verification'"
    );

    res.json({
      stats: {
        games: games.total,
        teams: teams.total,
        students: students.total,
        matches: matches.total,
        upcoming_matches: upcoming.total,
        completed_matches: completed.total,
        pending_complaints: complaintsPending.total,
        pending_team_join_requests: pendingJoins.total,
        open_conflicts: openConflicts.total,
        teams_pending_verification: pendingVerification.total
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tracking', requireMajorAdmin, async (req, res) => {
  try {
    const [students] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.student_class, u.phone, u.created_at,
              (SELECT COUNT(*) FROM team_members tm JOIN teams t2 ON t2.id = tm.team_id WHERE tm.user_id = u.id AND tm.status = 'accepted' AND t2.game_id IS NOT NULL) AS accepted_team_memberships,
              CASE
                WHEN cm.user_id IS NOT NULL THEN 'Committee Member'
                ELSE NULL
              END AS assigned_role,
              g.name AS committee_game_name
       FROM users u
       LEFT JOIN committee_memberships cm ON cm.user_id = u.id
       LEFT JOIN games g ON g.id = cm.game_id
       WHERE u.role IN ('Student', 'Committee_Member')
       ORDER BY u.full_name`
    );

    const [committees] = await db.query(
      `SELECT cm.id AS membership_id, cm.user_id, u.username, u.full_name, u.email, u.phone, g.name AS game_name
       FROM committee_memberships cm
       JOIN users u ON u.id = cm.user_id
       JOIN games g ON g.id = cm.game_id
       ORDER BY g.name, u.full_name`
    );

    const [games] = await db.query(
      `SELECT g.id, g.name, g.sport_type, g.status, g.approval_status,
              (SELECT COUNT(*) FROM teams t WHERE t.game_id = g.id) AS team_count,
              (SELECT COUNT(*) FROM matches m WHERE m.game_id = g.id) AS match_count
       FROM games g
       ORDER BY g.created_at DESC`
    );

    const [volunteers] = await db.query(
      `SELECT v.id, v.full_name, v.email, v.phone, v.role,
              (SELECT COUNT(*) FROM volunteer_shifts vs WHERE vs.volunteer_id = v.id) AS shift_count,
              (SELECT COUNT(*) FROM volunteer_shifts vs WHERE vs.volunteer_id = v.id AND vs.status = 'completed') AS completed_shifts,
              (SELECT COUNT(*) FROM volunteer_attendance va JOIN volunteer_shifts vs ON vs.id = va.shift_id WHERE va.volunteer_id = v.id AND va.attended = 1) AS attended_count
       FROM volunteers v
       ORDER BY v.full_name`
    );

    const [teams] = await db.query(
      `SELECT t.id, t.name, t.verification_status, g.name AS game_name, u.full_name AS captain_name,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND tm.status = 'accepted') AS member_count
       FROM teams t
       JOIN games g ON g.id = t.game_id
       JOIN users u ON u.id = t.captain_user_id
       ORDER BY g.name, t.name`
    );

    const [matches] = await db.query(
      `SELECT m.id, m.status, m.scheduled_at, m.score_a, m.score_b, g.name AS game_name,
              ta.name AS team_a_name, tb.name AS team_b_name
       FROM matches m
       JOIN games g ON g.id = m.game_id
       LEFT JOIN teams ta ON ta.id = m.team_a_id
       LEFT JOIN teams tb ON tb.id = m.team_b_id
       ORDER BY g.name, m.scheduled_at`
    );

    const [approvals] = await db.query(
      `SELECT ea.id, ea.status, ea.requested_at, g.name AS game_name, u.full_name AS submitted_by_name, u.username AS submitted_by_username
       FROM event_approvals ea
       LEFT JOIN games g ON g.id = ea.game_id
       LEFT JOIN users u ON u.id = ea.created_by
       ORDER BY ea.requested_at DESC`
    );

    const [complaints] = await db.query(
      `SELECT id, complaint_code, subject, status, submitted_by, created_at
       FROM complaints
       ORDER BY created_at DESC`
    );

    const [participants] = await db.query(
      `SELECT p.id, p.full_name, p.email, p.student_class, p.phone,
              COALESCE(
                (SELECT g2.name FROM committee_memberships cm JOIN games g2 ON g2.id = cm.game_id WHERE cm.user_id = p.user_id LIMIT 1),
                (SELECT g2.name FROM teams t JOIN games g2 ON g2.id = t.game_id WHERE t.captain_user_id = p.user_id LIMIT 1),
                (SELECT g2.name FROM team_members tm JOIN teams t2 ON t2.id = tm.team_id JOIN games g2 ON g2.id = t2.game_id WHERE tm.user_id = p.user_id AND tm.status = 'accepted' LIMIT 1),
                (SELECT g2.name FROM volunteer_shifts vs JOIN volunteers v ON v.id = vs.volunteer_id JOIN games g2 ON g2.id = vs.game_id WHERE v.user_id = p.user_id LIMIT 1)
              ) AS game_name,
              CASE
                WHEN EXISTS (SELECT 1 FROM committee_memberships cm WHERE cm.user_id = p.user_id) THEN 'Committee Head'
                WHEN EXISTS (SELECT 1 FROM volunteers v WHERE v.user_id = p.user_id) THEN 'Volunteer'
                WHEN EXISTS (SELECT 1 FROM teams t WHERE t.captain_user_id = p.user_id) THEN 'Captain'
                WHEN EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = p.user_id AND tm.status = 'accepted') THEN 'Player'
                ELSE NULL
              END AS role,
              CASE
                WHEN EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = p.user_id AND tm.status = 'accepted') THEN
                  COALESCE(
                    (SELECT tm.role FROM team_members tm WHERE tm.user_id = p.user_id AND tm.status = 'accepted' LIMIT 1),
                    'player'
                  )
                ELSE NULL
              END AS member_role
       FROM participants p
       LEFT JOIN games g ON g.id = p.game_id
       WHERE p.user_id IS NOT NULL
         AND (
           EXISTS (SELECT 1 FROM committee_memberships cm WHERE cm.user_id = p.user_id)
           OR EXISTS (SELECT 1 FROM volunteers v WHERE v.user_id = p.user_id)
           OR EXISTS (SELECT 1 FROM teams t WHERE t.captain_user_id = p.user_id)
           OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = p.user_id AND tm.status = 'accepted')
         )
         AND COALESCE(
           (SELECT g2.name FROM committee_memberships cm JOIN games g2 ON g2.id = cm.game_id WHERE cm.user_id = p.user_id LIMIT 1),
           (SELECT g2.name FROM teams t JOIN games g2 ON g2.id = t.game_id WHERE t.captain_user_id = p.user_id LIMIT 1),
           (SELECT g2.name FROM team_members tm JOIN teams t2 ON t2.id = tm.team_id JOIN games g2 ON g2.id = t2.game_id WHERE tm.user_id = p.user_id AND tm.status = 'accepted' LIMIT 1),
           (SELECT g2.name FROM volunteer_shifts vs JOIN volunteers v ON v.id = vs.volunteer_id JOIN games g2 ON g2.id = vs.game_id WHERE v.user_id = p.user_id LIMIT 1)
         ) IS NOT NULL
       ORDER BY game_name, p.full_name`
    );

    res.json({
      students,
      committees,
      games,
      volunteers,
      teams,
      matches,
      approvals,
      complaints,
      participants
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/report', requireMajorAdmin, async (req, res) => {
  try {
    const [reports] = await db.query(
      `SELECT g.id, g.name, g.sport_type, g.format, g.status,
              g.max_teams, g.max_players_per_team, g.created_at, g.rules_regulations,
              (SELECT CONCAT(u.full_name, ' (', u.username, ')')
                 FROM committee_memberships cm
                 JOIN users u ON u.id = cm.user_id
                 WHERE cm.game_id = g.id LIMIT 1) AS committee_head,
              (SELECT COUNT(*) FROM teams t WHERE t.game_id = g.id) AS teams_total,
              (SELECT COUNT(*) FROM teams t WHERE t.game_id = g.id AND t.verification_status = 'verified') AS teams_verified,
              (SELECT COUNT(*) FROM teams t WHERE t.game_id = g.id AND t.verification_status = 'pending_verification') AS teams_pending_verification,
              (SELECT COUNT(*) FROM matches m WHERE m.game_id = g.id) AS matches_total,
              (SELECT COUNT(*) FROM matches m WHERE m.game_id = g.id AND m.status = 'scheduled') AS matches_scheduled,
              (SELECT COUNT(*) FROM matches m WHERE m.game_id = g.id AND m.status = 'ongoing') AS matches_ongoing,
              (SELECT COUNT(*) FROM matches m WHERE m.game_id = g.id AND m.status = 'completed') AS matches_completed,
              (SELECT COUNT(*) FROM matches m WHERE m.game_id = g.id AND m.status = 'cancelled') AS matches_cancelled,
              (SELECT COUNT(DISTINCT tm.user_id)
                 FROM teams t JOIN team_members tm ON tm.team_id = t.id
                 WHERE t.game_id = g.id AND tm.status = 'accepted') AS accepted_team_members,
              (SELECT COUNT(*) FROM participants p WHERE p.game_id = g.id) AS participants_total
       FROM games g
       ORDER BY g.created_at DESC`
    );

    const [committeeMembers] = await db.query(
      `SELECT cm.game_id, u.full_name, u.username, g.name AS game_name
       FROM committee_memberships cm
       JOIN users u ON u.id = cm.user_id
       JOIN games g ON g.id = cm.game_id
       ORDER BY g.name`
    );

    const [teams] = await db.query(
      `SELECT t.id, t.name, t.game_id, g.name AS game_name, u.full_name AS captain_name,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND tm.status = 'accepted') AS member_count
       FROM teams t
       JOIN games g ON g.id = t.game_id
       JOIN users u ON u.id = t.captain_user_id
       ORDER BY g.name, t.name`
    );

    const [complaints] = await db.query(
      `SELECT id, complaint_code, subject, status, created_at FROM complaints ORDER BY created_at DESC`
    );

    const report = buildAdminReport({
      summary: {
        games: reports.length,
        teams: teams.length,
        complaints: complaints.length,
        committee_members: committeeMembers.length
      },
      games: reports.map((game) => ({
        ...game,
        committee_members: committeeMembers.filter((member) => member.game_id === game.id)
      })),
      committeeMembers,
      teams,
      complaints
    });

    res.json({ report, reports, committeeMembers, teams, complaints });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
