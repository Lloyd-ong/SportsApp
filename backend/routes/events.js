const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { stripLocationLabel, getPlacePhotoReference, buildPhotoProxyUrl } = require('../utils/places');

const router = express.Router();

function normalizeDateTime(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const withSpace = trimmed.replace('T', ' ');
  if (withSpace.length === 16) {
    return `${withSpace}:00`;
  }
  return withSpace.slice(0, 19);
}

function normalizeDateOnly(value, boundary) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  return `${trimmed} ${boundary === 'end' ? '23:59:59' : '00:00:00'}`;
}

function buildListQuery(filters, userId) {
  const { q, upcomingOnly, limit, sport, region, startDate, endDate } = filters;
  const params = [];
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 30;

  const isGoingSelect = userId
    ? 'EXISTS (SELECT 1 FROM rsvps r2 WHERE r2.event_id = events.id AND r2.user_id = ?) AS is_going'
    : '0 AS is_going';

  if (userId) {
    params.push(userId);
  }

  const whereClauses = [];
  if (upcomingOnly) {
    whereClauses.push('events.start_time >= NOW()');
  }
  if (q) {
    const like = `%${q}%`;
    whereClauses.push('(events.title LIKE ? OR events.sport LIKE ? OR events.location LIKE ?)');
    params.push(like, like, like);
  }
  if (sport) {
    const like = `%${sport}%`;
    whereClauses.push('events.sport LIKE ?');
    params.push(like);
  }
  if (region) {
    const like = `%${region}%`;
    whereClauses.push('events.location LIKE ?');
    params.push(like);
  }
  if (startDate) {
    whereClauses.push('events.start_time >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('events.start_time <= ?');
    params.push(endDate);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT
      events.id,
      events.title,
      events.description,
      events.sport,
      events.location,
      events.image_url,
      events.start_time,
      events.end_time,
      events.capacity,
      events.created_at,
      events.updated_at,
      users.id AS host_id,
      users.name AS host_name,
      users.privacy_contact AS host_privacy_contact,
      users.avatar_url AS host_avatar,
      (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = events.id) AS rsvp_count,
      ${isGoingSelect}
    FROM events
    JOIN users ON users.id = events.creator_id
    ${where}
    ORDER BY events.start_time ASC
    LIMIT ${safeLimit}
  `;

  return { sql, params };
}

async function ensureEventAccess(eventId, userId) {
  const [events] = await db.execute('SELECT id, creator_id FROM events WHERE id = ?', [eventId]);
  if (!events.length) {
    return { ok: false, status: 404, error: 'Event not found' };
  }

  if (events[0].creator_id === userId) {
    return { ok: true };
  }

  const [rsvps] = await db.execute(
    'SELECT 1 FROM rsvps WHERE event_id = ? AND user_id = ? LIMIT 1',
    [eventId, userId]
  );

  if (!rsvps.length) {
    return { ok: false, status: 403, error: 'RSVP required to access event chat' };
  }

  return { ok: true };
}

router.get('/feed', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const sport = typeof req.query.sport === 'string' ? req.query.sport.trim().slice(0, 80) : '';
    const region = typeof req.query.region === 'string' ? req.query.region.trim().slice(0, 120) : '';
    const startDate = normalizeDateOnly(req.query.startDate, 'start');
    const endDate = normalizeDateOnly(req.query.endDate, 'end');
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 30, 100);
    const { sql, params } = buildListQuery(
      { q, sport, region, startDate, endDate, upcomingOnly: true, limit },
      req.user ? req.user.id : null
    );
    const [rows] = await db.execute(sql, params);
    res.json({ events: rows });
  } catch (err) {
    console.error('Failed to load feed', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const sport = typeof req.query.sport === 'string' ? req.query.sport.trim().slice(0, 80) : '';
    const region = typeof req.query.region === 'string' ? req.query.region.trim().slice(0, 120) : '';
    const startDate = normalizeDateOnly(req.query.startDate, 'start');
    const endDate = normalizeDateOnly(req.query.endDate, 'end');
    const includePast = req.query.includePast === 'true';
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 100, 200);
    const { sql, params } = buildListQuery(
      { q, sport, region, startDate, endDate, upcomingOnly: !includePast, limit },
      req.user ? req.user.id : null
    );
    const [rows] = await db.execute(sql, params);
    res.json({ events: rows });
  } catch (err) {
    console.error('Failed to load events', err);
    res.status(500).json({
      error: 'Failed to load events',
      detail: err.message,
      code: err.code || null
    });
  }
});

router.get('/events/:id', async (req, res) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const userId = req.user ? req.user.id : null;
    const isGoingSelect = userId
      ? 'EXISTS (SELECT 1 FROM rsvps r2 WHERE r2.event_id = events.id AND r2.user_id = ?) AS is_going'
      : '0 AS is_going';
    const sql = `
      SELECT
        events.id,
        events.title,
        events.description,
        events.sport,
        events.location,
        events.image_url,
        events.start_time,
        events.end_time,
        events.capacity,
        events.created_at,
        events.updated_at,
        users.id AS host_id,
        users.name AS host_name,
        users.privacy_contact AS host_privacy_contact,
        users.avatar_url AS host_avatar,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = events.id) AS rsvp_count,
        ${isGoingSelect}
      FROM events
      JOIN users ON users.id = events.creator_id
      WHERE events.id = ?
      LIMIT 1
    `;
    const params = userId ? [userId, eventId] : [eventId];
    const [rows] = await db.execute(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json({ event: rows[0] });
  } catch (err) {
    console.error('Failed to load event', err);
    return res.status(500).json({ error: 'Failed to load event' });
  }
});

router.post('/events', requireAuth, async (req, res) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const sport = typeof req.body.sport === 'string' ? req.body.sport.trim() : '';
    const rawLocation = typeof req.body.location === 'string' ? req.body.location.trim() : '';
    const location = stripLocationLabel(rawLocation);
    let imageUrl = typeof req.body.image_url === 'string' ? req.body.image_url.trim() : '';
    const startTime = normalizeDateTime(req.body.start_time);
    const endTime = normalizeDateTime(req.body.end_time);

    let capacity = Number.parseInt(req.body.capacity, 10);
    if (!Number.isInteger(capacity) || capacity < 1) {
      capacity = null;
    }

    if (!title || !sport || !location || !startTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!imageUrl) {
      try {
        const locationLabel = stripLocationLabel(location);
        const photoRef = await getPlacePhotoReference(locationLabel);
        if (photoRef) {
          imageUrl = buildPhotoProxyUrl(req, photoRef);
        }
      } catch (err) {
        console.warn('Failed to fetch place photo', err.message);
      }
    }

    const [result] = await db.execute(
      `INSERT INTO events
        (creator_id, title, description, sport, location, image_url, start_time, end_time, capacity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id` ,
      [
        req.user.id,
        title,
        description || null,
        sport,
        location,
        imageUrl || null,
        startTime,
        endTime,
        capacity
      ]
    );

    const [rows] = await db.execute(
      `SELECT
        events.id,
        events.title,
        events.description,
        events.sport,
        events.location,
        events.image_url,
        events.start_time,
        events.end_time,
        events.capacity,
        events.created_at,
        events.updated_at,
        users.id AS host_id,
        users.name AS host_name,
        users.privacy_contact AS host_privacy_contact,
        users.avatar_url AS host_avatar,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = events.id) AS rsvp_count,
        1 AS is_going
      FROM events
      JOIN users ON users.id = events.creator_id
      WHERE events.id = ?
      LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({ event: rows[0] });
  } catch (err) {
    console.error('Failed to create event', err);
    return res.status(500).json({
      error: 'Failed to create event',
      detail: err.message,
      code: err.code || null
    });
  }
});

