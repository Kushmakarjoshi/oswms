const express = require('express');
const db = require('../config/db');
const { requireAuth, requireMajorAdmin, getCommitteeGameId } = require('../middleware/auth');
const { resolveEntityId } = require('../utils/resolveEntityId');

const router = express.Router();

router.get('/rates', requireAuth, async (req, res) => {
  try {
    const [rates] = await db.query('SELECT * FROM payment_rates ORDER BY role');
    res.json({ rates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rates', requireMajorAdmin, async (req, res) => {
  const { role, unit_type, amount } = req.body;
  if (!role || !unit_type || amount == null) {
    return res.status(400).json({ error: 'role, unit_type and amount are required.' });
  }
  try {
    await db.query(
      `INSERT INTO payment_rates (role, unit_type, amount)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE unit_type = VALUES(unit_type), amount = VALUES(amount)`,
      [role, unit_type, amount]
    );
    res.status(201).json({ message: 'Payment rate saved.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/calculate', requireAuth, async (req, res) => {
  const { game_id, include_shifts, include_matches } = req.body;
  try {
    let resolvedGameId = null;
    if (game_id) {
      resolvedGameId = await resolveEntityId('games', game_id, ['name', 'sport_type']);
      if (!resolvedGameId) return res.status(404).json({ error: 'Game not found.' });
    }

    if (req.user.role !== 'Major_Admin' && req.user.role !== 'Committee_Member') {
      return res.status(403).json({ error: 'Not authorized.' });
    }
    if (req.user.role === 'Committee_Member') {
      const gid = await getCommitteeGameId(req.user.id);
      if (!gid || (resolvedGameId && Number(gid) !== Number(resolvedGameId))) {
        return res.status(403).json({ error: 'Not authorized for this game.' });
      }
    }

    const [rates] = await db.query('SELECT role, unit_type, amount FROM payment_rates');
    const rateMap = rates.reduce((acc, item) => ({ ...acc, [item.role]: item }), {});

    const payments = [];
    if (include_matches !== false) {
      const [officials] = await db.query(
        `SELECT mo.id, mo.volunteer_id, mo.role, mo.match_id, mo.assigned_at,
                v.full_name, v.email, m.status AS match_status
         FROM match_officials mo
         JOIN volunteers v ON v.id = mo.volunteer_id
         JOIN matches m ON m.id = mo.match_id
         WHERE m.status = 'completed'${resolvedGameId ? ' AND m.game_id = ?' : ''}`,
        resolvedGameId ? [resolvedGameId] : []
      );

      for (const official of officials) {
        const rate = rateMap[official.role];
        if (!rate) continue;
        payments.push({
          volunteer_id: official.volunteer_id,
          full_name: official.full_name,
          email: official.email,
          role: official.role,
          source: 'match',
          source_id: official.match_id,
          amount: Number(rate.amount || 0).toFixed(2)
        });
      }
    }

    if (include_shifts !== false) {
      const [shifts] = await db.query(
        `SELECT vs.id, vs.volunteer_id, vs.duration_minutes, v.full_name, v.email, vs.status
         FROM volunteer_shifts vs
         JOIN volunteers v ON v.id = vs.volunteer_id
         WHERE vs.status = 'completed'${resolvedGameId ? ' AND vs.game_id = ?' : ''}`,
        resolvedGameId ? [resolvedGameId] : []
      );

      for (const shift of shifts) {
        const rate = rateMap.volunteer;
        if (!rate) continue;
        payments.push({
          volunteer_id: shift.volunteer_id,
          full_name: shift.full_name,
          email: shift.email,
          role: 'volunteer',
          source: 'shift',
          source_id: shift.id,
          amount: Number(rate.amount || 0).toFixed(2)
        });
      }
    }

    res.json({ payments, total: payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stage', requireMajorAdmin, async (req, res) => {
  const { payments } = req.body;
  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ error: 'payments array is required.' });
  }
  try {
    const tasks = payments.map((p) => db.query(
      `INSERT INTO payments (volunteer_id, match_id, shift_id, role, source_type, amount, status, processed_by, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, 'staged', ?, NOW())`,
      [p.volunteer_id, p.match_id || null, p.shift_id || null, p.role, p.source, p.amount, req.user.id]
    ));
    await Promise.all(tasks);
    res.status(201).json({ message: 'Payments staged for approval.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireMajorAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, v.full_name AS volunteer_name, v.email, g.name AS game_name, m.scheduled_at AS match_date, vs.shift_start, vs.shift_end
       FROM payments p
       JOIN volunteers v ON v.id = p.volunteer_id
       LEFT JOIN matches m ON m.id = p.match_id
       LEFT JOIN volunteer_shifts vs ON vs.id = p.shift_id
       LEFT JOIN games g ON g.id = COALESCE(m.game_id, vs.game_id)
       ORDER BY p.created_at DESC`
    );
    res.json({ payments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireMajorAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'staged', 'paid', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid payment status.' });
  }
  try {
    await db.query('UPDATE payments SET status = ?, processed_by = ?, processed_at = NOW() WHERE id = ?', [status, req.user.id, req.params.id]);
    res.json({ message: 'Payment record updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
