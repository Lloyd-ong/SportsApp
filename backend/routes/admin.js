const express = require('express');
const db = require('../db');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.delete('/admin/events/:id', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const [result] = await db.execute('DELETE FROM events WHERE id = ?', [eventId]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to remove event' });
  }
});

router.patch('/admin/users/:id/role', requireRole('superadmin'), async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const role = typeof req.body.role === 'string' ? req.body.role.trim().toLowerCase() : '';
    const allowedRoles = new Set(['user', 'admin', 'superadmin']);

    if (!allowedRoles.has(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const [result] = await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [rows] = await db.execute('SELECT id, name, email, role FROM users WHERE id = ?', [userId]);
    return res.json({ user: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update role' });
  }
});

module.exports = router;
