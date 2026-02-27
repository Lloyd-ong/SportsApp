const db = require('../db');

const INTERESTS_MAX_LENGTH = 255;

function parseInterests(rawInterests) {
  if (typeof rawInterests !== 'string' || !rawInterests.trim()) {
    return [];
  }
  return rawInterests
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeInterest(rawInterests, interest) {
  const cleanInterest = typeof interest === 'string' ? interest.trim() : '';
  if (!cleanInterest) {
    return typeof rawInterests === 'string' ? rawInterests.trim() : '';
  }

  const values = parseInterests(rawInterests);
  const existing = new Set(values.map((item) => item.toLowerCase()));
  if (existing.has(cleanInterest.toLowerCase())) {
    return values.join(', ');
  }

  const next = [...values, cleanInterest].join(', ');
  if (next.length > INTERESTS_MAX_LENGTH) {
    return values.join(', ');
  }
  return next;
}

async function appendUserInterest(userId, interest) {
  if (!userId) {
    return { updated: false };
  }

  const [users] = await db.execute('SELECT interests FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!users.length) {
    return { updated: false };
  }

  const currentInterests = users[0].interests || '';
  const nextInterests = mergeInterest(currentInterests, interest);
  if (nextInterests === currentInterests) {
    return { updated: false };
  }

  await db.execute('UPDATE users SET interests = ? WHERE id = ?', [nextInterests || null, userId]);
  return { updated: true };
}

module.exports = {
  appendUserInterest
};

