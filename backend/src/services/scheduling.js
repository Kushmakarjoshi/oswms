/** Round-robin, knockout, and knockout+third-place bracket planning / insertion */

const db = require('../config/db');

function roundRobinPairings(teamIds) {
  const teams = [...teamIds];
  if (teams.length < 2) return [];

  const hasBye = teams.length % 2 !== 0;
  if (hasBye) teams.push(null);

  const n = teams.length;
  const rounds = n - 1;
  const pairings = [];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      if (home && away) {
        pairings.push({ teamA: home, teamB: away, round: round + 1, bracket_phase: 'league' });
      }
    }
    const fixed = teams[0];
    const rotated = [fixed, teams[n - 1], ...teams.slice(1, n - 1)];
    teams.splice(0, teams.length, ...rotated);
  }

  return pairings;
}

function isPowerOfTwo(n) {
  return n >= 2 && (n & (n - 1)) === 0;
}

function firstKnockoutPhase(matchCount) {
  if (matchCount >= 4) return 'quarterfinal';
  if (matchCount === 2) return 'semifinal';
  return 'final';
}

/**
 * Rows in bracket order. `winner_ref` / `loser_ref` are 0-based indices into this same array (resolved to DB ids at insert time).
 */
function planKnockoutWithThirdPlace(teamIds) {
  const teams = [...teamIds].sort(() => Math.random() - 0.5);
  const n = teams.length;
  if (!isPowerOfTwo(n)) {
    throw new Error('Knockout bracket requires a power-of-2 count of verified teams.');
  }

  const rows = [];
  let roundNum = 1;
  const firstCount = n / 2;
  const phase0 = firstKnockoutPhase(firstCount);

  for (let i = 0; i < n; i += 2) {
    rows.push({
      bracket_phase: phase0,
      round_number: roundNum,
      team_a_id: teams[i],
      team_b_id: teams[i + 1],
      winner_from_match_a_id: null,
      winner_from_match_b_id: null,
      loser_from_match_a_id: null,
      loser_from_match_b_id: null
    });
  }
  roundNum++;

  let levelStart = 0;
  let levelSize = firstCount;

  while (levelSize > 1) {
    const nextSize = levelSize / 2;
    const phase = nextSize === 1 ? 'final' : 'semifinal';
    for (let k = 0; k < nextSize; k++) {
      rows.push({
        bracket_phase: phase,
        round_number: roundNum,
        team_a_id: null,
        team_b_id: null,
        winner_ref: [levelStart + 2 * k, levelStart + 2 * k + 1],
        loser_from_match_a_id: null,
        loser_from_match_b_id: null
      });
    }
    levelStart += levelSize;
    levelSize = nextSize;
    roundNum++;
  }

  const semiIdx = [];
  rows.forEach((r, idx) => {
    if (r.bracket_phase === 'semifinal') semiIdx.push(idx);
  });
  if (semiIdx.length === 2) {
    rows.push({
      bracket_phase: 'third_place',
      round_number: roundNum,
      team_a_id: null,
      team_b_id: null,
      loser_ref: [semiIdx[0], semiIdx[1]],
      winner_from_match_a_id: null,
      winner_from_match_b_id: null,
      loser_from_match_a_id: null,
      loser_from_match_b_id: null
    });
  }

  return rows;
}

function materializeRefs(row, idByIndex) {
  const copy = { ...row };
  if (copy.winner_ref) {
    copy.winner_from_match_a_id = idByIndex[copy.winner_ref[0]];
    copy.winner_from_match_b_id = idByIndex[copy.winner_ref[1]];
    delete copy.winner_ref;
  }
  if (copy.loser_ref) {
    copy.loser_from_match_a_id = idByIndex[copy.loser_ref[0]];
    copy.loser_from_match_b_id = idByIndex[copy.loser_ref[1]];
    delete copy.loser_ref;
  }
  return copy;
}

async function insertKnockoutBracket({
  gameId,
  teamIds,
  venue_id,
  start_date,
  match_hours_gap,
  duration_minutes
}) {
  const plan = planKnockoutWithThirdPlace(teamIds);
  const idByIndex = {};
  const baseDate = start_date ? new Date(start_date) : new Date();
  const gapHours = match_hours_gap || 24;
  const dur = duration_minutes || 90;

  for (let i = 0; i < plan.length; i++) {
    const r = materializeRefs(plan[i], idByIndex);
    const scheduled = new Date(baseDate);
    scheduled.setHours(scheduled.getHours() + i * gapHours);

    const [ins] = await db.query(
      `INSERT INTO matches (
         game_id, team_a_id, team_b_id, venue_id, scheduled_at, round_number, duration_minutes,
         bracket_phase, winner_from_match_a_id, winner_from_match_b_id, loser_from_match_a_id, loser_from_match_b_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        r.team_a_id,
        r.team_b_id,
        venue_id || null,
        scheduled,
        r.round_number,
        dur,
        r.bracket_phase,
        r.winner_from_match_a_id,
        r.winner_from_match_b_id,
        r.loser_from_match_a_id,
        r.loser_from_match_b_id
      ]
    );
    idByIndex[i] = ins.insertId;
  }

  return { created: plan.length, match_ids: plan.map((_, i) => idByIndex[i]) };
}

function generateFixtures(teamIds, format) {
  if (format === 'knockout') {
    return planKnockoutWithThirdPlace(teamIds)
      .filter((r) => r.team_a_id && r.team_b_id)
      .map((r) => ({
        teamA: r.team_a_id,
        teamB: r.team_b_id,
        round: r.round_number,
        bracket_phase: r.bracket_phase
      }));
  }
  return roundRobinPairings(teamIds);
}

module.exports = {
  generateFixtures,
  roundRobinPairings,
  knockoutPairings: (ids) => generateFixtures(ids, 'knockout'),
  planKnockoutWithThirdPlace,
  insertKnockoutBracket
};
