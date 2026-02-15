let googleMapsPromise;
const placePhotoCache = new Map();

export function loadGoogleMaps(apiKey) {
  if (!apiKey) {
    return Promise.reject(new Error('Missing Google Maps API key'));
  }

  if (window.google && window.google.maps) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export function loadGoogleMapsPlaces(apiKey) {
  return loadGoogleMaps(apiKey);
}

export function getStaticMapUrl(location, apiKey) {
  if (!apiKey || !location) {
    return '';
  }
  const query = encodeURIComponent(location);
  return `https://maps.googleapis.com/maps/api/staticmap?center=${query}&zoom=14&size=640x360&maptype=roadmap&markers=color:orange%7C${query}&key=${apiKey}`;
}

export async function getPlacePhotoUrl(query, apiKey, { maxWidth = 640, maxHeight } = {}) {
  if (!apiKey || !query) {
    return null;
  }
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (placePhotoCache.has(normalized)) {
    return placePhotoCache.get(normalized);
  }

  const google = await loadGoogleMaps(apiKey);
  if (!google?.maps?.places) {
    placePhotoCache.set(normalized, null);
    return null;
  }

  const service = new google.maps.places.PlacesService(document.createElement('div'));
  return new Promise((resolve) => {
    service.textSearch({ query }, (results, status) => {
      if (
        status === google.maps.places.PlacesServiceStatus.OK &&
        results &&
        results[0] &&
        results[0].photos &&
        results[0].photos.length
      ) {
        const photo = results[0].photos[0];
        const options = {};
        if (maxWidth) {
          options.maxWidth = maxWidth;
        }
        if (maxHeight) {
          options.maxHeight = maxHeight;
        }
        const url = photo.getUrl(options);
        const attribution = Array.isArray(photo.html_attributions) && photo.html_attributions.length
          ? photo.html_attributions.join(' ')
          : '';
        const payload = { url, attribution };
        placePhotoCache.set(normalized, payload);
        resolve(payload);
        return;
      }
      placePhotoCache.set(normalized, null);
      resolve(null);
    });
  });
}

export async function initPlaceAutocomplete(inputEl, apiKey, onSelect) {
  if (!inputEl) {
    return () => {};
  }

  const google = await loadGoogleMapsPlaces(apiKey);
  if (google?.maps?.places?.PlaceAutocompleteElement) {
    const wrapper = document.createElement('div');
    wrapper.className = 'gmp-autocomplete';
    const element = new google.maps.places.PlaceAutocompleteElement();
    element.classList.add('gmp-autocomplete__input');
    element.setAttribute('placeholder', inputEl.getAttribute('placeholder') || 'Search location');
    wrapper.appendChild(element);
    inputEl.parentNode.insertBefore(wrapper, inputEl);
    inputEl.style.display = 'none';

    const handlePlace = async (event) => {
      const place = event?.place || event?.detail?.place;
      if (!place) {
        return;
      }
      if (place.fetchFields) {
        await place.fetchFields({ fields: ['formatted_address', 'name', 'displayName'] });
      }
      const value =
        place.formattedAddress || place.displayName || place.name || '';
      if (value) {
        onSelect(value);
      }
    };

    element.addEventListener('gmp-placeselect', handlePlace);
    return () => {
      element.removeEventListener('gmp-placeselect', handlePlace);
      wrapper.remove();
      inputEl.style.display = '';
    };
  }

  if (google?.maps?.places?.Autocomplete) {
    const autocomplete = new google.maps.places.Autocomplete(inputEl, {
      types: ['geocode'],
      fields: ['formatted_address', 'name']
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const value = place.formatted_address || place.name || '';
      if (value) {
        onSelect(value);
      }
    });
    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }

  return () => {};
}

export async function initGoogleMap(container, apiKey, { center, locationLabel } = {}) {
  if (!container) {
    return () => {};
  }
  const google = await loadGoogleMaps(apiKey);
  const defaultCenter = { lat: 1.2868108, lng: 103.8545349 };
  let mapCenter = center || defaultCenter;
  const mapOptions = {
    center: mapCenter,
    zoom: 14,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  };
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID;
  if (mapId) {
    mapOptions.mapId = mapId;
  }
  const map = new google.maps.Map(container, mapOptions);
  const AdvancedMarkerElement = google.maps.marker?.AdvancedMarkerElement;
  const useAdvancedMarker = Boolean(AdvancedMarkerElement && mapId);
  let marker = useAdvancedMarker
    ? new AdvancedMarkerElement({ position: mapCenter, map })
    : new google.maps.Marker({ position: mapCenter, map });

  if (!center && locationLabel) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: locationLabel }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        map.setCenter(loc);
        if (useAdvancedMarker) {
          marker.position = loc;
        } else {
          marker.setPosition(loc);
        }
      }
    });
  }

  return () => {
    if (marker) {
      if (useAdvancedMarker) {
        marker.map = null;
      } else {
        marker.setMap(null);
      }
      marker = null;
    }
  };
}
