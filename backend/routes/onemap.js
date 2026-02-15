const express = require('express');

const router = express.Router();

router.get('/onemap/search', async (req, res, next) => {
  try {
    const query = (req.query.q || req.query.searchVal || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Missing search query.' });
    }

    const url = new URL('https://www.onemap.gov.sg/api/common/elastic/search');
    url.searchParams.set('searchVal', query);
    url.searchParams.set('returnGeom', 'Y');
    url.searchParams.set('getAddrDetails', 'Y');
    url.searchParams.set('pageNum', '1');

    const response = await fetch(url.toString());
    if (!response.ok) {
      return res.status(response.status).json({ error: 'OneMap search failed.' });
    }

    const payload = await response.json();
    res.json({ results: payload.results || [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
