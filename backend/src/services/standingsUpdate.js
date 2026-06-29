const db = require('../config/db');

async function bumpStandingsOnComplete(gameId, teamA, teamB, scoreA, scoreB) {
  if (!teamA || !teamB) return;
  const winPts = 3;
  const drawPts = 1;
  const bump = async (teamId, wins, losses, draws, points, gf, ga) => {
    await db.query(
      `INSERT INTO standings (game_id, team_id, wins, losses, draws, points, goals_for, goals_against)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         wins = wins + VALUES(wins), losses = losses + VALUES(losses),
         draws = draws + VALUES(draws), points = points + VALUES(points),
         goals_for = goals_for + VALUES(goals_for), goals_against = goals_against + VALUES(goals_against)`,
      [gameId, teamId, wins, losses, draws, points, gf, ga]
    );
  };
  if (scoreA > scoreB) {
    await bump(teamA, 1, 0, 0, winPts, scoreA, scoreB);
    await bump(teamB, 0, 1, 0, 0, scoreB, scoreA);
  } else if (scoreB > scoreA) {
    await bump(teamB, 1, 0, 0, winPts, scoreB, scoreA);
    await bump(teamA, 0, 1, 0, 0, scoreA, scoreB);
  } else {
    await bump(teamA, 0, 0, 1, drawPts, scoreA, scoreB);
    await bump(teamB, 0, 0, 1, drawPts, scoreB, scoreA);
  }
}

module.exports = { bumpStandingsOnComplete };
