const path = require('path');
const bcrypt = require(path.join(__dirname, '../backend/node_modules/bcryptjs'));
const mysql = require(path.join(__dirname, '../backend/node_modules/mysql2/promise'));
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));

dotenv.config({ path: path.join(__dirname, '../backend/.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

function normalizePassword(password) {
  if (password === '""' || password === "''" || password == null) return '';
  return password;
}

function pad(num, width = 3) {
  return String(num).padStart(width, '0');
}

function makePhone(index) {
  return `980${String(1000000 + index).slice(-7)}`;
}

function getRoleState(role) {
  switch (role) {
    case 'Major_Admin':
      return { role_type: 'admin', is_admin: 1, is_student: 0, is_committee_member: 0 };
    case 'Committee_Member':
      return { role_type: 'committee', is_admin: 0, is_student: 0, is_committee_member: 1 };
    default:
      return { role_type: 'student', is_admin: 0, is_student: 1, is_committee_member: 0 };
  }
}

async function buildConnection() {
  const password = normalizePassword(process.env.DB_PASSWORD);
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password,
    database: process.env.DB_NAME || 'oswms_db'
  });
}

async function ensureRow(conn, query, params) {
  const [rows] = await conn.query(query, params);
  return rows;
}

async function ensureColumn(conn, tableName, columnDefinition) {
  const [rows] = await conn.query(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tableName, columnDefinition.name]
  );
  if (rows.length) return;
  await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnDefinition.name}\` ${columnDefinition.definition}`);
}

