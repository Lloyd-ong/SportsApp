const db = require('../db');
const {
  TOKEN_COOKIE_NAME,
  parseCookieHeader,
  verifyAuthToken
} = require('../utils/authToken');

const USER_FIELDS = `
  id,
  name,
  email,
  avatar_url,
  interests,
  location,
  bio,
  language,
  timezone,
  instagram,
  twitter,
  facebook,
  linkedin,
  privacy_profile,
  privacy_contact,
  role
`;

module.exports = async function optionalAuth(req, res, next) {
  try {
    if (req.user) {
      return next();
    }

    const cookies = parseCookieHeader(req.headers.cookie || '');
    const token = cookies[TOKEN_COOKIE_NAME];
    if (!token) {
      return next();
    }

    const payload = verifyAuthToken(token);
    if (!payload || !payload.uid) {
      return next();
    }

    const [rows] = await db.execute(
      `SELECT ${USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [payload.uid]
    );

    if (!rows.length) {
      return next();
    }

    req.user = rows[0];
    req.authMethod = 'token';
    req.isAuthenticated = () => true;
    return next();
  } catch (err) {
    console.warn('Optional token auth failed', err.message);
    return next();
  }
};
