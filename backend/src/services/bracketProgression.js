/**
 * When a knockout match completes, propagate winner/loser into downstream bracket slots
 * linked via winner_from_match_* / loser_from_match_*.
 */
async function propagateBracketResult(completedMatchId, conn) {
  const [completed] = await conn.query(
    `SELECT id, winner_team_id, team_a_id, team_b_id, status, bracket_phase
     FROM matches WHERE id = ?`,
    [completedMatchId]
  );
  if (!completed.length || completed[0].status !== 'completed') {
    return { advanced: [], skipped: 'match_not_completed' };
  }

  const { winner_team_id: winnerId, team_a_id: teamA, team_b_id: teamB } = completed[0];
  if (!winnerId) {
    return { advanced: [], skipped: 'no_winner_draw' };
  }

  const loserId = Number(teamA) === Number(winnerId) ? teamB : teamA;
  const advanced = [];

  const [winnerFeeds] = await conn.query(
    `SELECT id, winner_from_match_a_id, winner_from_match_b_id
     FROM matches
     WHERE winner_from_match_a_id = ? OR winner_from_match_b_id = ?`,
    [completedMatchId, completedMatchId]
  );

  for (const feed of winnerFeeds) {
    if (Number(feed.winner_from_match_a_id) === Number(completedMatchId)) {
      await conn.query('UPDATE matches SET team_a_id = ? WHERE id = ?', [winnerId, feed.id]);
      advanced.push({ match_id: feed.id, slot: 'team_a', team_id: winnerId, feed: 'winner' });
    }
    if (Number(feed.winner_from_match_b_id) === Number(completedMatchId)) {
      await conn.query('UPDATE matches SET team_b_id = ? WHERE id = ?', [winnerId, feed.id]);
      advanced.push({ match_id: feed.id, slot: 'team_b', team_id: winnerId, feed: 'winner' });
    }
  }

  if (loserId) {
    const [loserFeeds] = await conn.query(
      `SELECT id, loser_from_match_a_id, loser_from_match_b_id
       FROM matches
       WHERE loser_from_match_a_id = ? OR loser_from_match_b_id = ?`,
      [completedMatchId, completedMatchId]
    );

    for (const feed of loserFeeds) {
      if (Number(feed.loser_from_match_a_id) === Number(completedMatchId)) {
        await conn.query('UPDATE matches SET team_a_id = ? WHERE id = ?', [loserId, feed.id]);
        advanced.push({ match_id: feed.id, slot: 'team_a', team_id: loserId, feed: 'loser' });
      }
      if (Number(feed.loser_from_match_b_id) === Number(completedMatchId)) {
        await conn.query('UPDATE matches SET team_b_id = ? WHERE id = ?', [loserId, feed.id]);
        advanced.push({ match_id: feed.id, slot: 'team_b', team_id: loserId, feed: 'loser' });
      }
    }
  }

  return { advanced, from_match_id: completedMatchId, bracket_phase: completed[0].bracket_phase };
}

module.exports = { propagateBracketResult };
