const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminReport } = require('./reporting');

test('buildAdminReport groups games, committees, teams, complaints and rules into sections', () => {
  const payload = {
    summary: { games: 2, teams: 3, complaints: 1, committee_members: 2 },
    games: [
      {
        id: 1,
        name: 'Football',
        sport_type: 'Football',
        status: 'active',
        rules_regulations: 'No pushing',
        committee_members: [{ full_name: 'Asha', username: 'asha' }],
        teams: [{ name: 'Storm', captain_name: 'Asha', member_count: 5 }],
        complaints: []
      }
    ],
    committeeMembers: [{ full_name: 'Asha', username: 'asha', game_name: 'Football' }],
    teams: [{ name: 'Storm', captain_name: 'Asha', game_name: 'Football', member_count: 5 }],
    complaints: [{ complaint_code: 'CMP-001', subject: 'Venue issue', status: 'pending' }]
  };

  const report = buildAdminReport(payload);

  assert.equal(report.summary.games, 2);
  assert.equal(report.sections.length, 5);
  assert.equal(report.sections[0].title, 'Executive Summary');
  assert.match(report.sections[1].content, /Football/);
  assert.match(report.sections[4].content, /CMP-001/);
});
