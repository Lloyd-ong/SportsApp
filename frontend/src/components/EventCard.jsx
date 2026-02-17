import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPlacePhotoFromBackend } from '../api.js';
import { getPlacePhotoUrl } from '../utils/googleMaps.js';

const isMapImageUrl = (value = '') =>
  /maps\.googleapis\.com\/maps\/api\/staticmap|onemap\.gov\.sg\/maps\/service/i.test(value);

function EventCard({ event, onToggleRsvp, canRsvp, index }) {
  const navigate = useNavigate();
  const startDate = event.start_time ? new Date(event.start_time) : null;
  const endDate = event.end_time ? new Date(event.end_time) : null;
  const dateLabel = startDate && !Number.isNaN(startDate.valueOf())
    ? startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : event.start_time;
  const timeLabel = startDate && !Number.isNaN(startDate.valueOf())
    ? startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
  const endLabel = endDate && !Number.isNaN(endDate.valueOf())
    ? endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';

  const rsvpCount = Number(event.rsvp_count) || 0;
  const capacity = event.capacity || null;
  const spotsLeft = capacity ? Math.max(capacity - rsvpCount, 0) : null;
  const isGoing = Boolean(event.is_going);
  const locationLabel = event.location
    ? event.location.replace(/\s*\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)\s*$/, '')
    : '';
  const photoQuery = locationLabel;
  const hasLocation = Boolean(locationLabel);
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  const isMapImage = isMapImageUrl(event.image_url || '');
  const [placePhoto, setPlacePhoto] = useState(null);
  const placePhotoUrl = placePhoto?.url || '';
  const attribution = placePhoto?.attribution || '';
  const imageUrl = (!isMapImage ? event.image_url : '') || placePhotoUrl || '';
  const [imgSrc, setImgSrc] = useState(imageUrl);
  const hasImage = Boolean(imgSrc);
  const paxLabel = capacity ? `${rsvpCount}/${capacity}` : `${rsvpCount}`;

  useEffect(() => {
    setImgSrc(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    let active = true;
    if ((!event.image_url || isMapImage) && photoQuery) {
      getPlacePhotoFromBackend(photoQuery, { maxWidth: 640 })
        .then((result) => {
          if (result) {
            return result;
          }
          if (!googleKey) {
            return null;
          }
          return getPlacePhotoUrl(photoQuery, googleKey, { maxWidth: 640 });
        })
        .then((result) => {
          if (active) {
            setPlacePhoto(result || null);
          }
        })
        .catch(() => {
          if (active) {
            setPlacePhoto(null);
          }
        });
    } else {
      setPlacePhoto(null);
    }
    return () => {
      active = false;
    };
  }, [event.image_url, isMapImage, photoQuery, googleKey]);

  const handleImageError = () => {
    setImgSrc('');
  };

  const handleImageNavigate = () => {
    navigate(`/events/${event.id}`);
  };

  const handleImageKeyDown = (eventKey) => {
    if (eventKey.key === 'Enter' || eventKey.key === ' ') {
      eventKey.preventDefault();
      handleImageNavigate();
    }
  };

  return (
    <article className="event-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="event-card__image">
        <div
          className="event-card__image-link"
          role="link"
          tabIndex={0}
          aria-label={`View ${event.title}`}
          onClick={handleImageNavigate}
          onKeyDown={handleImageKeyDown}
        >
          {hasImage ? (
            <img src={imgSrc} alt={event.title} loading="lazy" onError={handleImageError} />
          ) : (
            <div className="event-card__image-placeholder">
              <span>{event.sport}</span>
            </div>
          )}
        </div>
        {attribution ? (
          <div className="image-attribution" dangerouslySetInnerHTML={{ __html: attribution }} />
        ) : null}
      </div>
      <div className="event-card__header">
        <span className="pill">{event.sport}</span>
        <span className="event-card__meta">
          {dateLabel} {timeLabel}{endLabel ? ` - ${endLabel}` : ''}
        </span>
      </div>
      <h3>
        <Link to={`/events/${event.id}`} className="event-card__title-link">
          {event.title}
        </Link>
      </h3>
      <p className="event-card__desc">{event.description || 'No description yet.'}</p>
      <div className="event-card__details">
        <div>
          <div className="event-card__label">Location</div>
          <div>{locationLabel}</div>
        </div>
        <div>
          <div className="event-card__label">Pax</div>
          <div>{paxLabel}</div>
        </div>
      </div>
      <div className="event-card__footer">
        <div className="event-card__host">
          Hosted by <strong>{event.host_name}</strong>
        </div>
        <div className="event-card__actions">
          <button
            type="button"
            className={`btn ${isGoing ? 'btn--ghost' : 'btn--primary'}`}
            onClick={() => onToggleRsvp(event.id, isGoing)}
            disabled={!canRsvp}
          >
            {isGoing ? 'Cancel RSVP' : 'RSVP'}
          </button>
          <Link to={`/events/${event.id}`} className="btn btn--ghost">
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}

export default EventCard;
