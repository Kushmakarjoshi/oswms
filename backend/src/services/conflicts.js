const db = require('../config/db');

const DEFAULT_DURATION = 90;

function overlaps(startA, durA, startB, durB) {
  const a0 = new Date(startA).getTime();
  const a1 = a0 + durA * 60000;
  const b0 = new Date(startB).getTime();
  const b1 = b0 + durB * 60000;
  return a0 < b1 && b0 < a1;
}

async function getApprovedMembersForTeams(teamIds) {
  if (!teamIds.filter(Boolean).length) return [];
  const placeholders = teamIds.filter(Boolean).map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT DISTINCT tm.user_id, tm.team_id, u.full_name
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id IN (${placeholders}) AND tm.status = 'accepted'`,
    teamIds.filter(Boolean)
  );
  return rows;
}

async function detectMatchConflicts(matchId, teamAId, teamBId, scheduledAt, durationMinutes = DEFAULT_DURATION) {
  if (!scheduledAt) return [];

  const members = await getApprovedMembersForTeams([teamAId, teamBId]);
  const conflicts = [];

  for (const member of members) {
    const [otherMatches] = await db.query(
      `SELECT m.id, m.scheduled_at, m.duration_minutes, m.team_a_id, m.team_b_id,
              ta.name AS team_a_name, tb.name AS team_b_name, g.name AS game_name
       FROM matches m
       JOIN games g ON g.id = m.game_id
       LEFT JOIN teams ta ON ta.id = m.team_a_id
       LEFT JOIN teams tb ON tb.id = m.team_b_id
       WHERE m.id != ? AND m.status IN ('scheduled', 'ongoing') AND m.scheduled_at IS NOT NULL
         AND (m.team_a_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'accepted')
           OR m.team_b_id IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'accepted'))`,
      [matchId || 0, member.user_id, member.user_id]
    );

    for (const om of otherMatches) {
      if (overlaps(scheduledAt, durationMinutes, om.scheduled_at, om.duration_minutes || DEFAULT_DURATION)) {
        conflicts.push({
          user_id: member.user_id,
          full_name: member.full_name,
          conflicting_match_id: om.id,
          match_id: matchId,
          message: `${member.full_name} is scheduled in "${om.game_name}" (${om.team_a_name} vs ${om.team_b_name}) at the same time.`
        });
      }
    }
  }
  return conflicts;
}

async function persistConflicts(matchId, conflicts) {
  await db.query('DELETE FROM schedule_conflicts WHERE match_id = ? AND status = ?', [matchId, 'open']);
  for (const c of conflicts) {
    await db.query(
      `INSERT INTO schedule_conflicts (match_id, user_id, conflicting_match_id, status)
       VALUES (?, ?, ?, 'open')`,
      [matchId, c.user_id, c.conflicting_match_id]
    );
    await db.query(
      `INSERT INTO user_notifications (user_id, title, message, type, related_id)
       VALUES (?, 'Schedule conflict detected', ?, 'conflict', ?)`,
      [c.user_id, c.message, matchId]
    );
  }
}

async function listOpenConflicts() {
  const [rows] = await db.query(
    `SELECT sc.*, u.full_name, m.scheduled_at,
            g.name AS game_name, ta.name AS team_a_name, tb.name AS team_b_name
     FROM schedule_conflicts sc
     JOIN users u ON u.id = sc.user_id
     JOIN matches m ON m.id = sc.match_id
     JOIN games g ON g.id = m.game_id
     LEFT JOIN teams ta ON ta.id = m.team_a_id
     LEFT JOIN teams tb ON tb.id = m.team_b_id
     WHERE sc.status = 'open'
     ORDER BY sc.created_at DESC`
  );
  return rows;
}

async function listOpenConflictsForGame(gameId) {
  const [rows] = await db.query(
    `SELECT sc.*, u.full_name, m.scheduled_at,
            g.name AS game_name, ta.name AS team_a_name, tb.name AS team_b_name
     FROM schedule_conflicts sc
     JOIN users u ON u.id = sc.user_id
     JOIN matches m ON m.id = sc.match_id
     JOIN games g ON g.id = m.game_id
     LEFT JOIN teams ta ON ta.id = m.team_a_id
     LEFT JOIN teams tb ON tb.id = m.team_b_id
     WHERE sc.status = 'open' AND m.game_id = ?
     ORDER BY sc.created_at DESC`,
    [gameId]
  );
  return rows;
}

module.exports = {
  detectMatchConflicts,
  persistConflicts,
  listOpenConflicts,
  listOpenConflictsForGame,
  overlaps,
  DEFAULT_DURATION
};
