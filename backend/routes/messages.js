const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/messages/inbox', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
    const [rows] = await db.execute(
      `SELECT
        pm.id,
        pm.sender_id,
        pm.recipient_id,
        pm.message,
        pm.created_at,
        pm.read_at,
        users.name AS sender_name,
        users.avatar_url AS sender_avatar
      FROM private_messages pm
      JOIN users ON users.id = pm.sender_id
      WHERE pm.recipient_id = ?
      ORDER BY pm.created_at DESC
      LIMIT ${safeLimit}`,
      [req.user.id]
    );

    return res.json({ messages: rows });
  } catch (err) {
    console.error('Failed to load inbox messages', err);
    return res.status(500).json({ error: 'Failed to load messages.' });
  }
});

router.post('/messages', requireAuth, async (req, res) => {
  try {
    const recipientId = Number.parseInt(req.body.recipient_id, 10);
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

    if (!Number.isInteger(recipientId)) {
      return res.status(400).json({ error: 'Invalid recipient.' });
    }
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }
    if (recipientId === req.user.id) {
      return res.status(400).json({ error: 'You cannot message yourself.' });
    }

    const [recipients] = await db.execute(
      'SELECT id, privacy_contact FROM users WHERE id = ? LIMIT 1',
      [recipientId]
    );
    if (!recipients.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const privacy = recipients[0].privacy_contact || 'members';
    if (privacy === 'no_one') {
      return res.status(403).json({ error: 'This user does not accept messages.' });
    }

    if (privacy === 'members') {
      const [shared] = await db.execute(
        `SELECT 1
         FROM community_members cm1
         JOIN community_members cm2 ON cm1.community_id = cm2.community_id
         WHERE cm1.user_id = ?
           AND cm2.user_id = ?
           AND cm1.status = 'approved'
           AND cm2.status = 'approved'
         LIMIT 1`,
        [req.user.id, recipientId]
      );
      if (!shared.length) {
        return res.status(403).json({ error: 'Only shared community members can message this user.' });
      }
    }

    const [result] = await db.execute(
      'INSERT INTO private_messages (sender_id, recipient_id, message) VALUES (?, ?, ?) RETURNING id',
      [req.user.id, recipientId, message]
    );

    const [rows] = await db.execute(
      `SELECT id, sender_id, recipient_id, message, created_at
       FROM private_messages
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({ message: rows[0] });
  } catch (err) {
    console.error('Failed to send message', err);
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

module.exports = router;
