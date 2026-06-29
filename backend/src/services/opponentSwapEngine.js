const db = require('../config/db');
const { detectMatchConflicts, persistConflicts, DEFAULT_DURATION } = require('./conflicts');

async function userMayEditMatchFixture(user, gameId) {
  if (!user || user.id == null) return false;
  if (user.role === 'Major_Admin') return true;
  if (user.role !== 'Committee_Member') return false;
  const [rows] = await db.query(
    'SELECT game_id FROM committee_memberships WHERE user_id = ? LIMIT 1',
    [user.id]
  );
  return rows.length > 0 && Number(rows[0].game_id) === Number(gameId);
}

/**
 * Committee fixture editor: swap sides, or replace one opponent with another verified team (same game).
 * Returns conflict warnings for student double-booking across games.
 */
async function swapOpponentsInFixture(matchId, user, body) {
  const { mode, replace_side, with_team_id } = body || {};
  if (!mode || !['flip_sides', 'replace_opponent'].includes(mode)) {
    return { ok: false, status: 400, error: 'mode must be "flip_sides" or "replace_opponent".' };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT m.*, g.name AS game_name
       FROM matches m JOIN games g ON g.id = m.game_id
       WHERE m.id = ? FOR UPDATE`,
      [matchId]
    );
    if (!rows.length) {
      await conn.rollback();
      return { ok: false, status: 404, error: 'Match not found.' };
    }

    const m = rows[0];
    const okRole = await userMayEditMatchFixture(user, m.game_id);
    if (!okRole) {
      await conn.rollback();
      return { ok: false, status: 403, error: 'Only the assigned game committee or Major Admin may modify this fixture.' };
    }

    let teamA = m.team_a_id;
    let teamB = m.team_b_id;

    if (mode === 'flip_sides') {
      const tmp = teamA;
      teamA = teamB;
      teamB = tmp;
    } else if (mode === 'replace_opponent') {
      if (!replace_side || !['team_a', 'team_b'].includes(replace_side) || !with_team_id) {
        await conn.rollback();
        return { ok: false, status: 400, error: 'replace_opponent requires replace_side ("team_a"|"team_b") and with_team_id.' };
      }
      const [newTeam] = await conn.query(
        `SELECT id, game_id, verification_status FROM teams WHERE id = ? FOR UPDATE`,
        [with_team_id]
      );
      if (!newTeam.length) {
        await conn.rollback();
        return { ok: false, status: 404, error: 'Replacement team not found.' };
      }
      if (Number(newTeam[0].game_id) !== Number(m.game_id)) {
        await conn.rollback();
        return { ok: false, status: 400, error: 'Replacement team must belong to the same game.' };
      }
      if (newTeam[0].verification_status !== 'verified') {
        await conn.rollback();
        return { ok: false, status: 400, error: 'Only verified teams may be placed into the bracket.' };
      }
      const otherId = replace_side === 'team_a' ? teamB : teamA;
      if (otherId && Number(otherId) === Number(with_team_id)) {
        await conn.rollback();
        return { ok: false, status: 400, error: 'Cannot schedule a team against itself.' };
      }
      if (replace_side === 'team_a') teamA = Number(with_team_id);
      else teamB = Number(with_team_id);
    }

    await conn.query(
      'UPDATE matches SET team_a_id = ?, team_b_id = ? WHERE id = ?',
      [teamA, teamB, matchId]
    );

    await conn.commit();

    const conflicts = await detectMatchConflicts(
      matchId,
      teamA,
      teamB,
      m.scheduled_at,
      m.duration_minutes || DEFAULT_DURATION
    );
    if (conflicts.length) await persistConflicts(matchId, conflicts);

    return {
      ok: true,
      match_id: matchId,
      team_a_id: teamA,
      team_b_id: teamB,
      conflict_warnings: conflicts,
      has_conflicts: conflicts.length > 0
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Update venue / schedule for a match (committee or Major_Admin). Re-runs conflict detection.
 */
async function updateFixtureSchedule(matchId, user, { scheduled_at, venue_id, duration_minutes, force }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM matches WHERE id = ? FOR UPDATE', [matchId]);
    if (!rows.length) {
      await conn.rollback();
      return { ok: false, status: 404, error: 'Match not found.' };
    }
    const m = rows[0];
    if (!(await userMayEditMatchFixture(user, m.game_id))) {
      await conn.rollback();
      return { ok: false, status: 403, error: 'Not authorized to edit this fixture.' };
    }

    const nextAt = scheduled_at !== undefined ? scheduled_at : m.scheduled_at;
    const nextVenue = venue_id !== undefined ? venue_id : m.venue_id;
    const nextDur = duration_minutes !== undefined ? duration_minutes : m.duration_minutes;

    const conflicts = await detectMatchConflicts(matchId, m.team_a_id, m.team_b_id, nextAt, nextDur || DEFAULT_DURATION);
    if (conflicts.length && !force) {
      await conn.rollback();
      return { ok: false, status: 409, error: 'Schedule conflicts detected.', conflicts };
    }

    await conn.query(
      `UPDATE matches SET
         scheduled_at = ?,
         venue_id = ?,
         duration_minutes = ?
       WHERE id = ?`,
      [nextAt, nextVenue, nextDur, matchId]
    );
    await conn.commit();

    if (conflicts.length) await persistConflicts(matchId, conflicts);

    return { ok: true, conflicts };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  swapOpponentsInFixture,
  updateFixtureSchedule,
  userMayEditMatchFixture
};
