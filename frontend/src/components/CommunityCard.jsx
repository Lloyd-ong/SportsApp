import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlacePhotoUrl } from '../utils/googleMaps.js';
import {
  approveCommunityRequest,
  getCommunityRequests,
  getPlacePhotoFromBackend,
  joinCommunity,
  leaveCommunity,
  rejectCommunityRequest,
  updateCommunity
} from '../api.js';

const isMapImageUrl = (value = '') =>
  /maps\.googleapis\.com\/maps\/api\/staticmap|onemap\.gov\.sg\/maps\/service/i.test(value);

const SPORT_COVER_STYLES = {
  basketball: { bg: '#f97316', accent: '#111827' },
  soccer: { bg: '#22c55e', accent: '#0f172a' },
  football: { bg: '#f59e0b', accent: '#111827' },
  tennis: { bg: '#38bdf8', accent: '#0f172a' },
  badminton: { bg: '#a855f7', accent: '#0f172a' },
  running: { bg: '#ef4444', accent: '#111827' },
  cycling: { bg: '#14b8a6', accent: '#0f172a' },
  volleyball: { bg: '#fb7185', accent: '#111827' },
  baseball: { bg: '#60a5fa', accent: '#0f172a' },
  golf: { bg: '#84cc16', accent: '#0f172a' },
  swimming: { bg: '#38bdf8', accent: '#0f172a' }
};

const escapeXml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const getSportCoverUrl = (sport) => {
  const label = sport && String(sport).trim() ? String(sport).trim() : 'Community';
  const key = label.toLowerCase();
  const theme = SPORT_COVER_STYLES[key] || { bg: '#1f2937', accent: '#e2e8f0' };
  const text = escapeXml(label.toUpperCase());
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.bg}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#g)"/>
      <circle cx="520" cy="60" r="70" fill="${theme.accent}" opacity="0.22"/>
      <circle cx="110" cy="320" r="90" fill="${theme.accent}" opacity="0.12"/>
      <text x="40" y="210" fill="#f8fafc" font-size="40" font-family="Inter, Arial, sans-serif" font-weight="700" letter-spacing="1">
        ${text}
      </text>
      <text x="40" y="250" fill="#e2e8f0" font-size="18" font-family="Inter, Arial, sans-serif" font-weight="500">
        Community
      </text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

