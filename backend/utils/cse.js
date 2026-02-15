const https = require('https');
const { URL, URLSearchParams } = require('url');

const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY || '';
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || '';

const fetchJson = (url) => new Promise((resolve, reject) => {
  https
    .get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          try {
            const parsed = JSON.parse(data);
            const message =
              parsed?.error?.message ||
              parsed?.error?.errors?.[0]?.message ||
              data;
            return reject(new Error(`HTTP ${res.statusCode}: ${message}`));
          } catch (err) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
        try {
          return resolve(JSON.parse(data));
        } catch (err) {
          return reject(err);
        }
      });
    })
    .on('error', reject);
});

const getImageForQuery = async (query) => {
  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID || !query) {
    return null;
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.search = new URLSearchParams({
    key: GOOGLE_CSE_API_KEY,
    cx: GOOGLE_CSE_ID,
    q: query,
    searchType: 'image',
    safe: 'active',
    num: '1',
    imgType: 'photo',
    imgSize: 'large'
  }).toString();

  const data = await fetchJson(url);
  return data?.items?.[0]?.link || null;
};

module.exports = {
  GOOGLE_CSE_API_KEY,
  GOOGLE_CSE_ID,
  getImageForQuery
};
