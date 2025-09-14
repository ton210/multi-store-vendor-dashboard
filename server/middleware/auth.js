const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userQuery = await db.query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.userId]);

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = userQuery.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const requireAdmin = requireRole(['admin']);
const requireAdminOrManager = requireRole(['admin', 'manager']);
const requireVendor = requireRole(['vendor']);

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireAdminOrManager,
  requireVendor
};