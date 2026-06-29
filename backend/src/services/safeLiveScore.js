const db = require('../config/db');
const { notifyMatchTeams } = require('./notifications');
const { bumpStandingsOnComplete } = require('./standingsUpdate');
const { propagateBracketResult } = require('./bracketProgression');

/**
 * Monotonic live score update ("one-way valve"):
 * new score_a >= current score_a AND new score_b >= current score_b.
 * Only Committee_Member for this match's game, or Major_Admin, may update.
 */
async function userMayScoreMatch(user, gameId) {
  if (!user || user.id == null) return false;
  if (user.role === 'Major_Admin') return true;
  if (user.role !== 'Committee_Member') return false;
  const [rows] = await db.query(
    'SELECT game_id FROM committee_memberships WHERE user_id = ? LIMIT 1',
    [user.id]
  );
  return rows.length > 0 && Number(rows[0].game_id) === Number(gameId);
}

async function applyMonotonicScoreUpdate(matchId, user, payload) {
  const { score_a: rawA, score_b: rawB, status } = payload;
  if (rawA === undefined && rawB === undefined && status === undefined) {
    return { ok: false, status: 400, error: 'No score or status fields provided.' };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [matches] = await conn.query(
      `SELECT m.id, m.game_id, m.score_a, m.score_b, m.status, m.team_a_id, m.team_b_id,
              ta.name AS team_a_name, tb.name AS team_b_name, g.name AS game_name
       FROM matches m
       JOIN games g ON g.id = m.game_id
       LEFT JOIN teams ta ON ta.id = m.team_a_id
       LEFT JOIN teams tb ON tb.id = m.team_b_id
       WHERE m.id = ?
       FOR UPDATE`,
      [matchId]
    );

    if (!matches.length) {
      await conn.rollback();
      return { ok: false, status: 404, error: 'Match not found.' };
    }

    const m = matches[0];
    const allowed = await userMayScoreMatch(user, m.game_id);
    if (!allowed) {
      await conn.rollback();
      return { ok: false, status: 403, error: 'Only the assigned game committee or Major Admin may update this score.' };
    }

    const curA = Number(m.score_a);
    const curB = Number(m.score_b);
    const nextA = rawA !== undefined ? Number(rawA) : curA;
    const nextB = rawB !== undefined ? Number(rawB) : curB;

    if (Number.isNaN(nextA) || Number.isNaN(nextB) || nextA < 0 || nextB < 0) {
      await conn.rollback();
      return { ok: false, status: 400, error: 'Scores must be non-negative integers.' };
    }

    if (nextA < curA || nextB < curB) {
      await conn.rollback();
      return { ok: false, status: 400, error: 'Score reduction not allowed', code: 'SCORE_MONOTONIC_VIOLATION' };
    }

    let winner = m.winner_team_id;
    if (nextA > nextB) winner = m.team_a_id;
    else if (nextB > nextA) winner = m.team_b_id;
    else winner = null;

    let newStatus = m.status;
    if (status) {
      newStatus = status;
    } else if (nextA !== curA || nextB !== curB) {
      newStatus = m.status === 'scheduled' ? 'ongoing' : m.status;
    }

    await conn.query(
      `UPDATE matches
       SET score_a = ?, score_b = ?, winner_team_id = ?, status = ?, score_updated_at = NOW()
       WHERE id = ?`,
      [nextA, nextB, winner, newStatus, matchId]
    );

    let bracketAdvance = null;
    if (newStatus === 'completed' && m.status !== 'completed' && winner) {
      bracketAdvance = await propagateBracketResult(matchId, conn);
    }

    await conn.commit();

    if (newStatus === 'completed' && m.status !== 'completed') {
      await bumpStandingsOnComplete(m.game_id, m.team_a_id, m.team_b_id, nextA, nextB);
    }

    const scoreMsg = `${m.team_a_name || 'TBD'} ${nextA} - ${nextB} ${m.team_b_name || 'TBD'} (${m.game_name})`;
    await notifyMatchTeams(matchId, 'Live score update', scoreMsg, 'score_update');

    return {
      ok: true,
      match: {
        id: matchId,
        score_a: nextA,
        score_b: nextB,
        winner_team_id: winner,
        status: newStatus
      },
      bracket_advance: bracketAdvance
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { applyMonotonicScoreUpdate, userMayScoreMatch };
