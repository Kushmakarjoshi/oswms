const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, email, password, full_name, student_class, phone } = req.body;
  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ error: 'Username, email, password, and full name are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Username or email already registered.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, student_class, phone, role)
       VALUES (?, ?, ?, ?, ?, ?, 'Student')`,
      [username, email, hash, full_name, student_class || null, phone || null]
    );
    const user = { id: result.insertId, username, role: 'Student', full_name };
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const adminUser = process.env.AUTH_USER || 'admin';
  const adminPass = process.env.AUTH_PASSWORD || 'admin123';

  if (username === adminUser && password === adminPass) {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ? AND role = ?', [adminUser, 'Major_Admin']);
    let admin = rows[0];
    if (!admin) {
      const hash = await bcrypt.hash(adminPass, 10);
      const [r] = await db.query(
        `INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'Major_Admin')`,
        [adminUser, 'admin@nec.edu.np', hash, 'System Admin']
      );
      admin = { id: r.insertId, username: adminUser, role: 'Major_Admin', full_name: 'System Admin' };
    }
    return res.json({
      token: signToken(admin),
      user: { id: admin.id, username: admin.username, role: admin.role, full_name: admin.full_name }
    });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials.' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, email, full_name, student_class, phone, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
