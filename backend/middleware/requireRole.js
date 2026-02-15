module.exports = function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const role = req.user.role || 'user';
    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    return next();
  };
};
