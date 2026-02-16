const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/communities', async (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 12, 50);
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 12;
    const userId = req.user ? req.user.id : null;
    const userEmail = req.user ? req.user.email : null;
    const params = userId ? [userId, userId, userId] : [];
    if (userId && userEmail) {
      params.push(userEmail);
    }
    const inviteSelect = userId && userEmail
      ? ", (SELECT ci.id FROM community_invites ci WHERE ci.community_id = communities.id AND ci.email = ? AND ci.status = 'pending' LIMIT 1) AS invite_id"
      : ', NULL AS invite_id';
    const [rows] = await db.execute(
      `SELECT
        communities.id,
        communities.name,
        communities.description,
        communities.sport,
        communities.region,
        communities.image_url,
        communities.max_members,
        communities.visibility,
        communities.created_at,
        users.id AS creator_id,
        users.name AS creator_name,
        users.privacy_contact AS creator_privacy_contact,
        (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = communities.id) AS member_count,
        ${userId ? "EXISTS (SELECT 1 FROM community_members cm2 WHERE cm2.community_id = communities.id AND cm2.user_id = ? AND cm2.status = 'approved') AS is_member" : '0 AS is_member'},
        ${userId ? "EXISTS (SELECT 1 FROM community_members cm3 WHERE cm3.community_id = communities.id AND cm3.user_id = ? AND cm3.role = 'owner') AS is_owner" : '0 AS is_owner'},
        ${userId ? "COALESCE((SELECT cm4.status FROM community_members cm4 WHERE cm4.community_id = communities.id AND cm4.user_id = ? LIMIT 1), 'none') AS membership_status" : "'none' AS membership_status"}
        ${inviteSelect}
      FROM communities
      JOIN users ON users.id = communities.creator_id
      ORDER BY communities.created_at DESC
      LIMIT ${safeLimit}`,
      params
    );
    res.json({ communities: rows });
  } catch (err) {
    console.error('Failed to load communities', err);
    res.status(500).json({ error: 'Failed to load communities' });
  }
});

router.get('/communities/:id', async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(communityId)) {
      return res.status(400).json({ error: 'Invalid community id' });
    }

    const userId = req.user ? req.user.id : null;
    const userEmail = req.user ? req.user.email : null;
    const params = [];
    const isMemberSelect = userId
      ? "EXISTS (SELECT 1 FROM community_members cm2 WHERE cm2.community_id = communities.id AND cm2.user_id = ? AND cm2.status = 'approved') AS is_member"
      : '0 AS is_member';
    const isOwnerSelect = userId
      ? "EXISTS (SELECT 1 FROM community_members cm3 WHERE cm3.community_id = communities.id AND cm3.user_id = ? AND cm3.role = 'owner') AS is_owner"
      : '0 AS is_owner';
    const statusSelect = userId
      ? "COALESCE((SELECT cm4.status FROM community_members cm4 WHERE cm4.community_id = communities.id AND cm4.user_id = ? LIMIT 1), 'none') AS membership_status"
      : "'none' AS membership_status";

    if (userId) {
      params.push(userId, userId, userId);
      if (userEmail) {
        params.push(userEmail);
      }
    }

    params.push(communityId);

    const inviteSelect = userId && userEmail
      ? ", (SELECT ci.id FROM community_invites ci WHERE ci.community_id = communities.id AND ci.email = ? AND ci.status = 'pending' LIMIT 1) AS invite_id"
      : ', NULL AS invite_id';

    const [rows] = await db.execute(
      `SELECT
        communities.id,
        communities.name,
        communities.description,
        communities.sport,
        communities.region,
        communities.image_url,
        communities.max_members,
        communities.visibility,
        communities.created_at,
        users.id AS creator_id,
        users.name AS creator_name,
        users.privacy_contact AS creator_privacy_contact,
        (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = communities.id) AS member_count,
        ${isMemberSelect},
        ${isOwnerSelect},
        ${statusSelect}
        ${inviteSelect}
      FROM communities
      JOIN users ON users.id = communities.creator_id
      WHERE communities.id = ?
      LIMIT 1`,
      params
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Community not found' });
    }

    return res.json({ community: rows[0] });
  } catch (err) {
    console.error('Failed to load community', err);
    return res.status(500).json({ error: 'Failed to load community' });
  }
});

