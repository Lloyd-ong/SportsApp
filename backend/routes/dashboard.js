const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT users, events, sports, updated_at FROM public_stats WHERE id = 1'
    );
    if (rows.length) {
      return res.json({ stats: rows[0] });
    }

    const [[userCount]] = await db.execute('SELECT COUNT(*) AS count FROM users');
    const [[eventCount]] = await db.execute(
      `SELECT COUNT(*) AS count
       FROM events
       WHERE start_time >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
         AND start_time < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`
    );
    const [[sportCount]] = await db.execute(
      `SELECT COUNT(DISTINCT sport) AS count
       FROM (
         SELECT sport FROM events
         UNION
         SELECT sport FROM communities
       ) AS sports
       WHERE sport IS NOT NULL AND sport <> ''`
    );

    await db.execute(
      `INSERT INTO public_stats (id, users, events, sports)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE users = VALUES(users), events = VALUES(events), sports = VALUES(sports)`,
      [userCount.count, eventCount.count, sportCount.count]
    );

    return res.json({
      stats: {
        users: userCount.count,
        events: eventCount.count,
        sports: sportCount.count
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load public stats' });
  }
});

router.get('/dashboard/user', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [[hostedCount]] = await db.execute(
      'SELECT COUNT(*) AS count FROM events WHERE creator_id = ?',
      [userId]
    );
    const [[rsvpCount]] = await db.execute(
      'SELECT COUNT(*) AS count FROM rsvps WHERE user_id = ?',
      [userId]
    );

    const [hostedEvents] = await db.execute(
      `SELECT
        events.id,
        events.title,
        events.sport,
        events.location,
        events.start_time,
        events.end_time,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = events.id) AS rsvp_count
      FROM events
      WHERE events.creator_id = ?
      ORDER BY events.start_time DESC
      LIMIT 6`,
      [userId]
    );

    const [rsvpEvents] = await db.execute(
      `SELECT
        events.id,
        events.title,
        events.sport,
        events.location,
        events.start_time,
        events.end_time,
        (SELECT COUNT(*) FROM rsvps r2 WHERE r2.event_id = events.id) AS rsvp_count
      FROM rsvps
      JOIN events ON events.id = rsvps.event_id
      WHERE rsvps.user_id = ?
      ORDER BY events.start_time DESC
      LIMIT 6`,
      [userId]
    );

    res.json({
      stats: {
        hosted: hostedCount.count,
        rsvps: rsvpCount.count
      },
      hostedEvents,
      rsvpEvents
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load user dashboard' });
  }
});

router.get('/dashboard/admin', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const [[stats]] = await db.execute(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM events) AS events,
        (SELECT COUNT(*) FROM rsvps) AS rsvps,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
        (SELECT COUNT(*) FROM users WHERE role = 'superadmin') AS superadmins`
    );

    const [recentEvents] = await db.execute(
      `SELECT
        events.id,
        events.title,
        events.sport,
        events.location,
        events.start_time,
        users.name AS host_name,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = events.id) AS rsvp_count
      FROM events
      JOIN users ON users.id = events.creator_id
      ORDER BY events.created_at DESC
      LIMIT 8`
    );

    const [recentUsers] = await db.execute(
      `SELECT id, name, email, role, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 8`
    );

    res.json({
      stats,
      recentEvents,
      recentUsers
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load admin dashboard' });
  }
});

router.get('/dashboard/superadmin', requireRole('superadmin'), async (req, res) => {
  try {
    const [[stats]] = await db.execute(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM events) AS events,
        (SELECT COUNT(*) FROM rsvps) AS rsvps,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
        (SELECT COUNT(*) FROM users WHERE role = 'superadmin') AS superadmins`
    );

    const [recentEvents] = await db.execute(
      `SELECT
        events.id,
        events.title,
        events.sport,
        events.location,
        events.start_time,
        users.name AS host_name,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = events.id) AS rsvp_count
      FROM events
      JOIN users ON users.id = events.creator_id
      ORDER BY events.created_at DESC
      LIMIT 8`
    );

    const [users] = await db.execute(
      `SELECT id, name, email, role, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 40`
    );

    res.json({
      stats,
      recentEvents,
      users
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load superadmin dashboard' });
  }
});

module.exports = router;
