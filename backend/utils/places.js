const https = require('https');
const { URL, URLSearchParams } = require('url');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const stripLocationLabel = (value) => (value ? value.replace(/\s*\([^)]*\)\s*$/, '') : '');

const fetchJson = (url) => new Promise((resolve, reject) => {
  https
    .get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}`));
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

const getPlacePhotoReference = async (query) => {
  if (!GOOGLE_API_KEY || !query) {
    return null;
  }

  const findUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  findUrl.search = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'place_id',
    key: GOOGLE_API_KEY
  }).toString();

  const findData = await fetchJson(findUrl);
  const placeId = findData?.candidates?.[0]?.place_id;
  if (!placeId) {
    return null;
  }

  const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  detailsUrl.search = new URLSearchParams({
    place_id: placeId,
    fields: 'photos',
    key: GOOGLE_API_KEY
  }).toString();

  const detailsData = await fetchJson(detailsUrl);
  const photoRef = detailsData?.result?.photos?.[0]?.photo_reference;
  return photoRef || null;
};

const getPlacePhotoData = async (query) => {
  if (!GOOGLE_API_KEY || !query) {
    return null;
  }

  const findUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  findUrl.search = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'place_id',
    key: GOOGLE_API_KEY
  }).toString();

  const findData = await fetchJson(findUrl);
  const placeId = findData?.candidates?.[0]?.place_id;
  if (!placeId) {
    return null;
  }

  const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  detailsUrl.search = new URLSearchParams({
    place_id: placeId,
    fields: 'photos',
    key: GOOGLE_API_KEY
  }).toString();

  const detailsData = await fetchJson(detailsUrl);
  const photo = detailsData?.result?.photos?.[0];
  if (!photo?.photo_reference) {
    return null;
  }

  return {
    photoRef: photo.photo_reference,
    attribution: Array.isArray(photo.html_attributions) ? photo.html_attributions.join(' ') : ''
  };
};

const buildPhotoProxyUrl = (req, photoRef, maxwidth = 1200) => {
  if (!photoRef) {
    return '';
  }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/api/places/photo?ref=${encodeURIComponent(photoRef)}&maxwidth=${maxwidth}`;
};

module.exports = {
  GOOGLE_API_KEY,
  stripLocationLabel,
  getPlacePhotoReference,
  getPlacePhotoData,
  buildPhotoProxyUrl
};
