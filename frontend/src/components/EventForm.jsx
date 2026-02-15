import { useEffect, useMemo, useState } from 'react';
import { searchOneMapLocations } from '../api.js';
import { getOneMapStaticMapUrl, parseLatLng } from '../utils/onemap.js';
import { getStaticMapUrl } from '../utils/googleMaps.js';

const initialForm = {
  title: '',
  description: '',
  sport: '',
  location: '',
  image_url: '',
  start_time: '',
  end_time: '',
  capacity: ''
};

function EventForm({ onCreate, disabled }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationOptions, setLocationOptions] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setLocationQuery(form.location);
  }, [form.location]);

  useEffect(() => {
    if (!locationQuery || locationQuery.trim().length < 3) {
      setLocationOptions([]);
      return;
    }

    let active = true;
    setLocationLoading(true);
    const timer = setTimeout(() => {
      searchOneMapLocations(locationQuery.trim())
        .then((data) => {
          if (active) {
            setLocationOptions(data.results || []);
          }
        })
        .catch(() => {
          if (active) {
            setLocationOptions([]);
          }
        })
        .finally(() => {
          if (active) {
            setLocationLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [locationQuery]);

  const locationDatalistId = useMemo(
    () => `location-options-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const stripLocationLabel = (value) => (value ? value.replace(/\s*\([^)]*\)\s*$/, '') : '');
  const buildMapImageUrl = (value) => {
    const label = stripLocationLabel(value);
    if (!label) {
      return '';
    }
    const center = parseLatLng(value || '');
    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    const googleQuery = center ? `${center.lat},${center.lng}` : label;
    const googleUrl = googleKey ? getStaticMapUrl(googleQuery, googleKey) : '';
    return googleUrl || getOneMapStaticMapUrl({ width: 960, height: 540, center });
  };

  const buildLocationValue = (item) => {
    const label = item.BUILDING || item.SEARCHVAL || item.ADDRESS || 'Location';
    const lat = item.LATITUDE || item.lat;
    const lng = item.LONGITUDE || item.lng;
    if (lat && lng) {
      return `${label} (${lat}, ${lng})`;
    }
    return label;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const hasCoords = /\d+\.\d+\s*,\s*\d+\.\d+/.test(form.location);
    if (!form.title || !form.sport || !form.location || !form.start_time) {
      setError('Title, sport, location, and start time are required.');
      return;
    }
    if (!hasCoords) {
      setError('Please select a location from the dropdown list.');
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        title: form.title,
        description: form.description,
        sport: form.sport,
        location: form.location,
        image_url: hasCoords ? '' : form.image_url,
        start_time: form.start_time,
        end_time: form.end_time,
        capacity: form.capacity
      });
      setForm(initialForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasCoords = /\d+\.\d+\s*,\s*\d+\.\d+/.test(form.location);
  const mapPreview = hasCoords ? buildMapImageUrl(form.location) : '';

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <div className="event-form__row">
        <label>
          Event title
          <input
            type="text"
            value={form.title}
            onChange={(event) => handleChange('title', event.target.value)}
            placeholder="Sunday football run"
            disabled={disabled || saving}
          />
        </label>
        <label>
          Sport
          <input
            type="text"
            value={form.sport}
            onChange={(event) => handleChange('sport', event.target.value)}
            placeholder="Football, Basketball, Tennis"
            disabled={disabled || saving}
          />
        </label>
      </div>
      <label>
        Description
        <textarea
          rows="3"
          value={form.description}
          onChange={(event) => handleChange('description', event.target.value)}
          placeholder="What should people know before showing up?"
          disabled={disabled || saving}
        />
      </label>
      <div className="image-upload">
        <span className="image-upload__label">Event image</span>
        <label className={`image-upload__box ${hasCoords ? 'image-upload__box--disabled' : ''}`}>
          {hasCoords ? (
            mapPreview ? (
              <img src={mapPreview} alt="Event location preview" />
            ) : (
              <div className="image-upload__placeholder">Map</div>
            )
          ) : form.image_url ? (
            <img src={form.image_url} alt="Event preview" />
          ) : (
            <div className="image-upload__placeholder">+</div>
          )}
          <input
            type="file"
            accept="image/*"
            disabled={disabled || saving || hasCoords}
            onChange={(event) => {
              const file = event.target.files && event.target.files[0];
              if (!file) {
                return;
              }
              if (!file.type.startsWith('image/')) {
                setImageError('Please select an image file.');
                return;
              }
              setImageError('');
              const reader = new FileReader();
              reader.onload = () => {
                setForm((prev) => ({ ...prev, image_url: String(reader.result) }));
              };
              reader.onerror = () => {
                setImageError('Failed to read image.');
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <div className="form-hint">
          {hasCoords
            ? 'Image will be pulled from the selected location.'
            : 'Upload a cover image if you do not have a location.'}
        </div>
        {imageError ? <div className="form-error">{imageError}</div> : null}
      </div>
      <div className="event-form__row">
        <label>
          Location
          <input
            type="text"
            value={form.location}
            onChange={(event) => handleChange('location', event.target.value)}
            placeholder="Arena Court, Downtown"
            disabled={disabled || saving}
            list={locationDatalistId}
          />
          <datalist id={locationDatalistId}>
            {locationOptions.map((item) => (
              <option key={item.SEARCHVAL + item.LATITUDE + item.LONGITUDE} value={buildLocationValue(item)} />
            ))}
          </datalist>
          <div className="form-hint">
            {locationLoading ? 'Searching locations...' : 'Pick a location from the dropdown to pin it on the map.'}
          </div>
        </label>
        <label>
          Max pax
          <input
            type="number"
            min="1"
            value={form.capacity}
            onChange={(event) => handleChange('capacity', event.target.value)}
            placeholder="Optional"
            disabled={disabled || saving}
          />
        </label>
      </div>
      <div className="event-form__row">
        <label>
          Start time
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(event) => handleChange('start_time', event.target.value)}
            disabled={disabled || saving}
          />
        </label>
        <label>
          End time
          <input
            type="datetime-local"
            value={form.end_time}
            onChange={(event) => handleChange('end_time', event.target.value)}
            disabled={disabled || saving}
          />
        </label>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <button type="submit" className="btn btn--primary" disabled={disabled || saving}>
        {saving ? 'Saving...' : 'Create event'}
      </button>
    </form>
  );
}

export default EventForm;