async function upsertUser(conn, user) {
  const roleState = getRoleState(user.role);
  const [rows] = await conn.query('SELECT id FROM users WHERE username = ?', [user.username]);
  if (rows.length) {
    await conn.query(
      `UPDATE users SET email = ?, password_hash = ?, full_name = ?, student_class = ?, phone = ?, role = ?, role_type = ?, is_admin = ?, is_student = ?, is_committee_member = ? WHERE username = ?`,
      [user.email, user.password_hash, user.full_name, user.student_class, user.phone, user.role, roleState.role_type, roleState.is_admin, roleState.is_student, roleState.is_committee_member, user.username]
    );
    return rows[0].id;
  }
  const [result] = await conn.query(
    `INSERT INTO users (username, email, password_hash, full_name, student_class, phone, role, role_type, is_admin, is_student, is_committee_member)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.username, user.email, user.password_hash, user.full_name, user.student_class, user.phone, user.role, roleState.role_type, roleState.is_admin, roleState.is_student, roleState.is_committee_member]
  );
  return result.insertId;
}

async function upsertGame(conn, game) {
  const [rows] = await conn.query('SELECT id FROM games WHERE name = ?', [game.name]);
  if (rows.length) {
    await conn.query(
      `UPDATE games SET sport_type = ?, description = ?, rules_regulations = ?, format = ?, scoring_criteria = ?, scoring_mode = ?, approval_status = ?, max_teams = ?, max_players_per_team = ?, status = ? WHERE id = ?`,
      [game.sport_type, game.description, game.rules_regulations, game.format, game.scoring_criteria, game.scoring_mode, game.approval_status, game.max_teams, game.max_players_per_team, game.status, rows[0].id]
    );
    return rows[0].id;
  }
  const [result] = await conn.query(
    `INSERT INTO games (name, sport_type, description, rules_regulations, format, scoring_criteria, scoring_mode, scoring_parameters, equipment_required, approval_status, max_teams, max_players_per_team, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [game.name, game.sport_type, game.description, game.rules_regulations, game.format, game.scoring_criteria, game.scoring_mode, game.scoring_parameters, game.equipment_required, game.approval_status, game.max_teams, game.max_players_per_team, game.status]
  );
  return result.insertId;
}

async function upsertVenue(conn, venue) {
  const [rows] = await conn.query('SELECT id FROM venues WHERE name = ?', [venue.name]);
  if (rows.length) {
    await conn.query('UPDATE venues SET location = ? WHERE id = ?', [venue.location, rows[0].id]);
    return rows[0].id;
  }
  const [result] = await conn.query('INSERT INTO venues (name, location) VALUES (?, ?)', [venue.name, venue.location]);
  return result.insertId;
}

async function upsertTeam(conn, team) {
  const [rows] = await conn.query('SELECT id FROM teams WHERE name = ? AND game_id = ?', [team.name, team.game_id]);
  if (rows.length) {
    await conn.query(
      `UPDATE teams SET department = ?, captain_user_id = ?, verification_status = ? WHERE id = ?`,
      [team.department, team.captain_user_id, team.verification_status, rows[0].id]
    );
    return rows[0].id;
  }
  const [result] = await conn.query(
    `INSERT INTO teams (name, department, game_id, captain_user_id, verification_status)
     VALUES (?, ?, ?, ?, ?)`,
    [team.name, team.department, team.game_id, team.captain_user_id, team.verification_status]
  );
  return result.insertId;
}

async function upsertTeamMember(conn, member) {
  const [rows] = await conn.query('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?', [member.team_id, member.user_id]);
  if (!rows.length) {
    await conn.query(
      `INSERT INTO team_members (team_id, user_id, status, request_message, reviewed_at, reviewed_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [member.team_id, member.user_id, member.status, member.request_message, member.reviewed_at || null, member.reviewed_by || null]
    );
  }
}

async function upsertStanding(conn, standing) {
  await conn.query(
    `INSERT INTO standings (game_id, team_id, wins, losses, draws, points, goals_for, goals_against)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE wins = VALUES(wins), losses = VALUES(losses), draws = VALUES(draws), points = VALUES(points), goals_for = VALUES(goals_for), goals_against = VALUES(goals_against)`,
    [standing.game_id, standing.team_id, standing.wins, standing.losses, standing.draws, standing.points, standing.goals_for, standing.goals_against]
  );
}


async function upsertMatch(conn, match) {
  const [rows] = await conn.query(
    'SELECT id FROM matches WHERE game_id = ? AND team_a_id = ? AND team_b_id = ? AND scheduled_at = ?',
    [match.game_id, match.team_a_id, match.team_b_id, match.scheduled_at]
  );
  if (rows.length) {
    await conn.query(
      `UPDATE matches SET venue_id = ?, status = ?, score_a = ?, score_b = ?, winner_team_id = ?, round_number = ?, bracket_phase = ?, score_updated_at = ? WHERE id = ?`,
      [match.venue_id, match.status, match.score_a, match.score_b, match.winner_team_id, match.round_number, match.bracket_phase, match.score_updated_at, rows[0].id]
    );
    return rows[0].id;
  }
  const [result] = await conn.query(
    `INSERT INTO matches (game_id, team_a_id, team_b_id, venue_id, scheduled_at, duration_minutes, status, score_a, score_b, winner_team_id, round_number, bracket_phase, score_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [match.game_id, match.team_a_id, match.team_b_id, match.venue_id, match.scheduled_at, match.duration_minutes, match.status, match.score_a, match.score_b, match.winner_team_id, match.round_number, match.bracket_phase, match.score_updated_at]
  );
  return result.insertId;
}

async function upsertVolunteer(conn, volunteer) {
  const [rows] = await conn.query('SELECT id FROM volunteers WHERE email = ?', [volunteer.email]);
  if (rows.length) {
    await conn.query('UPDATE volunteers SET full_name = ?, student_class = ?, phone = ?, role = ?, user_id = ? WHERE id = ?', [volunteer.full_name, volunteer.student_class, volunteer.phone, volunteer.role, volunteer.user_id, rows[0].id]);
    return rows[0].id;
  }
  const [result] = await conn.query('INSERT INTO volunteers (user_id, full_name, student_class, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)', [volunteer.user_id, volunteer.full_name, volunteer.student_class, volunteer.email, volunteer.phone, volunteer.role]);
  return result.insertId;
}

async function upsertVolunteerShift(conn, shift) {
  const [rows] = await conn.query('SELECT id FROM volunteer_shifts WHERE qr_code = ?', [shift.qr_code]);
  if (rows.length) {
    await conn.query(
      `UPDATE volunteer_shifts SET volunteer_id = ?, game_id = ?, venue_id = ?, shift_start = ?, shift_end = ?, duration_minutes = ?, status = ?, assigned_by = ? WHERE id = ?`,
      [shift.volunteer_id, shift.game_id, shift.venue_id, shift.shift_start, shift.shift_end, shift.duration_minutes, shift.status, shift.assigned_by, rows[0].id]
    );
    return rows[0].id;
  }
  const [result] = await conn.query(
    `INSERT INTO volunteer_shifts (volunteer_id, game_id, venue_id, shift_start, shift_end, duration_minutes, status, qr_code, assigned_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [shift.volunteer_id, shift.game_id, shift.venue_id, shift.shift_start, shift.shift_end, shift.duration_minutes, shift.status, shift.qr_code, shift.assigned_by]
  );
  return result.insertId;
}

async function upsertParticipant(conn, participant) {
  const [rows] = await conn.query('SELECT id FROM participants WHERE email = ? AND game_id = ?', [participant.email, participant.game_id]);
  if (rows.length) {
    await conn.query('UPDATE participants SET full_name = ?, student_class = ?, phone = ?, team_id = ?, user_id = ?, verification_status = ? WHERE id = ?', [participant.full_name, participant.student_class, participant.phone, participant.team_id, participant.user_id, participant.verification_status, rows[0].id]);
    return rows[0].id;
  }
  const [result] = await conn.query('INSERT INTO participants (user_id, full_name, student_class, email, phone, game_id, team_id, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [participant.user_id, participant.full_name, participant.student_class, participant.email, participant.phone, participant.game_id, participant.team_id, participant.verification_status]);
  return result.insertId;
}

async function upsertComplaint(conn, complaint) {
  const [rows] = await conn.query('SELECT id FROM complaints WHERE complaint_code = ?', [complaint.complaint_code]);
  if (rows.length) {
    await conn.query(`UPDATE complaints SET user_id = ?, is_anonymous = ?, submitted_by = ?, email = ?, category = ?, subject = ?, description = ?, status = ?, admin_response = ? WHERE id = ?`, [complaint.user_id, complaint.is_anonymous, complaint.submitted_by, complaint.email, complaint.category, complaint.subject, complaint.description, complaint.status, complaint.admin_response, rows[0].id]);
    return rows[0].id;
  }
  const [result] = await conn.query(`INSERT INTO complaints (complaint_code, user_id, is_anonymous, submitted_by, email, category, subject, description, status, admin_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [complaint.complaint_code, complaint.user_id, complaint.is_anonymous, complaint.submitted_by, complaint.email, complaint.category, complaint.subject, complaint.description, complaint.status, complaint.admin_response]);
  return result.insertId;
}

async function upsertApproval(conn, approval) {
  const [rows] = await conn.query('SELECT id FROM event_approvals WHERE game_id = ? AND created_by = ?', [approval.game_id, approval.created_by]);
  if (rows.length) {
    await conn.query('UPDATE event_approvals SET status = ?, request_notes = ?, review_notes = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?', [approval.status, approval.request_notes, approval.review_notes, approval.reviewed_at, approval.reviewed_by, rows[0].id]);
    return rows[0].id;
  }
  const [result] = await conn.query('INSERT INTO event_approvals (game_id, created_by, status, request_notes, review_notes, requested_at, reviewed_at, reviewed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [approval.game_id, approval.created_by, approval.status, approval.request_notes, approval.review_notes, approval.requested_at, approval.reviewed_at, approval.reviewed_by]);
  return result.insertId;
}

async function seed() {
  const conn = await buildConnection();
  await ensureColumn(conn, 'team_members', { name: 'reviewed_by', definition: 'INT NULL' });
  await ensureColumn(conn, 'participants', { name: 'verification_status', definition: "ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'" });

  const adminPassword = process.env.AUTH_PASSWORD || 'admin123';
  const adminUser = process.env.AUTH_USER || 'admin';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const studentHash = await bcrypt.hash(process.env.STUDENT_PASSWORD || 'player123', 10);

  const adminUsers = [
    { username: adminUser, email: 'admin@nec.edu.np', full_name: 'System Admin', role: 'Major_Admin', student_class: null, phone: '9800000000', password_hash: adminHash },
    { username: 'admin2', email: 'admin2@nec.edu.np', full_name: 'Secondary Admin', role: 'Major_Admin', student_class: null, phone: '9800000009', password_hash: adminHash }
  ];

  const studentUsers = [
    {
      username: 'student0001',
      email: 'student0001@nec.edu.np',
      full_name: 'Student 0001',
      student_class: 'BE 1',
      phone: '9800000100',
      role: 'Student',
      password_hash: studentHash
    },
    {
      username: 'student0002',
      email: 'student0002@nec.edu.np',
      full_name: 'Student 0002',
      student_class: 'BE 2',
      phone: '9800000101',
      role: 'Student',
      password_hash: studentHash
    }
  ];
  for (let i = 3; i <= 10; i += 1) {
    const index = String(i).padStart(4, '0');
    studentUsers.push({
      username: `student${index}`,
      email: `student${index}@nec.edu.np`,
      full_name: `Student ${index}`,
      student_class: `BE ${i - 2}`,
      phone: `98000001${i}`,
      role: 'Student',
      password_hash: studentHash
    });
  }

  const allUsers = [...adminUsers, ...studentUsers];
  const userIds = {};
  for (const user of allUsers) {
    const id = await upsertUser(conn, user);
    userIds[user.username] = id;
  }

  const gamesData = [
    { name: 'Inter-College Football', sport_type: 'Football', description: 'Football league across participating colleges.', rules_regulations: 'Two halves of 45 minutes.', format: 'round_robin', scoring_criteria: 'Win=3, Draw=1, Loss=0', scoring_mode: 'points', scoring_parameters: null, equipment_required: 'Ball, nets', approval_status: 'approved', max_teams: 10, max_players_per_team: 15, status: 'active' },
    { name: 'Indoor Basketball', sport_type: 'Basketball', description: 'Knockout basketball competition.', rules_regulations: 'FIBA-style rules.', format: 'knockout', scoring_criteria: 'Win advances', scoring_mode: 'points', scoring_parameters: null, equipment_required: 'Basketball, court', approval_status: 'approved', max_teams: 8, max_players_per_team: 12, status: 'active' },
    { name: 'Table Tennis Tournament', sport_type: 'Table Tennis', description: 'Round robin table tennis event.', rules_regulations: 'Best of 5 sets.', format: 'round_robin', scoring_criteria: 'Win=2, Loss=0', scoring_mode: 'points', scoring_parameters: null, equipment_required: 'Table, rackets', approval_status: 'approved', max_teams: 16, max_players_per_team: 2, status: 'active' },
    { name: 'Volleyball League', sport_type: 'Volleyball', description: 'Indoor volleyball schedule for colleges.', rules_regulations: 'Best of 5 sets.', format: 'round_robin', scoring_criteria: 'Win=3, Loss=0', scoring_mode: 'points', scoring_parameters: null, equipment_required: 'Volleyball, net', approval_status: 'approved', max_teams: 8, max_players_per_team: 12, status: 'active' },
    { name: 'Badminton Championships', sport_type: 'Badminton', description: 'Individual and doubles badminton matches.', rules_regulations: 'Single elimination format.', format: 'knockout', scoring_criteria: 'Win advances', scoring_mode: 'points', scoring_parameters: null, equipment_required: 'Rackets, shuttlecocks', approval_status: 'approved', max_teams: 24, max_players_per_team: 2, status: 'active' },
    { name: 'Chess Rapid', sport_type: 'Chess', description: 'Rapid chess tournament.', rules_regulations: '15+10 time control.', format: 'round_robin', scoring_criteria: 'Win=1, Draw=0.5, Loss=0', scoring_mode: 'points', scoring_parameters: null, equipment_required: 'Chess board', approval_status: 'approved', max_teams: 20, max_players_per_team: 1, status: 'active' },
    { name: 'Debate Cup', sport_type: 'Debate', description: 'Inter-college debate league.', rules_regulations: 'British Parliamentary format.', format: 'knockout', scoring_criteria: 'Win advances', scoring_mode: 'custom', scoring_parameters: null, equipment_required: 'Microphones', approval_status: 'approved', max_teams: 16, max_players_per_team: 4, status: 'active' },
    { name: 'Track & Field', sport_type: 'Athletics', description: 'Track and field events.', rules_regulations: 'Multiple athletics disciplines.', format: 'round_robin', scoring_criteria: 'Points by position', scoring_mode: 'points', scoring_parameters: null, equipment_required: 'Track equipment', approval_status: 'approved', max_teams: 12, max_players_per_team: 10, status: 'active' },
    { name: 'Cricket Friendly', sport_type: 'Cricket', description: 'T20 cricket friendly matches.', rules_regulations: '20 overs per side.', format: 'knockout', scoring_criteria: 'Win advances', scoring_mode: 'points', scoring_parameters: null, equipment_required: 'Bat, ball, wickets', approval_status: 'approved', max_teams: 12, max_players_per_team: 11, status: 'active' },
    { name: 'Swimming Gala', sport_type: 'Swimming', description: 'Competitive swimming races.', rules_regulations: 'Multiple stroke events.', format: 'round_robin', scoring_criteria: 'Fastest times', scoring_mode: 'custom', scoring_parameters: null, equipment_required: 'Pool, swimwear', approval_status: 'approved', max_teams: 10, max_players_per_team: 8, status: 'active' }
  ];

  const gameIds = [];
  const excludedGameNames = new Set(['Demo Football', 'Demo Basketball', 'Demo Volleyball']);
  for (const game of gamesData) {
    if (excludedGameNames.has(game.name)) continue;
    gameIds.push(await upsertGame(conn, game));
  }

  const badmintonGameId = gameIds[4];
  for (const user of studentUsers.slice(2)) {
    await upsertParticipant(conn, {
      user_id: userIds[user.username],
      full_name: user.full_name,
      student_class: user.student_class,
      email: user.email,
      phone: user.phone,
      game_id: badmintonGameId,
      team_id: null,
      verification_status: 'pending'
    });
  }

  const [[userCount]] = await conn.query('SELECT COUNT(*) AS total FROM users');
  const [[gameCount]] = await conn.query('SELECT COUNT(*) AS total FROM games');

  console.log('Seed complete:');
  console.log(`  users: ${userCount.total}`);
  console.log(`  games: ${gameCount.total}`);
  console.log('Admin accounts:');
  console.log(`  ${adminUser} / ${adminPassword}`);
  console.log('Student accounts:');
  console.log(`  student0001 / ${process.env.STUDENT_PASSWORD || 'player123'}`);

  await conn.end();
}

module.exports = { seed };

if (require.main === module) {
  seed().catch((err) => {
    console.error('Database seed failed:', err.message || err);
    process.exit(1);
  });
}
