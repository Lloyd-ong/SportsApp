const https = require('https');
const db = require('../db');

let tableReady = false;
const TOPENDSPORTS_LIST_URLS = [
  'https://www.topendsports.com/sport/list/index.htm',
  'https://www.topendsports.com/sport/list.htm'
];

const normalizeSportName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const requestJson = (url) =>
  new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'PlayNet/1.0 (sports catalog verifier)'
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const status = res.statusCode || 500;
          if (status < 200 || status >= 300) {
            return reject(new Error(`HTTP ${status}`));
          }
          try {
            return resolve(JSON.parse(body));
          } catch (err) {
            return reject(new Error('Invalid JSON response'));
          }
        });
      }
    );

    req.setTimeout(7000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.on('error', reject);
  });

const requestText = (url) =>
  new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'PlayNet/1.0 (sports catalog verifier)'
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const status = res.statusCode || 500;
          if (status < 200 || status >= 300) {
            return reject(new Error(`HTTP ${status}`));
          }
          return resolve(body);
        });
      }
    );

    req.setTimeout(7000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.on('error', reject);
  });

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toPlainText = (html = '') =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

async function ensureSportsCatalogTable() {
  if (tableReady) {
    return;
  }
  await db.execute(
    `CREATE TABLE IF NOT EXISTS sports_catalog (
      id SERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      normalized_name VARCHAR(80) NOT NULL UNIQUE,
      verified BOOLEAN NOT NULL DEFAULT TRUE,
      source VARCHAR(40) NOT NULL DEFAULT 'wikipedia',
      evidence TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_sports_catalog_normalized ON sports_catalog(normalized_name)'
  );
  tableReady = true;
}

async function verifySportOnTopEndSports(sport) {
  const sportLower = String(sport || '').toLowerCase();
  if (!sportLower) {
    return { verified: false, source: 'topendsports', evidence: '' };
  }

  const candidates = Array.from(
    new Set([
      sportLower,
      sportLower.replace(/-/g, ' '),
      sportLower.replace(/\s+/g, '-')
    ])
  ).filter(Boolean);

  for (const url of TOPENDSPORTS_LIST_URLS) {
    try {
      const html = await requestText(url);
      const text = toPlainText(html).toLowerCase();
      for (const candidate of candidates) {
        const pattern = new RegExp(`\\b${escapeRegex(candidate)}\\b`, 'i');
        if (pattern.test(text)) {
          return {
            verified: true,
            source: 'topendsports',
            evidence: `Matched "${candidate}" on ${url}`
          };
        }
      }
    } catch (err) {
      continue;
    }
  }

  return { verified: false, source: 'topendsports', evidence: '' };
}

async function verifySportOnWikipedia(sport) {
  const query = encodeURIComponent(`${sport} sport`);
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=5&utf8=1&srsearch=${query}`;
  const payload = await requestJson(url);
  const items = payload?.query?.search || [];
  if (!items.length) {
    return { verified: false, source: 'wikipedia', evidence: '' };
  }

  const keywords = [
    'sport',
    'team sport',
    'combat sport',
    'racket sport',
    'athlete',
    'competition',
    'game'
  ];

  for (const item of items) {
    const title = String(item.title || '').toLowerCase();
    const snippet = String(item.snippet || '')
      .replace(/<[^>]*>/g, ' ')
      .toLowerCase();
    const haystack = `${title} ${snippet}`;
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return {
        verified: true,
        source: 'wikipedia',
        evidence: `${item.title || sport}: ${snippet}`.slice(0, 500)
      };
    }
  }

  return { verified: false, source: 'wikipedia', evidence: '' };
}

async function verifySportOnWeb(sport) {
  const topEndSportsCheck = await verifySportOnTopEndSports(sport);
  if (topEndSportsCheck.verified) {
    return topEndSportsCheck;
  }
  return verifySportOnWikipedia(sport);
}

async function registerSportIfVerified(rawSport) {
  const sport = normalizeSportName(rawSport);
  if (!sport) {
    return { ok: false, reason: 'empty' };
  }

  await ensureSportsCatalogTable();
  const normalized = sport.toLowerCase();

  const [existing] = await db.execute(
    'SELECT id, verified FROM sports_catalog WHERE normalized_name = ? LIMIT 1',
    [normalized]
  );
  if (existing.length) {
    return { ok: true, added: false, verified: Boolean(existing[0].verified) };
  }

  const check = await verifySportOnWeb(sport);
  if (!check.verified) {
    return { ok: false, reason: 'not_verified' };
  }

  await db.execute(
    `INSERT INTO sports_catalog (name, normalized_name, verified, source, evidence)
     VALUES (?, ?, TRUE, ?, ?)
     ON CONFLICT (normalized_name) DO NOTHING`,
    [sport, normalized, check.source, check.evidence || null]
  );

  return { ok: true, added: true, verified: true };
}

module.exports = {
  ensureSportsCatalogTable,
  registerSportIfVerified
};
