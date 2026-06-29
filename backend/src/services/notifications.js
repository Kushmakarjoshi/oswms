const db = require('../config/db');

async function notifyUser(userId, title, message, type = 'general', relatedId = null) {
  await db.query(
    `INSERT INTO user_notifications (user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, ?)`,
    [userId, title, message, type, relatedId]
  );
}

async function notifyBroadcast(title, message, type = 'broadcast') {
  await db.query(
    `INSERT INTO user_notifications (user_id, title, message, type) VALUES (NULL, ?, ?, ?)`,
    [title, message, type]
  );
}

async function notifyTeamMembers(teamId, title, message, type, relatedId = null) {
  const [members] = await db.query(
    `SELECT user_id FROM team_members WHERE team_id = ? AND status = 'accepted'`,
    [teamId]
  );
  for (const m of members) {
    await notifyUser(m.user_id, title, message, type, relatedId);
  }
}

async function notifyMatchTeams(matchId, title, message, type = 'score_update') {
  const [matches] = await db.query('SELECT team_a_id, team_b_id FROM matches WHERE id = ?', [matchId]);
  if (!matches.length) return;
  const { team_a_id, team_b_id } = matches[0];
  if (team_a_id) await notifyTeamMembers(team_a_id, title, message, type, matchId);
  if (team_b_id) await notifyTeamMembers(team_b_id, title, message, type, matchId);
}

module.exports = { notifyUser, notifyBroadcast, notifyTeamMembers, notifyMatchTeams };
