const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { requireAuth, requireMajorAdmin, getCommitteeGameId } = require('../middleware/auth');
const { resolveEntityId } = require('../utils/resolveEntityId');

const router = express.Router();

function makeQrCode() {
  return crypto.randomBytes(12).toString('hex');
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.*, u.username, g.name AS game_name, vs.shift_start, vs.shift_end, vs.status AS shift_status
       FROM volunteers v
       LEFT JOIN users u ON u.id = v.user_id
       LEFT JOIN volunteer_shifts vs ON vs.volunteer_id = v.id
       LEFT JOIN games g ON g.id = vs.game_id
       ORDER BY v.created_at DESC`
    );
    res.json({ volunteers: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/assignments', requireAuth, async (req, res) => {
  try {
    let gameId = null;
    if (req.user.role === 'Committee_Member') {
      const [rows] = await db.query('SELECT game_id FROM committee_memberships WHERE user_id = ? LIMIT 1', [req.user.id]);
      gameId = rows[0]?.game_id ?? null;
    }

    let query = `
      SELECT v.id, v.user_id, u.full_name, u.username, v.role,
             NULL AS role_type, NULL AS tier,
             va.attended AS attendance_status,
             va.created_at AS attendance_date
      FROM volunteers v
      LEFT JOIN users u ON u.id = v.user_id
      LEFT JOIN volunteer_shifts vs ON vs.volunteer_id = v.id
      LEFT JOIN volunteer_attendance va ON va.shift_id = vs.id AND va.volunteer_id = v.id`;
    const params = [];

    if (req.user.role === 'Committee_Member') {
      if (!gameId) {
        return res.json({ assignments: [] });
      }
      query += ' WHERE vs.game_id = ?';
      params.push(gameId);
    }

    query += ' GROUP BY v.id, v.user_id, u.full_name, u.username, v.role, va.attended, va.created_at ORDER BY u.full_name';

    const [rows] = await db.query(query, params);
    res.json({ assignments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/assign', requireAuth, async (req, res) => {
  const { user_id, game_id, role = 'volunteer', role_type = null, tier = null } = req.body;
  if (!user_id || !game_id) {
    return res.status(400).json({ error: 'user_id and game_id are required.' });
  }

  try {
    const [userRows] = await db.query('SELECT id, full_name, student_class, email, phone FROM users WHERE id = ?', [user_id]);
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (req.user.role === 'Major_Admin') {
      // ok
    } else if (req.user.role === 'Committee_Member') {
      const [rows] = await db.query('SELECT game_id FROM committee_memberships WHERE user_id = ? LIMIT 1', [req.user.id]);
      const assignedGameId = rows[0]?.game_id;
      if (!assignedGameId || Number(assignedGameId) !== Number(game_id)) {
        return res.status(403).json({ error: 'You can only assign volunteers for your assigned game.' });
      }
    } else {
      return res.status(403).json({ error: 'Committee or admin access required.' });
    }

    const [volunteerRows] = await db.query('SELECT 1 FROM volunteers v WHERE v.user_id = ? LIMIT 1', [user_id]);
    if (volunteerRows.length) {
      return res.status(400).json({ error: 'User is already a volunteer for another game.' });
    }

    if (userRows[0].role === 'Committee_Member') {
      const [cmRows] = await db.query('SELECT game_id FROM committee_memberships WHERE user_id = ? LIMIT 1', [user_id]);
      const assignedGameId = cmRows[0]?.game_id;
      if (assignedGameId && Number(assignedGameId) === Number(game_id)) {
        return res.status(400).json({ error: 'Committee heads cannot be volunteers for their own game.' });
      }

      const [playerRows] = await db.query(
        `SELECT 1 FROM team_members tm
         JOIN teams t ON tm.team_id = t.id
         WHERE tm.user_id = ? AND t.game_id = ?
         LIMIT 1`,
        [user_id, game_id]
      );
      if (playerRows.length) {
        return res.status(400).json({ error: 'User is already a player or captain in this game.' });
      }
    }

    const [existing] = await db.query('SELECT id FROM volunteers WHERE user_id = ?', [user_id]);
    const volunteerRole = role === 'Volunteer' ? 'volunteer' : role;

    let volunteerId;
    if (existing.length) {
      await db.query(
        'UPDATE volunteers SET full_name = ?, student_class = ?, email = ?, phone = ?, role = ?, assigned_by_user_id = ? WHERE id = ?',
        [userRows[0].full_name, userRows[0].student_class, userRows[0].email, userRows[0].phone, volunteerRole, req.user.id, existing[0].id]
      );
      volunteerId = existing[0].id;
    } else {
      const [result] = await db.query(
        'INSERT INTO volunteers (user_id, full_name, student_class, email, phone, role, assigned_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user_id, userRows[0].full_name, userRows[0].student_class, userRows[0].email, userRows[0].phone, volunteerRole, req.user.id]
      );
      volunteerId = result.insertId;
    }

    const qrCode = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [shiftResult] = await db.query(
      `INSERT INTO volunteer_shifts (volunteer_id, game_id, shift_start, shift_end, duration_minutes, status, qr_code, assigned_by)
       VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR), 120, 'assigned', ?, ?)
       ON DUPLICATE KEY UPDATE shift_start = VALUES(shift_start), shift_end = VALUES(shift_end), duration_minutes = VALUES(duration_minutes), status = VALUES(status), assigned_by = VALUES(assigned_by)`,
      [volunteerId, game_id, qrCode, req.user.id]
    );

    res.status(201).json({
      id: volunteerId,
      message: 'Volunteer assignment saved.',
      role_type,
      tier,
      shift_id: shiftResult.insertId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/assign/:id', requireAuth, async (req, res) => {
  const { attendance_status } = req.body;
  const volunteerId = req.params.id;

  if (!['present', 'absent'].includes(attendance_status)) {
    return res.status(400).json({ error: 'attendance_status must be present or absent.' });
  }

  try {
    const [volRows] = await db.query('SELECT id, user_id FROM volunteers WHERE id = ?', [volunteerId]);
    if (!volRows.length) {
      return res.status(404).json({ error: 'Volunteer not found.' });
    }

    let gameId = null;
    if (req.user.role === 'Committee_Member') {
      const [rows] = await db.query('SELECT game_id FROM committee_memberships WHERE user_id = ? LIMIT 1', [req.user.id]);
      gameId = rows[0]?.game_id;
      if (!gameId) {
        return res.status(403).json({ error: 'Committee head has no assigned game.' });
      }
    }

    const [shiftRows] = await db.query(
      `SELECT vs.id FROM volunteer_shifts vs
       WHERE vs.volunteer_id = ?${gameId ? ' AND vs.game_id = ?' : ''}
       ORDER BY vs.shift_start DESC LIMIT 1`,
      gameId ? [volunteerId, gameId] : [volunteerId]
    );
    if (!shiftRows.length) {
      return res.status(404).json({ error: 'Volunteer shift not found for this game.' });
    }

    const shiftId = shiftRows[0].id;
    const attendedValue = attendance_status === 'present' ? 1 : 0;

    const [existing] = await db.query('SELECT id FROM volunteer_attendance WHERE shift_id = ? AND volunteer_id = ?', [shiftId, volunteerId]);
    if (existing.length) {
      await db.query(
        `UPDATE volunteer_attendance SET attended = ?, scanned_at = NOW(), scanned_by = ? WHERE id = ?`,
        [attendedValue, req.user.id, existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO volunteer_attendance (shift_id, volunteer_id, attended, scanned_at, scanned_by)
         VALUES (?, ?, ?, NOW(), ?)`,
        [shiftId, volunteerId, attendedValue, req.user.id]
      );
    }

    await db.query('UPDATE volunteer_shifts SET status = ? WHERE id = ?', ['completed', shiftId]);
    res.json({ message: 'Volunteer attendance updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { full_name, student_class, email, phone, role } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required.' });
  try {
    const [result] = await db.query(
      `INSERT INTO volunteers (user_id, full_name, student_class, email, phone, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, full_name, student_class || null, email || null, phone || null, role || 'volunteer']
    );
    res.status(201).json({ id: result.insertId, message: 'Volunteer profile created.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/shifts', requireAuth, async (req, res) => {
  const { volunteer_id, game_id, venue_id, shift_start, shift_end, duration_minutes } = req.body;
  if (!volunteer_id || !game_id || !shift_start || !shift_end) {
    return res.status(400).json({ error: 'volunteer_id, game_id, shift_start and shift_end are required.' });
  }
  try {
    const resolvedVolunteerId = await resolveEntityId('volunteers', volunteer_id, ['full_name', 'email', 'phone']);
    const resolvedGameId = await resolveEntityId('games', game_id, ['name', 'sport_type']);
    const resolvedVenueId = venue_id ? await resolveEntityId('venues', venue_id, ['name', 'location']) : null;

    if (!resolvedVolunteerId) {
      return res.status(404).json({ error: 'Volunteer not found.' });
    }
    if (!resolvedGameId) {
      return res.status(404).json({ error: 'Game not found.' });
    }
    if (venue_id && !resolvedVenueId) {
      return res.status(404).json({ error: 'Venue not found.' });
    }

    if (req.user.role === 'Major_Admin') {
      /* ok */
    } else if (req.user.role === 'Committee_Member') {
      const gid = await getCommitteeGameId(req.user.id);
      if (!gid || Number(gid) !== Number(resolvedGameId)) {
        return res.status(403).json({ error: 'Not authorized for shifts outside your game.' });
      }
    } else {
      return res.status(403).json({ error: 'Only committee members or Major Admin may assign shifts.' });
    }

    const qrCode = makeQrCode();
    const [result] = await db.query(
      `INSERT INTO volunteer_shifts (volunteer_id, game_id, venue_id, shift_start, shift_end, duration_minutes, qr_code, assigned_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [resolvedVolunteerId, resolvedGameId, resolvedVenueId, shift_start, shift_end, duration_minutes || 120, qrCode, req.user.id]
    );
    res.status(201).json({ id: result.insertId, qr_code: qrCode, message: 'Volunteer shift assigned.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/shifts/:id/scan', requireAuth, async (req, res) => {
  const { qr_code } = req.body;
  if (!qr_code) return res.status(400).json({ error: 'qr_code is required.' });

  try {
    const [shifts] = await db.query('SELECT * FROM volunteer_shifts WHERE id = ?', [req.params.id]);
    if (!shifts.length) return res.status(404).json({ error: 'Shift not found.' });
    const shift = shifts[0];
    if (shift.qr_code !== qr_code) return res.status(400).json({ error: 'Invalid QR code.' });

    const [vols] = await db.query('SELECT * FROM volunteers WHERE id = ?', [shift.volunteer_id]);
    if (!vols.length) return res.status(404).json({ error: 'Volunteer profile not found.' });

    const [existing] = await db.query(
      `SELECT id FROM volunteer_attendance WHERE shift_id = ? AND volunteer_id = ?`,
      [shift.id, shift.volunteer_id]
    );
    if (existing.length) {
      await db.query(
        `UPDATE volunteer_attendance SET attended = 1, scanned_at = NOW(), scanned_by = ? WHERE id = ?`,
        [req.user.id, existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO volunteer_attendance (shift_id, volunteer_id, attended, scanned_at, scanned_by)
         VALUES (?, ?, 1, NOW(), ?)`,
        [shift.id, shift.volunteer_id, req.user.id]
      );
    }

    await db.query('UPDATE volunteer_shifts SET status = ? WHERE id = ?', ['completed', shift.id]);
    res.json({ message: 'Attendance recorded for volunteer.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attendance', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT va.*, vs.shift_start, vs.shift_end, vs.qr_code, vs.status AS shift_status,
              v.full_name AS volunteer_name, g.name AS game_name, u.full_name AS assigned_by_name
       FROM volunteer_attendance va
       JOIN volunteer_shifts vs ON vs.id = va.shift_id
       JOIN volunteers v ON v.id = va.volunteer_id
       LEFT JOIN games g ON g.id = vs.game_id
       LEFT JOIN users u ON u.id = vs.assigned_by
       ORDER BY va.created_at DESC`
    );
    res.json({ attendance: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