router.post('/events/:id/rsvp', requireAuth, async (req, res) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const [events] = await db.execute(
      'SELECT capacity FROM events WHERE id = ?',
      [eventId]
    );
    if (!events.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const capacity = events[0].capacity;
    if (capacity && capacity > 0) {
      const [[countRow]] = await db.execute(
        'SELECT COUNT(*) AS count FROM rsvps WHERE event_id = ?',
        [eventId]
      );
      if (countRow.count >= capacity) {
        return res.status(409).json({ error: 'Event is full' });
      }
    }

    try {
      await db.execute(
        'INSERT INTO rsvps (user_id, event_id) VALUES (?, ?)',
        [req.user.id, eventId]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') {
        return res.status(409).json({ error: "Already RSVP'd" });
      }
      throw err;
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Failed to RSVP', err);
    return res.status(500).json({ error: 'Failed to RSVP' });
  }
});

router.delete('/events/:id/rsvp', requireAuth, async (req, res) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    await db.execute(
      'DELETE FROM rsvps WHERE user_id = ? AND event_id = ?',
      [req.user.id, eventId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to cancel RSVP', err);
    return res.status(500).json({ error: 'Failed to cancel RSVP' });
  }
});

router.patch('/events/:id', requireAuth, async (req, res) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const [events] = await db.execute(
      'SELECT * FROM events WHERE id = ?',
      [eventId]
    );
    if (!events.length) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (events[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the host can edit this event' });
    }

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : events[0].title;
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : events[0].description;
    const sport = typeof req.body.sport === 'string' ? req.body.sport.trim() : events[0].sport;
    const location = typeof req.body.location === 'string'
      ? stripLocationLabel(req.body.location.trim())
      : stripLocationLabel(events[0].location);
    let imageUrl = typeof req.body.image_url === 'string' ? req.body.image_url.trim() : events[0].image_url;
    const startTime = normalizeDateTime(req.body.start_time) || events[0].start_time;
    const endTime = normalizeDateTime(req.body.end_time) || events[0].end_time;

    let capacity = Number.parseInt(req.body.capacity, 10);
    if (!Number.isInteger(capacity) || capacity < 1) {
      capacity = events[0].capacity || null;
    }

    if (!title || !sport || !location || !startTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!imageUrl) {
      try {
        const locationLabel = stripLocationLabel(location);
        const photoRef = await getPlacePhotoReference(locationLabel);
        if (photoRef) {
          imageUrl = buildPhotoProxyUrl(req, photoRef);
        }
      } catch (err) {
        console.warn('Failed to fetch place photo', err.message);
      }
    }

    await db.execute(
      `UPDATE events
       SET title = ?, description = ?, sport = ?, location = ?, image_url = ?, start_time = ?, end_time = ?, capacity = ?
       WHERE id = ?`,
      [
        title,
        description || null,
        sport,
        location,
        imageUrl || null,
        startTime,
        endTime,
        capacity,
        eventId
      ]
    );

    const [rows] = await db.execute(
      `SELECT
        events.id,
        events.title,
        events.description,
        events.sport,
        events.location,
        events.image_url,
        events.start_time,
        events.end_time,
        events.capacity,
        events.created_at,
        events.updated_at,
        users.id AS host_id,
        users.name AS host_name,
        users.privacy_contact AS host_privacy_contact,
        users.avatar_url AS host_avatar,
        (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = events.id) AS rsvp_count,
        EXISTS (SELECT 1 FROM rsvps r2 WHERE r2.event_id = events.id AND r2.user_id = ?) AS is_going
      FROM events
      JOIN users ON users.id = events.creator_id
      WHERE events.id = ?
      LIMIT 1`,
      [req.user.id, eventId]
    );

    return res.json({ event: rows[0] });
  } catch (err) {
    console.error('Failed to update event', err);
    return res.status(500).json({ error: 'Failed to update event' });
  }
});

