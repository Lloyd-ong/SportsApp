const express = require('express');
const https = require('https');
const { URL, URLSearchParams } = require('url');
const { GOOGLE_API_KEY, getPlacePhotoData, buildPhotoProxyUrl } = require('../utils/places');

const router = express.Router();

const proxyImage = (url, res, depth = 0) => {
  if (depth > 3) {
    res.status(502).json({ error: 'Failed to fetch image' });
    return;
  }

  https
    .get(url, (upstream) => {
      const status = upstream.statusCode || 500;
      const redirect = status >= 300 && status < 400 && upstream.headers.location;
      if (redirect) {
        proxyImage(upstream.headers.location, res, depth + 1);
        return;
      }
      if (status < 200 || status >= 300) {
        res.status(502).json({ error: 'Failed to fetch image' });
        return;
      }
      res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      upstream.pipe(res);
    })
    .on('error', () => {
      res.status(502).json({ error: 'Failed to fetch image' });
    });
};

router.get('/places/photo', (req, res) => {
  const ref = typeof req.query.ref === 'string' ? req.query.ref.trim() : '';
  const maxwidth = Number.parseInt(req.query.maxwidth, 10);
  const width = Number.isInteger(maxwidth) && maxwidth > 0 ? maxwidth : 1200;

  if (!ref) {
    return res.status(400).json({ error: 'Photo reference is required' });
  }
  if (!GOOGLE_API_KEY) {
    return res.status(503).json({ error: 'Places API key is not configured' });
  }

  const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
  photoUrl.search = new URLSearchParams({
    maxwidth: String(width),
    photo_reference: ref,
    key: GOOGLE_API_KEY
  }).toString();

  return proxyImage(photoUrl.toString(), res);
});

router.get('/places/photo-by-query', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const maxwidth = Number.parseInt(req.query.maxwidth, 10);
  const width = Number.isInteger(maxwidth) && maxwidth > 0 ? maxwidth : 1200;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  if (!GOOGLE_API_KEY) {
    return res.status(503).json({ error: 'Places API key is not configured' });
  }

  try {
    const data = await getPlacePhotoData(query);
    if (!data?.photoRef) {
      return res.status(404).json({ error: 'No photo found' });
    }
    const url = buildPhotoProxyUrl(req, data.photoRef, width);
    return res.json({ url, attribution: data.attribution || '' });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch place photo' });
  }
});

module.exports = router;
