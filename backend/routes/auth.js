const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { isResetMailerConfigured, sendPasswordResetEmail } = require('../utils/mailer');
const {
  TOKEN_COOKIE_NAME,
  createAuthToken,
  getAuthCookieOptions
} = require('../utils/authToken');

const router = express.Router();
let googleEnabled = false;

const setAuthCookie = (res, userId) => {
  const token = createAuthToken(userId);
  res.cookie(TOKEN_COOKIE_NAME, token, getAuthCookieOptions());
};

function initAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL;

  googleEnabled = Boolean(clientId && clientSecret && callbackURL);

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const [rows] = await db.execute(
        'SELECT id, name, email, avatar_url, interests, location, bio, language, timezone, instagram, twitter, facebook, linkedin, privacy_profile, privacy_contact, role FROM users WHERE id = ?',
        [id]
      );
      if (!rows.length) {
        return done(null, false);
      }
      return done(null, rows[0]);
    } catch (err) {
      return done(err);
    }
  });

  if (googleEnabled) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: clientId,
          clientSecret: clientSecret,
          callbackURL: callbackURL
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
            const name = profile.displayName || 'Unnamed user';
            const googleId = profile.id;

            const [rows] = await db.execute('SELECT id FROM users WHERE google_id = ?', [googleId]);
            let userId;

            if (rows.length) {
              userId = rows[0].id;
              if (email) {
                await db.execute(
                  'UPDATE users SET name = ?, email = ?, avatar_url = ? WHERE id = ?',
                  [name, email, avatar, userId]
                );
              } else {
                await db.execute(
                  'UPDATE users SET name = ?, avatar_url = ? WHERE id = ?',
                  [name, avatar, userId]
                );
              }
            } else if (email) {
              const [emailRows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
              if (emailRows.length) {
                userId = emailRows[0].id;
                await db.execute(
                  'UPDATE users SET google_id = ?, name = ?, avatar_url = ? WHERE id = ?',
                  [googleId, name, avatar, userId]
                );
              } else {
                const [result] = await db.execute(
                  'INSERT INTO users (google_id, name, email, avatar_url) VALUES (?, ?, ?, ?) RETURNING id',
                  [googleId, name, email, avatar]
                );
                userId = result.insertId;
              }
            } else {
              const [result] = await db.execute(
                'INSERT INTO users (google_id, name, email, avatar_url) VALUES (?, ?, ?, ?) RETURNING id',
                [googleId, name, email, avatar]
              );
              userId = result.insertId;
            }

            const [userRows] = await db.execute(
              'SELECT id, name, email, avatar_url, interests, location, bio, language, timezone, instagram, twitter, facebook, linkedin, privacy_profile, privacy_contact, role FROM users WHERE id = ?',
              [userId]
            );
            return done(null, userRows[0]);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

  return googleEnabled;
}

router.get('/google', (req, res, next) => {
  if (!googleEnabled) {
    return res.status(501).json({ error: 'Google OAuth is not configured' });
  }
  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!googleEnabled) {
    return res.status(501).json({ error: 'Google OAuth is not configured' });
  }
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  return passport.authenticate(
    'google',
    {
      failureRedirect: `${clientOrigin}/?auth=failed`,
      session: false
    },
    (err, user) => {
      if (err || !user) {
        return res.redirect(`${clientOrigin}/?auth=failed`);
      }
      setAuthCookie(res, user.id);
      return res.redirect(clientOrigin);
    }
  )(req, res, next);
});

router.post('/register', async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const pepper = process.env.PASSWORD_PEPPER || '';
    const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS, 10);
    const rounds = Number.isInteger(saltRounds) && saltRounds > 0 ? saltRounds : 10;
    const passwordHash = await bcrypt.hash(`${password}${pepper}`, rounds);
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id',
      [name, email, passwordHash]
    );

    const [userRows] = await db.execute(
      'SELECT id, name, email, avatar_url, interests, location, bio, language, timezone, instagram, twitter, facebook, linkedin, privacy_profile, privacy_contact, role FROM users WHERE id = ?',
      [result.insertId]
    );
    const user = userRows[0];

    setAuthCookie(res, user.id);
    return res.status(201).json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await db.execute(
      'SELECT id, name, email, avatar_url, interests, location, bio, language, timezone, instagram, twitter, facebook, linkedin, privacy_profile, privacy_contact, role, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows.length || !rows[0].password_hash) {
      console.warn('Login failed: user missing or no password hash', {
        email,
        hasUser: Boolean(rows.length),
        hasHash: Boolean(rows[0] && rows[0].password_hash)
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const pepper = process.env.PASSWORD_PEPPER || '';
    const isValid = await bcrypt.compare(`${password}${pepper}`, rows[0].password_hash);
    console.warn('Login compare result', {
      email,
      userId: rows[0].id,
      pepperLength: pepper.length,
      passwordLength: password.length,
      hashPrefix: rows[0].password_hash ? rows[0].password_hash.slice(0, 7) : null,
      isValid
    });
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      avatar_url: rows[0].avatar_url,
      interests: rows[0].interests,
      location: rows[0].location,
      bio: rows[0].bio,
      language: rows[0].language,
      timezone: rows[0].timezone,
      instagram: rows[0].instagram,
      twitter: rows[0].twitter,
      facebook: rows[0].facebook,
      linkedin: rows[0].linkedin,
      privacy_profile: rows[0].privacy_profile,
      privacy_contact: rows[0].privacy_contact,
      role: rows[0].role
    };

    setAuthCookie(res, user.id);
    return res.json({ user });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ error: 'Failed to sign in' });
  }
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null, googleEnabled });
});