router.post('/communities', requireAuth, async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const sport = typeof req.body.sport === 'string' ? req.body.sport.trim() : '';
    const region = typeof req.body.region === 'string' ? req.body.region.trim() : '';
    let imageUrl = typeof req.body.image_url === 'string' ? req.body.image_url.trim() : '';
    let maxMembers = Number.parseInt(req.body.max_members, 10);
    if (!Number.isInteger(maxMembers) || maxMembers < 1) {
      maxMembers = null;
    }
    const visibility = req.body.visibility === 'private'
      ? 'private'
      : req.body.visibility === 'invite'
        ? 'invite'
        : 'public';

    if (!name) {
      return res.status(400).json({ error: 'Community name is required' });
    }

    const [result] = await db.execute(
      `INSERT INTO communities (creator_id, name, description, sport, region, image_url, max_members, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        req.user.id,
        name,
        description || null,
        sport || null,
        region || null,
        imageUrl || null,
        maxMembers,
        visibility
      ]
    );

    await db.execute(
      'INSERT INTO community_members (community_id, user_id, role, status, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [result.insertId, req.user.id, 'owner', 'approved', req.user.id]
    );

    const [rows] = await db.execute(
      `SELECT
        communities.id,
        communities.name,
        communities.description,
        communities.sport,
        communities.region,
        communities.image_url,
        communities.max_members,
        communities.visibility,
        communities.created_at,
        users.id AS creator_id,
        users.name AS creator_name,
        users.privacy_contact AS creator_privacy_contact,
        (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = communities.id) AS member_count,
        1 AS is_member,
        1 AS is_owner,
        'approved' AS membership_status
      FROM communities
      JOIN users ON users.id = communities.creator_id
      WHERE communities.id = ?
      LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({ community: rows[0] });
  } catch (err) {
    console.error('Failed to create community', err);
    return res.status(500).json({ error: 'Failed to create community' });
  }
});

router.get('/communities/:id/messages', async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(communityId)) {
      return res.status(400).json({ error: 'Invalid community id' });
    }

    if (req.user) {
      const [members] = await db.execute(
        "SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND status = 'approved' LIMIT 1",
        [communityId, req.user.id]
      );
      if (!members.length) {
        return res.status(403).json({ error: 'Join the community to view messages' });
      }
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [rows] = await db.execute(
      `SELECT
        community_messages.id,
        community_messages.message,
        community_messages.created_at,
        users.id AS user_id,
        users.name AS user_name,
        users.avatar_url AS user_avatar
      FROM community_messages
      JOIN users ON users.id = community_messages.user_id
      WHERE community_messages.community_id = ?
      ORDER BY community_messages.created_at ASC
      LIMIT 200`,
      [communityId]
    );

    return res.json({ messages: rows });
  } catch (err) {
    console.error('Failed to load community messages', err);
    return res.status(500).json({ error: 'Failed to load community messages' });
  }
});

router.post('/communities/:id/messages', requireAuth, async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(communityId)) {
      return res.status(400).json({ error: 'Invalid community id' });
    }

    const [members] = await db.execute(
      "SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND status = 'approved' LIMIT 1",
      [communityId, req.user.id]
    );
    if (!members.length) {
      return res.status(403).json({ error: 'Join the community to post messages' });
    }

    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    await db.execute(
      `INSERT INTO community_messages (community_id, user_id, message)
       VALUES (?, ?, ?)`,
      [communityId, req.user.id, message]
    );

    const [rows] = await db.execute(
      `SELECT
        community_messages.id,
        community_messages.message,
        community_messages.created_at,
        users.id AS user_id,
        users.name AS user_name,
        users.avatar_url AS user_avatar
      FROM community_messages
      JOIN users ON users.id = community_messages.user_id
      WHERE community_messages.community_id = ?
      ORDER BY community_messages.created_at DESC
      LIMIT 1`,
      [communityId]
    );

    return res.status(201).json({ message: rows[0] });
  } catch (err) {
    console.error('Failed to post community message', err);
    return res.status(500).json({ error: 'Failed to post community message' });
  }
});

