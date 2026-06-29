const db = require('../config/db');

async function getActiveMembershipForGame(userId, gameId) {
  if (!userId || !gameId) return null;

  const [rows] = await db.query(
    `SELECT tm.id, tm.team_id, tm.status, t.name AS team_name
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = ? AND t.game_id = ? AND tm.status IN ('accepted', 'pending')
     ORDER BY FIELD(tm.status, 'accepted', 'pending'), tm.created_at DESC
     LIMIT 1`,
    [userId, gameId]
  );

  return rows[0] || null;
}

async function getGameTeamMemberships(userId, gameId) {
  if (!userId || !gameId) return [];

  const [rows] = await db.query(
    `SELECT tm.id, tm.team_id, tm.status, t.name AS team_name
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = ? AND t.game_id = ? AND tm.status IN ('accepted', 'pending')
     ORDER BY FIELD(tm.status, 'accepted', 'pending'), tm.created_at DESC`,
    [userId, gameId]
  );

  return rows;
}

module.exports = { getActiveMembershipForGame, getGameTeamMemberships };