router.patch('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const avatarUrl = typeof req.body.avatar_url === 'string' ? req.body.avatar_url.trim() : '';
    const interests = typeof req.body.interests === 'string' ? req.body.interests.trim() : '';
    const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
    const bio = typeof req.body.bio === 'string' ? req.body.bio.trim() : '';
    const language = typeof req.body.language === 'string' ? req.body.language.trim() : '';
    const timezone = typeof req.body.timezone === 'string' ? req.body.timezone.trim() : '';
    const instagram = typeof req.body.instagram === 'string' ? req.body.instagram.trim() : '';
    const twitter = typeof req.body.twitter === 'string' ? req.body.twitter.trim() : '';
    const facebook = typeof req.body.facebook === 'string' ? req.body.facebook.trim() : '';
    const linkedin = typeof req.body.linkedin === 'string' ? req.body.linkedin.trim() : '';
    const privacyProfile = req.body.privacy_profile === 'private' ? 'private' : 'public';
    const privacyContact = ['everyone', 'members', 'no_one'].includes(req.body.privacy_contact)
      ? req.body.privacy_contact
      : 'members';
    const currentPassword = typeof req.body.current_password === 'string' ? req.body.current_password : '';
    const newPassword = typeof req.body.new_password === 'string' ? req.body.new_password : '';
    const confirmPassword = typeof req.body.confirm_password === 'string' ? req.body.confirm_password : '';

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    if (email !== req.user.email) {
      const [existing] = await db.execute('SELECT id FROM users WHERE email = ? AND id <> ?', [
        email,
        req.user.id
      ]);
      if (existing.length) {
        return res.status(409).json({ error: 'Email is already registered' });
      }
    }

    let passwordHash = null;
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'Current password, new password, and confirmation are required' });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New passwords do not match' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const pepper = process.env.PASSWORD_PEPPER || '';
      const [rows] = await db.execute(
        'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
        [req.user.id]
      );
      if (!rows.length || !rows[0].password_hash) {
        return res.status(400).json({ error: 'Password change is not available for this account' });
      }
      const isValid = await bcrypt.compare(`${currentPassword}${pepper}`, rows[0].password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS, 10);
      const rounds = Number.isInteger(saltRounds) && saltRounds > 0 ? saltRounds : 10;
      passwordHash = await bcrypt.hash(`${newPassword}${pepper}`, rounds);
    }

    await db.execute(
      `UPDATE users
       SET name = ?, email = ?, avatar_url = ?, interests = ?, location = ?, bio = ?, language = ?, timezone = ?,
           instagram = ?, twitter = ?, facebook = ?, linkedin = ?, privacy_profile = ?, privacy_contact = ?
           ${passwordHash ? ', password_hash = ?' : ''}
       WHERE id = ?`,
      [
        name,
        email,
        avatarUrl || null,
        interests || null,
        location || null,
        bio || null,
        language || null,
        timezone || null,
        instagram || null,
        twitter || null,
        facebook || null,
        linkedin || null,
        privacyProfile,
        privacyContact,
        ...(passwordHash ? [passwordHash] : []),
        req.user.id
      ]
    );

    const [userRows] = await db.execute(
      'SELECT id, name, email, avatar_url, interests, location, bio, language, timezone, instagram, twitter, facebook, linkedin, privacy_profile, privacy_contact, role FROM users WHERE id = ?',
      [req.user.id]
    );

    return res.json({ user: userRows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/forgot', async (req, res) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const hasMailer = isResetMailerConfigured();
    if (isProd && !hasMailer) {
      return res.status(503).json({ error: 'Password reset email service is not configured' });
    }

    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [users] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (!users.length) {
      return res.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.execute(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [users[0].id, tokenHash, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset?token=${token}`;

    if (hasMailer) {
      await sendPasswordResetEmail({ to: email, resetLink });
    }

    if (!isProd) {
      return res.json({ ok: true, resetLink, emailSent: hasMailer });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to start password reset', err);
    return res.status(500).json({ error: 'Failed to start password reset' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const newPassword = typeof req.body.new_password === 'string' ? req.body.new_password : '';
    const confirmPassword = typeof req.body.confirm_password === 'string' ? req.body.confirm_password : '';

    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await db.execute(
      'SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1',
      [tokenHash]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Reset link is invalid or expired' });
    }

    const resetRow = rows[0];
    if (resetRow.used_at) {
      return res.status(400).json({ error: 'Reset link has already been used' });
    }
    if (new Date(resetRow.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Reset link has expired' });
    }

    const pepper = process.env.PASSWORD_PEPPER || '';
    const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS, 10);
    const rounds = Number.isInteger(saltRounds) && saltRounds > 0 ? saltRounds : 10;
    const passwordHash = await bcrypt.hash(`${newPassword}${pepper}`, rounds);

    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, resetRow.user_id]);
    await db.execute('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [resetRow.id]);

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.post('/logout', (req, res) => {
  const clearAndRespond = () => {
    res.clearCookie('connect.sid', { path: '/' });
    res.clearCookie(TOKEN_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  };

  const destroySession = () => {
    if (req.session && typeof req.session.destroy === 'function') {
      req.session.destroy(() => {
        clearAndRespond();
      });
      return;
    }
    clearAndRespond();
  };

  if (typeof req.logout === 'function') {
    req.logout(() => {
      destroySession();
    });
    return;
  }

  destroySession();
});

module.exports = { router, initAuth };
