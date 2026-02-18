const crypto = require('crypto');

const TOKEN_COOKIE_NAME = 'auth_token';
const DEFAULT_TTL_DAYS = 30;

function getTokenSecret() {
  return process.env.AUTH_TOKEN_SECRET || process.env.SESSION_SECRET || 'dev_secret';
}

function getTokenMaxAgeMs() {
  const ttlDays = Number.parseInt(process.env.AUTH_TOKEN_TTL_DAYS, 10);
  const safeDays = Number.isInteger(ttlDays) && ttlDays > 0 ? ttlDays : DEFAULT_TTL_DAYS;
  return safeDays * 24 * 60 * 60 * 1000;
}

function getAuthCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    path: '/',
    maxAge: getTokenMaxAgeMs()
  };
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function createSignature(payloadBase64) {
  return crypto
    .createHmac('sha256', getTokenSecret())
    .update(payloadBase64)
    .digest('base64url');
}

function createAuthToken(userId) {
  const exp = Date.now() + getTokenMaxAgeMs();
  const payload = base64Url(JSON.stringify({ uid: Number(userId), exp }));
  const signature = createSignature(payload);
  return `${payload}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }
  const expectedSignature = createSignature(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const incomingBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== incomingBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(expectedBuffer, incomingBuffer)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded || !decoded.uid || !decoded.exp) {
      return null;
    }
    if (Number(decoded.exp) < Date.now()) {
      return null;
    }
    return { uid: Number(decoded.uid), exp: Number(decoded.exp) };
  } catch (err) {
    return null;
  }
}

function parseCookieHeader(rawCookieHeader = '') {
  return rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return acc;
      }
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

module.exports = {
  TOKEN_COOKIE_NAME,
  createAuthToken,
  verifyAuthToken,
  getAuthCookieOptions,
  parseCookieHeader
};