router.post('/communities/:id/join', requireAuth, async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(communityId)) {
      return res.status(400).json({ error: 'Invalid community id' });
    }

    const [communities] = await db.execute(
      'SELECT id, visibility, creator_id, max_members FROM communities WHERE id = ?',
      [communityId]
    );
    if (!communities.length) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const visibility = communities[0].visibility || 'public';
    const autoApprove = visibility !== 'private' && visibility !== 'invite';
    if (visibility === 'invite') {
      const [invites] = await db.execute(
        "SELECT id FROM community_invites WHERE community_id = ? AND email = ? AND status = 'pending' LIMIT 1",
        [communityId, req.user.email]
      );
      if (!invites.length) {
        return res.status(403).json({ error: 'Invitation required to join this community' });
      }
    }
    if (communities[0].max_members) {
      const [[countRow]] = await db.execute(
        "SELECT COUNT(*) AS count FROM community_members WHERE community_id = ? AND status = 'approved'",
        [communityId]
      );
      if (countRow.count >= communities[0].max_members) {
        return res.status(409).json({ error: 'Community is full' });
      }
    }

    try {
      await db.execute(
        `INSERT INTO community_members (community_id, user_id, role, status, approved_by, approved_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          communityId,
          req.user.id,
          'member',
          autoApprove ? 'approved' : 'pending',
          autoApprove ? req.user.id : null,
          autoApprove ? new Date() : null
        ]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') {
        return res.status(200).json({ ok: true, alreadyMember: true });
      }
      throw err;
    }

    return res.status(201).json({ ok: true, status: autoApprove ? 'approved' : 'pending' });
  } catch (err) {
    console.error('Failed to join community', err);
    return res.status(500).json({ error: 'Failed to join community' });
  }
});

router.post('/communities/:id/invites', requireAuth, async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(communityId)) {
      return res.status(400).json({ error: 'Invalid community id' });
    }

    const [owners] = await db.execute(
      "SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND role = 'owner' LIMIT 1",
      [communityId, req.user.id]
    );
    if (!owners.length) {
      return res.status(403).json({ error: 'Only the owner can invite members' });
    }

    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [users] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const invitedUserId = users.length ? users[0].id : null;

    await db.execute(
      `INSERT INTO community_invites (community_id, email, invited_user_id, invited_by, status)
       VALUES (?, ?, ?, ?, 'pending')
       ON CONFLICT (community_id, email)
       DO UPDATE SET
         status = 'pending',
         invited_user_id = EXCLUDED.invited_user_id`,
      [communityId, email, invitedUserId, req.user.id]
    );

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Failed to invite member', err);
    return res.status(500).json({ error: 'Failed to invite member' });
  }
});

router.get('/communities/:id/invites', requireAuth, async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(communityId)) {
      return res.status(400).json({ error: 'Invalid community id' });
    }

    const [owners] = await db.execute(
      "SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ? AND role = 'owner' LIMIT 1",
      [communityId, req.user.id]
    );
    if (!owners.length) {
      return res.status(403).json({ error: 'Only the owner can view invites' });
    }

    const [rows] = await db.execute(
      `SELECT id, email, status, created_at
       FROM community_invites
       WHERE community_id = ?
       ORDER BY created_at DESC`,
      [communityId]
    );

    return res.json({ invites: rows });
  } catch (err) {
    console.error('Failed to load invites', err);
    return res.status(500).json({ error: 'Failed to load invites' });
  }
});

router.post('/invites/:id/accept', requireAuth, async (req, res) => {
  try {
    const inviteId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(inviteId)) {
      return res.status(400).json({ error: 'Invalid invite id' });
    }

    const [invites] = await db.execute(
      "SELECT id, community_id, email FROM community_invites WHERE id = ? AND status = 'pending' LIMIT 1",
      [inviteId]
    );
    if (!invites.length) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invites[0].email !== req.user.email) {
      return res.status(403).json({ error: 'Invite does not match your account' });
    }

    await db.execute(
      "UPDATE community_invites SET status = 'accepted', invited_user_id = ? WHERE id = ?",
      [req.user.id, inviteId]
    );

    await db.execute(
      `INSERT INTO community_members (community_id, user_id, role, status, approved_by, approved_at)
       VALUES (?, ?, 'member', 'approved', ?, NOW())
       ON CONFLICT (community_id, user_id)
       DO UPDATE SET status = 'approved'`,
      [invites[0].community_id, req.user.id, req.user.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to accept invite', err);
    return res.status(500).json({ error: 'Failed to accept invite' });
  }
});

router.post('/invites/:id/decline', requireAuth, async (req, res) => {
  try {
    const inviteId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(inviteId)) {
      return res.status(400).json({ error: 'Invalid invite id' });
    }

    const [invites] = await db.execute(
      "SELECT id, email FROM community_invites WHERE id = ? AND status = 'pending' LIMIT 1",
      [inviteId]
    );
    if (!invites.length) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invites[0].email !== req.user.email) {
      return res.status(403).json({ error: 'Invite does not match your account' });
    }

    await db.execute("UPDATE community_invites SET status = 'declined' WHERE id = ?", [inviteId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to decline invite', err);
    return res.status(500).json({ error: 'Failed to decline invite' });
  }
});

router.delete('/communities/:id/join', requireAuth, async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(communityId)) {
      return res.status(400).json({ error: 'Invalid community id' });
    }

    await db.execute(
      'DELETE FROM community_members WHERE community_id = ? AND user_id = ?',
      [communityId, req.user.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to leave community', err);
    return res.status(500).json({ error: 'Failed to leave community' });
  }
});

router.patch('/communities/:id', requireAuth, async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(communityId)) {
      return res.status(400).json({ error: 'Invalid community id' });
    }

    const [communities] = await db.execute(
      'SELECT * FROM communities WHERE id = ?',
      [communityId]
    );
    if (!communities.length) {
      return res.status(404).json({ error: 'Community not found' });
    }
    if (communities[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the owner can edit this community' });
    }

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : communities[0].name;
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : communities[0].description;
    const sport = typeof req.body.sport === 'string' ? req.body.sport.trim() : communities[0].sport;
    const region = typeof req.body.region === 'string' ? req.body.region.trim() : communities[0].region;
    let imageUrl = typeof req.body.image_url === 'string' ? req.body.image_url.trim() : communities[0].image_url;
    const visibility = req.body.visibility === 'private'
      ? 'private'
      : req.body.visibility === 'invite'
        ? 'invite'
        : 'public';

    let maxMembers = Number.parseInt(req.body.max_members, 10);
    if (!Number.isInteger(maxMembers) || maxMembers < 1) {
      maxMembers = communities[0].max_members || null;
    }

    if (!name) {
      return res.status(400).json({ error: 'Community name is required' });
    }

    await db.execute(
      `UPDATE communities
       SET name = ?, description = ?, sport = ?, region = ?, image_url = ?, max_members = ?, visibility = ?
       WHERE id = ?`,
      [
        name,
        description || null,
        sport || null,
        region || null,
        imageUrl || null,
        maxMembers,
        visibility,
        communityId
      ]
    );

    const [rows] = await db.execute(
      `SELECT
        communities.id,
        communities.name,
        communities.description,
        communities.sport,
        communities.region,
        communities.image_url,
        communities.max_members,
        communities.visibility,
        communities.created_at,
        users.id AS creator_id,
        users.name AS creator_name,
        users.privacy_contact AS creator_privacy_contact,
        (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = communities.id) AS member_count,
        1 AS is_member,
        1 AS is_owner,
        'approved' AS membership_status
      FROM communities
      JOIN users ON users.id = communities.creator_id
      WHERE communities.id = ?
      LIMIT 1`,
      [communityId]
    );

    return res.json({ community: rows[0] });
  } catch (err) {
    console.error('Failed to update community', err);
    return res.status(500).json({ error: 'Failed to update community' });
  }
});

router.get('/communities/:id/requests', requireAuth, async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(communityId)) {
      return res.status(400).json({ error: 'Invalid community id' });
    }

    const [communities] = await db.execute(
      'SELECT id, creator_id FROM communities WHERE id = ?',
      [communityId]
    );
    if (!communities.length) {
      return res.status(404).json({ error: 'Community not found' });
    }
    if (communities[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Owner access required' });
    }

    const [rows] = await db.execute(
      `SELECT
        community_members.user_id,
        users.name AS user_name,
        users.email AS user_email,
        community_members.created_at
      FROM community_members
      JOIN users ON users.id = community_members.user_id
      WHERE community_members.community_id = ?
        AND community_members.status = 'pending'
      ORDER BY community_members.created_at ASC`,
      [communityId]
    );

    return res.json({ requests: rows });
  } catch (err) {
    console.error('Failed to load join requests', err);
    return res.status(500).json({ error: 'Failed to load join requests' });
  }
});

router.post('/communities/:id/requests/:userId/approve', requireAuth, async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    const userId = Number.parseInt(req.params.userId, 10);
    if (!Number.isInteger(communityId) || !Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const [communities] = await db.execute(
      'SELECT id, creator_id FROM communities WHERE id = ?',
      [communityId]
    );
    if (!communities.length) {
      return res.status(404).json({ error: 'Community not found' });
    }
    if (communities[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Owner access required' });
    }

    await db.execute(
      `UPDATE community_members
       SET status = 'approved', approved_by = ?, approved_at = NOW()
       WHERE community_id = ? AND user_id = ? AND status = 'pending'`,
      [req.user.id, communityId, userId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to approve request', err);
    return res.status(500).json({ error: 'Failed to approve request' });
  }
});

router.post('/communities/:id/requests/:userId/reject', requireAuth, async (req, res) => {
  try {
    const communityId = Number.parseInt(req.params.id, 10);
    const userId = Number.parseInt(req.params.userId, 10);
    if (!Number.isInteger(communityId) || !Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const [communities] = await db.execute(
      'SELECT id, creator_id FROM communities WHERE id = ?',
      [communityId]
    );
    if (!communities.length) {
      return res.status(404).json({ error: 'Community not found' });
    }
    if (communities[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Owner access required' });
    }

    await db.execute(
      `DELETE FROM community_members
       WHERE community_id = ? AND user_id = ? AND status = 'pending'`,
      [communityId, userId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to reject request', err);
    return res.status(500).json({ error: 'Failed to reject request' });
  }
});

module.exports = router;