function CommunityCard({ community, canPost, onMembershipChange, onCommunityUpdated }) {
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: community.name || '',
    description: community.description || '',
    sport: community.sport || '',
    region: community.region || '',
    image_url: community.image_url || '',
    max_members: community.max_members || '',
    visibility: community.visibility || 'public'
  });
  const isMember = Boolean(community.is_member);
  const isOwner = Boolean(community.is_owner);
  const membershipStatus = community.membership_status || 'none';
  const isPrivate = community.visibility === 'private';
  const createdLabel = community.created_at ? new Date(community.created_at).toLocaleDateString() : '';
  const hasRegion = Boolean(community.region && community.region.trim());
  const photoQuery = [community.sport || community.name].filter(Boolean).join(' ').trim();
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  const [placePhoto, setPlacePhoto] = useState(null);
  const placePhotoUrl = placePhoto?.url || '';
  const attribution = placePhoto?.attribution || '';
  const isMapImage = isMapImageUrl(community.image_url || '');
  const sportCoverUrl = getSportCoverUrl(community.sport);
  const imageUrl = (!isMapImage ? community.image_url : '') || placePhotoUrl || sportCoverUrl;
  const [imgSrc, setImgSrc] = useState(imageUrl);
  const hasImage = Boolean(imgSrc);
  const membersLabel = community.max_members
    ? `${community.member_count || 0}/${community.max_members}`
    : `${community.member_count || 0}`;

  const editSportLabel = (editForm.sport || community.sport || 'Community').trim();

  useEffect(() => {
    if (!isOwner) {
      return;
    }

    let active = true;
    setRequestLoading(true);
    getCommunityRequests(community.id)
      .then((data) => {
        if (active) {
          setRequests(data.requests || []);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setRequestLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOwner, community.id]);

  useEffect(() => {
    setEditForm({
      name: community.name || '',
      description: community.description || '',
      sport: community.sport || '',
      region: community.region || '',
      image_url: community.image_url || '',
      max_members: community.max_members || '',
      visibility: community.visibility || 'public'
    });
  }, [community]);

  useEffect(() => {
    setImgSrc(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    let active = true;
    if ((!community.image_url || isMapImage) && photoQuery) {
      const primary = googleKey
        ? getPlacePhotoUrl(photoQuery, googleKey, { maxWidth: 640 })
        : Promise.resolve(null);
      primary
        .then((result) => result || getPlacePhotoFromBackend(photoQuery, { maxWidth: 640 }))
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
  }, [community.image_url, isMapImage, photoQuery, googleKey]);

  const handleImageError = () => {
    if (imgSrc !== sportCoverUrl) {
      setImgSrc(sportCoverUrl);
      return;
    }
    setImgSrc('');
  };

  const handleJoinLeave = async () => {
    if (!canPost) {
      return;
    }
    setError('');
    setJoining(true);
    try {
      if (isMember) {
        await leaveCommunity(community.id);
        onMembershipChange?.(community.id, 'none');
        setMessages([]);
      } else {
        const data = await joinCommunity(community.id);
        const nextStatus = data.status || (isPrivate ? 'pending' : 'approved');
        onMembershipChange?.(community.id, nextStatus);
        if (nextStatus !== 'approved') {
          setMessages([]);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleApprove = async (userId) => {
    setError('');
    try {
      await approveCommunityRequest(community.id, userId);
      setRequests((prev) => prev.filter((item) => item.user_id !== userId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (userId) => {
    setError('');
    try {
      await rejectCommunityRequest(community.id, userId);
      setRequests((prev) => prev.filter((item) => item.user_id !== userId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setEditSaving(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        sport: editForm.sport.trim(),
        region: editForm.region.trim(),
        image_url: editForm.image_url.trim(),
        max_members: editForm.max_members,
        visibility: editForm.visibility
      };
      const data = await updateCommunity(community.id, payload);
      onCommunityUpdated?.(data.community);
      setEditOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleImageChange = (event) => {
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
      setEditForm((prev) => ({ ...prev, image_url: String(reader.result) }));
    };
    reader.onerror = () => {
      setImageError('Failed to read image.');
    };
    reader.readAsDataURL(file);
  };

  return (
    <article className="event-card community-card">
      <div className="event-card__image">
        {hasImage ? (
          <img src={imgSrc} alt={community.name} loading="lazy" onError={handleImageError} />
        ) : (
          <div className="event-card__image-placeholder">
            <span>{community.sport || 'Community'}</span>
          </div>
        )}
        {attribution ? (
          <div className="image-attribution" dangerouslySetInnerHTML={{ __html: attribution }} />
        ) : null}
      </div>
      <div className="event-card__header">
        <span className="pill">{community.sport || 'Community'}</span>
        <span className="event-card__meta">
          {community.region || 'All regions'} {isPrivate ? '· Private' : community.visibility === 'invite' ? '· Invite only' : '· Public'}
        </span>
      </div>
      <h3>{community.name}</h3>
      <p className="event-card__desc">{community.description || 'No description yet.'}</p>
      <div className="event-card__details">
        <div>
          <div className="event-card__label">Created by</div>
          <div>{community.creator_name}</div>
        </div>
        <div>
          <div className="event-card__label">Members</div>
          <div>{membersLabel}</div>
        </div>
        {createdLabel ? (
          <div>
            <div className="event-card__label">Created</div>
            <div>{createdLabel}</div>
          </div>
        ) : null}
      </div>
      <div className="event-card__footer">
        <div className="event-card__host">Community chat</div>
        <div className="event-card__actions">
          {isOwner ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setEditOpen(true)}
            >
              Edit
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleJoinLeave}
            disabled={joining || !canPost || membershipStatus === 'pending'}
          >
            {isMember ? 'Leave' : membershipStatus === 'pending' ? 'Requested' : 'Join'}
          </button>
          <Link to={`/communities/${community.id}`} className="btn btn--primary">
            View
          </Link>
        </div>
      </div>
      {membershipStatus === 'pending' ? (
        <div className="chat__locked">Request sent. Waiting for approval.</div>
      ) : null}

      {isOwner ? (
        <div className="moderation">
          <div className="moderation__title">Pending requests</div>
          {requestLoading ? <div className="loading">Loading requests...</div> : null}
          {requests.length ? (
            <div className="moderation__list">
              {requests.map((item) => (
                <div className="moderation__item" key={item.user_id}>
                  <div>
                    <div className="moderation__name">{item.user_name}</div>
                    <div className="moderation__meta">{item.user_email}</div>
                  </div>
                  <div className="moderation__actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => handleReject(item.user_id)}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => handleApprove(item.user_id)}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="chat__empty">No pending requests.</div>
          )}
        </div>
      ) : null}

      {editOpen ? (
        <div className="md-modal-backdrop" role="presentation" onClick={() => setEditOpen(false)}>
          <div
            className="md-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="md-modal__close"
              onClick={() => setEditOpen(false)}
              aria-label="Close"
            >
              x
            </button>
            <h2>Edit community</h2>
            <p className="md-modal__lead">Update your community details.</p>
            <form className="community-form" onSubmit={handleEditSubmit}>
              <div className="image-upload">
                <span className="image-upload__label">Community image</span>
                <label className="image-upload__box">
                  {editForm.image_url ? (
                    <img src={editForm.image_url} alt="Community preview" />
                  ) : (
                    <div className="image-upload__placeholder">{editSportLabel}</div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                </label>
                <div className="form-hint">
                  Upload a cover image (optional). If omitted, we’ll try to fetch one from the region.
                </div>
                {imageError ? <div className="form-error">{imageError}</div> : null}
              </div>
              <label>
                Name
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                Sport
                <input
                  type="text"
                  value={editForm.sport}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, sport: event.target.value }))}
                />
              </label>
              <label>
                Region
                <input
                  type="text"
                  value={editForm.region}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, region: event.target.value }))}
                />
              </label>
              <label>
                Max members
                <input
                  type="number"
                  min="1"
                  value={editForm.max_members}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, max_members: event.target.value }))}
                />
              </label>
                <label>
                  Visibility
                  <select
                    value={editForm.visibility}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, visibility: event.target.value }))}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="invite">Invite only</option>
                  </select>
                </label>
              <label>
                Description
                <textarea
                  rows="3"
                  value={editForm.description}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <button type="submit" className="btn btn--primary" disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default CommunityCard;
