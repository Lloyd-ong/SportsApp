const DEFAULT_BBOX = {
  sw: [1.144, 103.535],
  ne: [1.494, 104.502]
};

const DEFAULT_CENTER = { lat: 1.2868108, lng: 103.8545349 };

export function getOneMapStaticMapUrl({
  width = 640,
  height = 360,
  bbox = DEFAULT_BBOX,
  center = null,
  delta = 0.01
} = {}) {
  const resolvedBbox = center
    ? {
      sw: [center.lat - delta, center.lng - delta],
      ne: [center.lat + delta, center.lng + delta]
    }
    : bbox;
  const bboxValue = `${resolvedBbox.sw[0]},${resolvedBbox.sw[1]},${resolvedBbox.ne[0]},${resolvedBbox.ne[1]}`;
  const params = new URLSearchParams({
    service: 'WMS',
    request: 'GetMap',
    layers: 'Default',
    format: 'image/png',
    version: '1.0.0',
    WMTVER: '1.0.0',
    CRS: 'EPSG:4326',
    bbox: bboxValue,
    width: String(width),
    height: String(height)
  });
  return `https://www.onemap.gov.sg/maps/service?${params.toString()}`;
}

export function createOneMap(container, { center = DEFAULT_CENTER, zoom = 16 } = {}) {
  if (!container || !window.L) {
    return null;
  }
  const L = window.L;
  const sw = L.latLng(1.144, 103.535);
  const ne = L.latLng(1.494, 104.502);
  const bounds = L.latLngBounds(sw, ne);

  const map = L.map(container, {
    center: L.latLng(center.lat, center.lng),
    zoom
  });

  map.setMaxBounds(bounds);

  const basemap = L.tileLayer.wms('https://www.onemap.gov.sg/maps/service?', {
    layers: 'Default',
    format: 'image/png',
    version: '1.0.0',
    WMTVER: '1.0.0',
    crs: L.CRS.EPSG4326,
    maxZoom: 18,
    minZoom: 11,
    attribution:
      '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;"/>&nbsp;<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>&nbsp;&copy;&nbsp;contributors&nbsp;&#124;&nbsp;<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>'
  });

  basemap.addTo(map);
  return map;
}

export function parseLatLng(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  return { lat, lng };
}

export const DEFAULT_ONE_MAP_CENTER = DEFAULT_CENTER;