router.get('/events/:id/messages', requireAuth, async (req, res) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const access = await ensureEventAccess(eventId, req.user.id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const [rows] = await db.execute(
      `SELECT
        event_messages.id,
        event_messages.message,
        event_messages.created_at,
        users.id AS user_id,
        users.name AS user_name,
        users.avatar_url AS user_avatar
      FROM event_messages
      JOIN users ON users.id = event_messages.user_id
      WHERE event_messages.event_id = ?
      ORDER BY event_messages.created_at ASC
      LIMIT 200`,
      [eventId]
    );

    return res.json({ messages: rows });
  } catch (err) {
    console.error('Failed to load event messages', err);
    return res.status(500).json({ error: 'Failed to load event messages' });
  }
});

router.post('/events/:id/messages', requireAuth, async (req, res) => {
  try {
    const eventId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }

    const access = await ensureEventAccess(eventId, req.user.id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    await db.execute(
      `INSERT INTO event_messages (event_id, user_id, message)
       VALUES (?, ?, ?)`,
      [eventId, req.user.id, message]
    );

    const [rows] = await db.execute(
      `SELECT
        event_messages.id,
        event_messages.message,
        event_messages.created_at,
        users.id AS user_id,
        users.name AS user_name,
        users.avatar_url AS user_avatar
      FROM event_messages
      JOIN users ON users.id = event_messages.user_id
      WHERE event_messages.event_id = ?
      ORDER BY event_messages.created_at DESC
      LIMIT 1`,
      [eventId]
    );

    return res.status(201).json({ message: rows[0] });
  } catch (err) {
    console.error('Failed to post event message', err);
    return res.status(500).json({ error: 'Failed to post event message' });
  }
});

module.exports = router;
