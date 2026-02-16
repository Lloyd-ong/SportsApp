const API_URL =
  import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? 'https://sportsapp-9tvp.onrender.com' : 'http://localhost:4000');

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return res.json();
}

export function getMe() {
  return request('/auth/me');
}

export function registerUser(payload) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function loginUser(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export function updateProfile(payload) {
  return request('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function requestPasswordReset(email) {
  return request('/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export function resetPassword(payload) {
  return request('/auth/reset', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function sendPrivateMessage(payload) {
  return request('/api/messages', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getInboxMessages({ limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (limit) {
    params.set('limit', String(limit));
  }
  return request(`/api/messages/inbox?${params.toString()}`);
}

export function getPlacePhotoFromBackend(query, { maxWidth = 640 } = {}) {
  const params = new URLSearchParams();
  params.set('q', query);
  if (maxWidth) {
    params.set('maxwidth', String(maxWidth));
  }
  return request(`/api/places/photo-by-query?${params.toString()}`);
}


function buildEventParams(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.sport) {
    params.set('sport', filters.sport);
  }
  if (filters.region) {
    params.set('region', filters.region);
  }
  if (filters.startDate) {
    params.set('startDate', filters.startDate);
  }
  if (filters.endDate) {
    params.set('endDate', filters.endDate);
  }
  if (filters.includePast) {
    params.set('includePast', 'true');
  }
  return params.toString() ? `?${params}` : '';
}

export function getFeed(filters = {}) {
  const suffix = buildEventParams(filters);
  return request(`/api/feed${suffix}`);
}

export function getPublicStats() {
  return request('/api/stats');
}

export function searchEvents(filters = {}) {
  const suffix = buildEventParams(filters);
  return request(`/api/events${suffix}`);
}

export function createEvent(payload) {
  return request('/api/events', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateEvent(eventId, payload) {
  return request(`/api/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function toggleRsvp(eventId, isGoing) {
  if (isGoing) {
    return request(`/api/events/${eventId}/rsvp`, { method: 'DELETE' });
  }
  return request(`/api/events/${eventId}/rsvp`, { method: 'POST' });
}

export function getUserDashboard() {
  return request('/api/dashboard/user');
}

export function getAdminDashboard() {
  return request('/api/dashboard/admin');
}

export function getSuperadminDashboard() {
  return request('/api/dashboard/superadmin');
}

export function deleteEvent(eventId) {
  return request(`/api/admin/events/${eventId}`, { method: 'DELETE' });
}

export function updateUserRole(userId, role) {
  return request(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
}

export function getEventMessages(eventId) {
  return request(`/api/events/${eventId}/messages`);
}

export function postEventMessage(eventId, message) {
  return request(`/api/events/${eventId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

export function getCommunities() {
  return request('/api/communities');
}

export function getCommunity(communityId) {
  return request(`/api/communities/${communityId}`);
}

export function inviteCommunityMember(communityId, email) {
  return request(`/api/communities/${communityId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export function getCommunityInvites(communityId) {
  return request(`/api/communities/${communityId}/invites`);
}

export function acceptCommunityInvite(inviteId) {
  return request(`/api/invites/${inviteId}/accept`, { method: 'POST' });
}

export function declineCommunityInvite(inviteId) {
  return request(`/api/invites/${inviteId}/decline`, { method: 'POST' });
}

export function createCommunity(payload) {
  return request('/api/communities', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateCommunity(communityId, payload) {
  return request(`/api/communities/${communityId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function getCommunityMessages(communityId) {
  return request(`/api/communities/${communityId}/messages`);
}

export function postCommunityMessage(communityId, message) {
  return request(`/api/communities/${communityId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

export function joinCommunity(communityId) {
  return request(`/api/communities/${communityId}/join`, { method: 'POST' });
}

export function leaveCommunity(communityId) {
  return request(`/api/communities/${communityId}/join`, { method: 'DELETE' });
}

export function getCommunityRequests(communityId) {
  return request(`/api/communities/${communityId}/requests`);
}

export function approveCommunityRequest(communityId, userId) {
  return request(`/api/communities/${communityId}/requests/${userId}/approve`, {
    method: 'POST'
  });
}

export function rejectCommunityRequest(communityId, userId) {
  return request(`/api/communities/${communityId}/requests/${userId}/reject`, {
    method: 'POST'
  });
}

export function getApiUrl() {
  return API_URL;
}

export function searchOneMapLocations(query) {
  const params = new URLSearchParams({ q: query });
  return request(`/api/onemap/search?${params.toString()}`);
}
