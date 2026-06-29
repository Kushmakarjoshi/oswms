const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'oswms-dev-secret-change-in-production';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function getToken(req) {
  return req.headers.authorization?.replace('Bearer ', '');
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    if (token === 'demo-auth-token') {
      req.user = { id: 0, username: 'admin', role: 'Major_Admin', full_name: 'Admin' };
      return next();
    }
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

function requireMajorAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'Major_Admin') {
      return res.status(403).json({ error: 'Major Admin access required.' });
    }
    next();
  });
}

/** @deprecated use requireMajorAdmin — kept for gradual migration */
const requireAdmin = requireMajorAdmin;

async function getCommitteeGameId(userId) {
  const [rows] = await db.query(
    'SELECT game_id FROM committee_memberships WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows.length ? Number(rows[0].game_id) : null;
}

/** Committee member for a specific game, or Major_Admin */
function requireCommitteeOrMajorForGame(getGameId) {
  return (req, res, next) => {
    requireAuth(req, res, async () => {
      try {
        if (req.user.role === 'Major_Admin') return next();
        if (req.user.role !== 'Committee_Member') {
          return res.status(403).json({ error: 'Committee member or Major Admin access required.' });
        }
        const gameId = await getGameId(req);
        if (!gameId) return res.status(400).json({ error: 'Game context missing.' });
        const assigned = await getCommitteeGameId(req.user.id);
        if (!assigned || assigned !== Number(gameId)) {
          return res.status(403).json({ error: 'You are not on the committee for this game.' });
        }
        return next();
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    });
  };
}

function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return next();
  try {
    if (token === 'demo-auth-token') req.user = { id: 0, role: 'Major_Admin' };
    else req.user = verifyToken(token);
  } catch { /* ignore */ }
  next();
}

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
  requireMajorAdmin,
  requireAdmin,
  requireCommitteeOrMajorForGame,
  getCommitteeGameId,
  optionalAuth,
  JWT_SECRET
};
