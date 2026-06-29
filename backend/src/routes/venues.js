const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM venues ORDER BY name');
    res.json({ venues: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
