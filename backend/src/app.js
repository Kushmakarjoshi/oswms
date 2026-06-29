const express = require('express');
const cors = require('cors');
const db = require('./config/db');
require('dotenv').config();

const authRouter = require('./routes/auth');
const gamesRouter = require('./routes/games');
const teamsRouter = require('./routes/teams');
const teamMembersRouter = require('./routes/teamMembers');
const participantsRouter = require('./routes/participants');
const matchesRouter = require('./routes/matches');
const leaderboardRouter = require('./routes/leaderboard');
const complaintsRouter = require('./routes/complaints');
const notificationsRouter = require('./routes/notifications');
const dashboardRouter = require('./routes/dashboard');
const userDashboardRouter = require('./routes/userDashboard');
const venuesRouter = require('./routes/venues');
const committeeRouter = require('./routes/committee');
const approvalsRouter = require('./routes/approvals');
const volunteersRouter = require('./routes/volunteers');
const paymentsRouter = require('./routes/payments');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ message: 'OSWMS backend is running.' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), database: process.env.DB_NAME || 'unconfigured' });
});

app.get('/api/visualize-db', async (req, res) => {
  const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    return res.json({ status: 'Disconnected', database: process.env.DB_NAME || 'unconfigured', tables: [], error: `Missing env vars: ${missing.join(', ')}` });
  }
  try {
    const [tables] = await db.query('SHOW TABLES');
    res.json({ status: 'Connected', database: process.env.DB_NAME, tables: tables.map((row) => Object.values(row)[0]) });
  } catch (error) {
    res.status(500).json({ status: 'Error', database: process.env.DB_NAME, tables: [], message: error.message });
  }
});

app.use('/api/auth', authRouter);
app.post('/api/login', (req, res, next) => {
  req.url = '/login';
  authRouter(req, res, next);
});

app.get('/api/events', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT id, name, sport_type, status, format, created_at FROM games ORDER BY created_at DESC`);
    res.json({
      events: rows.map((g) => ({
        id: `evt-${g.id}`,
        name: g.name,
        location: g.sport_type,
        startDate: g.created_at ? String(g.created_at).slice(0, 10) : 'TBD',
        endDate: 'TBD',
        status: g.status === 'active' ? 'Published' : g.status === 'draft' ? 'Draft' : 'Completed'
      }))
    });
  } catch {
    res.json({ events: [] });
  }
});

app.get('/api/schedule', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.id, g.name AS game_name, ta.name AS team_a, tb.name AS team_b,
        v.name AS venue, m.scheduled_at, m.status, m.score_a, m.score_b, m.round_number
      FROM matches m
      JOIN games g ON g.id = m.game_id
      LEFT JOIN teams ta ON ta.id = m.team_a_id
      LEFT JOIN teams tb ON tb.id = m.team_b_id
      LEFT JOIN venues v ON v.id = m.venue_id
      ORDER BY m.scheduled_at ASC`);
    res.json({
      schedule: rows.map((r) => ({
        id: r.id,
        match: `${r.game_name} — ${r.team_a || 'TBD'} vs ${r.team_b || 'TBD'}`,
        venue: r.venue || 'TBD',
        date: r.scheduled_at ? new Date(r.scheduled_at).toLocaleString() : 'TBD',
        description: `Round ${r.round_number} | ${r.status}${r.status === 'completed' ? ` | ${r.score_a}-${r.score_b}` : ''}`,
        status: r.status,
        score_a: r.score_a,
        score_b: r.score_b
      }))
    });
  } catch {
    res.json({ schedule: [] });
  }
});

app.use('/api/games', gamesRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/team-members', teamMembersRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/user-dashboard', userDashboardRouter);
app.use('/api/venues', venuesRouter);
app.use('/api/committee', committeeRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/volunteers', volunteersRouter);
app.use('/api/payments', paymentsRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`OSWMS backend running on port ${PORT}`));
