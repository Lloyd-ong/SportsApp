import { useEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import EventCard from './components/EventCard.jsx';
import EventForm from './components/EventForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import AuthModal from './components/AuthModal.jsx';
import CommunityCard from './components/CommunityCard.jsx';
import {
  createEvent,
  deleteEvent,
  getCommunities,
  getPublicStats,
  getApiUrl,
  getAdminDashboard,
  getFeed,
  getMe,
  getSuperadminDashboard,
  getUserDashboard,
  getUserRsvpHistory,
  loginUser,
  logout,
  createCommunity,
  registerUser,
  requestPasswordReset,
  resetPassword,
  sendPrivateMessage,
  getInboxMessages,
  getPlacePhotoFromBackend,
  toggleRsvp,
  updateEvent,
  updateProfile,
  updateUserRole,
  getCommunity,
  getCommunityMembers,
  joinCommunity,
  leaveCommunity,
  getCommunityMessages,
  postCommunityMessage,
  updateCommunity,
  getCommunityRequests,
  kickCommunityMember,
  banCommunityMember,
  updateCommunityMemberRole,
  approveCommunityRequest,
  rejectCommunityRequest,
  inviteCommunityMember,
  getCommunityInvites,
  acceptCommunityInvite,
  declineCommunityInvite
} from './api.js';
import {
  getEventMessages,
  postEventMessage,
  getEventMembers,
  kickEventMember,
  banEventMember
} from './api.js';
import { getOneMapStaticMapUrl, parseLatLng } from './utils/onemap.js';
import { getPlacePhotoUrl, getStaticMapUrl, initGoogleMap } from './utils/googleMaps.js';
import { searchOneMapLocations } from './api.js';

function CountUp({ end, suffix = '', duration = 1200, start = 0, className = '' }) {
  const [value, setValue] = useState(start);

  useEffect(() => {
    let startTime;
    let frameId;

    const step = (timestamp) => {
      if (!startTime) {
        startTime = timestamp;
      }
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const nextValue = Math.floor(start + (end - start) * progress);
      setValue(nextValue);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [end, duration, start]);

  return (
    <span className={className}>
      {value}
      {suffix}
    </span>
  );
}

const SPORT_OPTIONS = [
  'Basketball',
  'Football',
  'Futsal',
  'Tennis',
  'Volleyball',
  'Badminton',
  'Running',
  'Pickleball',
  'Cycling',
  'Swimming'
];

const REGION_OPTIONS = ['Downtown', 'North', 'East', 'South', 'West', 'Central'];

const COMMUNITY_COVER_STYLES = {
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

const getCommunitySportCoverUrl = (sport) => {
  const label = sport && String(sport).trim() ? String(sport).trim() : 'Community';
  const key = label.toLowerCase();
  const theme = COMMUNITY_COVER_STYLES[key] || { bg: '#1f2937', accent: '#e2e8f0' };
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

function App() {
  const location = useLocation();
  if (import.meta.env.DEV) {
    console.log('App mounted');
  }
  const capitalizeWords = (value) =>
    String(value || '').replace(/\b([a-z])/g, (match) => match.toUpperCase());
  const parseInterestList = (value) =>
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  const appendSportToInterestList = (currentValue, sportValue) => {
    const sport = String(sportValue || '').trim();
    if (!sport) {
      return typeof currentValue === 'string' ? currentValue : '';
    }
    const items = parseInterestList(currentValue);
    if (items.some((item) => item.toLowerCase() === sport.toLowerCase())) {
      return items.join(', ');
    }
    return [...items, sport].join(', ');
  };
  const stripLocationLabel = (value) =>
    value
      ? value.replace(/\s*\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)\s*$/, '')
      : '';
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
  const isStaticMapUrl = (value = '') =>
    /maps\.googleapis\.com\/maps\/api\/staticmap|onemap\.gov\.sg\/maps\/service/i.test(value);
  const isSameListById = (prev = [], next = []) => {
    if (prev.length !== next.length) {
      return false;
    }
    for (let i = 0; i < prev.length; i += 1) {
      const a = prev[i];
      const b = next[i];
      if (!a || !b || a.id !== b.id) {
        return false;
      }
    }
    return true;
  };
  const [user, setUser] = useState(null);
  const [googleEnabled, setGoogleEnabled] = useState(true);
  const [profileToast, setProfileToast] = useState(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageError, setMessageError] = useState('');
  const [messageSuccess, setMessageSuccess] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [events, setEvents] = useState([]);
  const [publicStats, setPublicStats] = useState(null);
  const [nearbyEventsData, setNearbyEventsData] = useState([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    sport: '',
    region: '',
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('register');
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [activeTab, setActiveTab] = useState('events');
  const [activeSportTab, setActiveSportTab] = useState('');
  const [communities, setCommunities] = useState([]);
  const [nearbyCommunitiesData, setNearbyCommunitiesData] = useState([]);
  const [communityFilters, setCommunityFilters] = useState({ sport: '', region: '' });
  const [communityActiveSportTab, setCommunityActiveSportTab] = useState('');
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState('');
  const [communityForm, setCommunityForm] = useState({
    name: '',
    description: '',
    sport: '',
    region: '',
    image_url: '',
    max_members: '',
    visibility: 'public'
  });
  const [communityImageError, setCommunityImageError] = useState('');
  const [communityNotice, setCommunityNotice] = useState('');

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const updateCommunityCollections = (communityId, transform) => {
    if (!communityId || typeof transform !== 'function') {
      return;
    }
    const apply = (list) =>
      list.map((item) => (item.id === communityId ? transform(item) : item));
    setCommunities((prev) => apply(prev));
    setNearbyCommunitiesData((prev) => apply(prev));
  };

  const applyCommunityMembershipStatus = (communityId, status) => {
    updateCommunityCollections(communityId, (item) => {
      const wasMember = Number(item.is_member) === 1;
      const isMemberNow = status === 'approved';
      const currentCount = Number(item.member_count) || 0;
      const nextCount = isMemberNow && !wasMember
        ? currentCount + 1
        : !isMemberNow && wasMember
          ? Math.max(currentCount - 1, 0)
          : currentCount;
      return {
        ...item,
        is_member: isMemberNow ? 1 : 0,
        membership_status: status || 'none',
        member_count: nextCount
      };
    });
  };

  const mergeCommunityIntoCollections = (updated) => {
    if (!updated || !updated.id) {
      return;
    }
    updateCommunityCollections(updated.id, (item) => ({ ...item, ...updated }));
  };

  const apiUrl = getApiUrl();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!profileToast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setProfileToast(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [profileToast]);

  const handleFooterCta = () => {
    if (user) {
      navigate('/');
      return;
    }
    setAuthMode('register');
    setAuthOpen(true);
  };

  const openMessageComposer = (target) => {
    setMessageTarget(target);
    setMessageDraft('');
    setMessageError('');
    setMessageSuccess('');
    setMessageOpen(true);
  };

  const closeMessageComposer = () => {
    setMessageOpen(false);
    setMessageTarget(null);
    setMessageDraft('');
    setMessageError('');
    setMessageSuccess('');
    setMessageSending(false);
  };

  const handleSendPrivateMessage = async (event) => {
    event.preventDefault();
    if (!messageTarget) {
      return;
    }
    const trimmed = messageDraft.trim();
    if (!trimmed) {
      setMessageError('Message cannot be empty.');
      return;
    }
    setMessageSending(true);
    setMessageError('');
    setMessageSuccess('');
    try {
      await sendPrivateMessage({ recipient_id: messageTarget.id, message: trimmed });
      setMessageSuccess('Message sent.');
      setMessageDraft('');
    } catch (err) {
      setMessageError(err.message);
    } finally {
      setMessageSending(false);
    }
  };

  const loadEvents = async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const activeQuery = Object.prototype.hasOwnProperty.call(options, 'query')
        ? options.query
        : query;
      const activeFilters = options.filters ? { ...filters, ...options.filters } : filters;
      const payload = {
        q: typeof activeQuery === 'string' ? activeQuery.trim() : '',
        sport: activeFilters.sport,
        region: activeFilters.region,
        startDate: activeFilters.startDate,
        endDate: activeFilters.endDate
      };
      const data = await getFeed(payload);
      setEvents(data.events || []);
      setNearbyEventsData(data.events || []);
    } catch (err) {
      if (!silent) {
        setError(err.message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadCommunities = async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) {
      setCommunityLoading(true);
      setCommunityError('');
    }
    try {
      const data = await getCommunities();
      setCommunities(data.communities || []);
      setNearbyCommunitiesData(data.communities || []);
    } catch (err) {
      if (!silent) {
        setCommunityError(err.message);
      }
    } finally {
      if (!silent) {
        setCommunityLoading(false);
      }
    }
  };

  const fetchDashboardData = async (role) => {
    if (!role) {
      return null;
    }

    if (role === 'admin') {
      const [userData, adminData] = await Promise.all([getUserDashboard(), getAdminDashboard()]);
      return {
        userStats: userData.stats,
        hostedEvents: userData.hostedEvents,
        rsvpEvents: userData.rsvpEvents,
        adminStats: adminData.stats,
        recentEvents: adminData.recentEvents,
        recentUsers: adminData.recentUsers
      };
    }

    if (role === 'superadmin') {
      const [userData, superData] = await Promise.all([getUserDashboard(), getSuperadminDashboard()]);
      return {
        userStats: userData.stats,
        hostedEvents: userData.hostedEvents,
        rsvpEvents: userData.rsvpEvents,
        adminStats: superData.stats,
        recentEvents: superData.recentEvents,
        users: superData.users
      };
    }

    const userData = await getUserDashboard();
    return {
      userStats: userData.stats,
      hostedEvents: userData.hostedEvents,
      rsvpEvents: userData.rsvpEvents
    };
  };

  const loadDashboard = async (role) => {
    if (!role) {
      setDashboard(null);
      return;
    }

    setDashboardLoading(true);
    setDashboardError('');

    try {
      const data = await fetchDashboardData(role);
      setDashboard(data);
    } catch (err) {
      setDashboardError(err.message);
    } finally {
      setDashboardLoading(false);
    }
  };

  const refreshSession = async () => {
    const me = await getMe();
    setUser(me.user);
    setGoogleEnabled(Boolean(me.googleEnabled));

    if (me.user) {
      setAuthOpen(false);
      if (me.user.role) {
        await loadDashboard(me.user.role);
      }
    } else {
      setDashboard(null);
    }

    return me.user;
  };

  useEffect(() => {
    let active = true;

    const init = async () => {
      setLoading(true);
      try {
        const [me, feed, communityData] = await Promise.all([
          getMe(),
          getFeed(),
          getCommunities()
        ]);
        let statsData = null;
        try {
          statsData = await getPublicStats();
        } catch {
          statsData = null;
        }
        if (!active) {
          return;
        }
        setUser(me.user);
        setGoogleEnabled(Boolean(me.googleEnabled));
        setEvents(feed.events || []);
        setCommunities(communityData.communities || []);
        setPublicStats(statsData?.stats || null);
        if (me.user) {
          setAuthOpen(false);
        }

        if (me.user && me.user.role) {
          setDashboardLoading(true);
          setDashboardError('');
          try {
            const data = await fetchDashboardData(me.user.role);
            if (active) {
              setDashboard(data);
            }
          } catch (err) {
            if (active) {
              setDashboardError(err.message);
            }
          } finally {
            if (active) {
              setDashboardLoading(false);
            }
          }
        } else {
          setDashboard(null);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      if (activeTab === 'events') {
        if (showCreateEvent) {
          return;
        }
        getFeed({
          q: typeof query === 'string' ? query.trim() : '',
          sport: filters.sport,
          region: filters.region,
          startDate: filters.startDate,
          endDate: filters.endDate
        })
          .then((data) =>
            setNearbyEventsData((prev) => {
              const next = data.events || [];
              return isSameListById(prev, next) ? prev : next;
            })
          )
          .catch(() => {});
      } else if (activeTab === 'community') {
        if (showCreateCommunity) {
          return;
        }
        getCommunities()
          .then((data) =>
            setNearbyCommunitiesData((prev) => {
              const next = data.communities || [];
              return isSameListById(prev, next) ? prev : next;
            })
          )
          .catch(() => {});
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [activeTab, query, filters, showCreateEvent, showCreateCommunity, location.pathname]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    setNotice('');
    setError('');
    setCommunityNotice('');
    setCommunityError('');
    await loadEvents({ query: trimmed });
  };

  const handleClearSearch = async () => {
    setQuery('');
    setNotice('');
    setError('');
    setCommunityNotice('');
    setCommunityError('');
    await loadEvents({ query: '' });
  };

  const handleApplyFilters = async (event) => {
    event.preventDefault();
    setNotice('');
    await loadEvents();
  };

  const handleResetFilters = async () => {
    const cleared = { sport: '', region: '', startDate: '', endDate: '' };
    setFilters(cleared);
    setQuery('');
    setNotice('');
    await loadEvents({ query: '', filters: cleared });
  };

  const handleCommunitySearch = async () => {
    setCommunityNotice('');
    setCommunityError('');
    await loadCommunities({ silent: true });
  };

  const handleCreateEvent = async (payload) => {
    setNotice('');
    setError('');
    const result = await createEvent(payload);
    const createdSport = typeof result?.event?.sport === 'string' ? result.event.sport.trim() : '';
    if (createdSport) {
      setUser((prev) => {
        if (!prev) {
          return prev;
        }
        const nextInterests = appendSportToInterestList(prev.interests, createdSport);
        const currentInterests = typeof prev.interests === 'string' ? prev.interests : '';
        if (nextInterests === currentInterests) {
          return prev;
        }
        return { ...prev, interests: nextInterests };
      });
    }
    setNotice(`Created ${result.event.title}.`);
    await loadEvents({ query: query.trim() });
    if (user && user.role) {
      await loadDashboard(user.role);
    }
    setShowCreateEvent(false);
  };

  const handleCreateCommunity = async (event) => {
    event.preventDefault();
    setCommunityError('');
    setCommunityNotice('');

    try {
      const payload = {
        name: communityForm.name.trim(),
        description: communityForm.description.trim(),
        sport: communityForm.sport.trim(),
        region: communityForm.region.trim(),
        image_url: communityForm.image_url.trim(),
        max_members: communityForm.max_members,
        visibility: communityForm.visibility
      };
      const data = await createCommunity(payload);
      setCommunities((prev) => [data.community, ...prev]);
      setNearbyCommunitiesData((prev) => [data.community, ...prev]);
      setCommunityForm({
        name: '',
        description: '',
        sport: '',
        region: '',
        image_url: '',
        max_members: '',
        visibility: 'public'
      });
      setCommunityImageError('');
      setCommunityNotice('Community created.');
      setShowCreateCommunity(false);
    } catch (err) {
      setCommunityError(err.message);
    }
  };

  const handleCommunityImageChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setCommunityImageError('Please select an image file.');
      return;
    }
    setCommunityImageError('');
    const reader = new FileReader();
    reader.onload = () => {
      setCommunityForm((prev) => ({ ...prev, image_url: String(reader.result) }));
    };
    reader.onerror = () => {
      setCommunityImageError('Failed to read image.');
    };
    reader.readAsDataURL(file);
  };

  const handleToggleRsvp = async (eventId, isGoing) => {
    setNotice('');
    setError('');

    try {
      await toggleRsvp(eventId, isGoing);
      setEvents((prev) =>
        prev.map((event) => {
          if (event.id !== eventId) {
            return event;
          }
          const currentCount = Number(event.rsvp_count) || 0;
          return {
            ...event,
            is_going: !isGoing,
            rsvp_count: currentCount + (isGoing ? -1 : 1)
          };
        })
      );
      if (user && user.role) {
        await loadDashboard(user.role);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setDashboard(null);
      setDashboardError('');
      setAuthOpen(false);
      await loadEvents({ query: query.trim() });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegister = async (payload) => {
    setNotice('');
    setError('');
    await registerUser(payload);
    await refreshSession();
  };

  const handleLogin = async (payload) => {
    setNotice('');
    setError('');
    await loginUser(payload);
    await refreshSession();
  };

  const handleDeleteEvent = async (event) => {
    if (!event || !event.id) {
      return;
    }

    const confirmed = window.confirm(`Remove "${event.title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDashboardError('');
    try {
      await deleteEvent(event.id);
      setEvents((prev) => prev.filter((item) => item.id !== event.id));
      setDashboard((prev) => {
        if (!prev) {
          return prev;
        }
        const next = { ...prev };
        if (next.recentEvents) {
          next.recentEvents = next.recentEvents.filter((item) => item.id !== event.id);
        }
        if (next.adminStats) {
          const nextStats = { ...next.adminStats };
          const currentEvents = Number(nextStats.events) || 0;
          nextStats.events = Math.max(currentEvents - 1, 0);
          const rsvpDelta = Number(event.rsvp_count) || 0;
          if (rsvpDelta) {
            const currentRsvps = Number(nextStats.rsvps) || 0;
            nextStats.rsvps = Math.max(currentRsvps - rsvpDelta, 0);
          }
          next.adminStats = nextStats;
        }
        return next;
      });
    } catch (err) {
      setDashboardError(err.message);
    }
  };

  const handleUpdateUserRole = async (userId, role) => {
    setDashboardError('');

    try {
      await updateUserRole(userId, role);

      if (user && user.id === userId) {
        const updatedUser = { ...user, role };
        setUser(updatedUser);
        await loadDashboard(role);
        return;
      }

      setDashboard((prev) => {
        if (!prev) {
          return prev;
        }

        const roleMap = { admin: 'admins', superadmin: 'superadmins' };
        const findExistingRole = () => {
          const list = prev.users || prev.recentUsers || [];
          const match = list.find((item) => item.id === userId);
          return match ? match.role : null;
        };

        const previousRole = findExistingRole();
        const next = { ...prev };

        if (next.users) {
          next.users = next.users.map((member) =>
            member.id === userId ? { ...member, role } : member
          );
        }
        if (next.recentUsers) {
          next.recentUsers = next.recentUsers.map((member) =>
            member.id === userId ? { ...member, role } : member
          );
        }

        if (next.adminStats && previousRole && previousRole !== role) {
          const nextStats = { ...next.adminStats };
          const prevKey = roleMap[previousRole];
          const nextKey = roleMap[role];
          if (prevKey) {
            const prevCount = Number(nextStats[prevKey]) || 0;
            nextStats[prevKey] = Math.max(prevCount - 1, 0);
          }
          if (nextKey) {
            const nextCount = Number(nextStats[nextKey]) || 0;
            nextStats[nextKey] = nextCount + 1;
          }
          next.adminStats = nextStats;
        }

        return next;
      });
    } catch (err) {
      setDashboardError(err.message);
    }
  };

  const ProfilePage = () => {
    const INTEREST_OPTIONS = useMemo(() => {
      const unique = new Map();
      const addInterest = (value) => {
        const label = String(value || '').trim();
        if (!label) {
          return;
        }
        const key = label.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, label);
        }
      };

      SPORT_OPTIONS.forEach(addInterest);
      events.forEach((event) => addInterest(event.sport));
      communities.forEach((community) => addInterest(community.sport));
      parseInterestList(user?.interests).forEach(addInterest);

      return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
    }, [events, communities, user]);
    const [form, setForm] = useState({
      name: user?.name || '',
      email: user?.email || '',
      avatar_url: user?.avatar_url || '',
      interests: user?.interests || '',
      location: user?.location || '',
      bio: user?.bio || '',
      language: user?.language || '',
      timezone: user?.timezone || '',
      instagram: user?.instagram || '',
      twitter: user?.twitter || '',
      facebook: user?.facebook || '',
      linkedin: user?.linkedin || '',
      privacy_profile: user?.privacy_profile || 'public',
      privacy_contact: user?.privacy_contact || 'members',
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
    const readActiveSection = () => {
      if (typeof window === 'undefined') {
        return 'edit';
      }
      const stored = window.sessionStorage.getItem('profileActiveSection');
      return stored || 'edit';
    };
    const [activeSection, setActiveSection] = useState(readActiveSection);
    const [imageError, setImageError] = useState('');
    const [interestSearch, setInterestSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [rsvpHistory, setRsvpHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');

    useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }
      window.sessionStorage.setItem('profileActiveSection', activeSection);
    }, [activeSection]);

    useEffect(() => {
      setForm({
        name: user?.name || '',
        email: user?.email || '',
        avatar_url: user?.avatar_url || '',
        interests: user?.interests || '',
        location: user?.location || '',
        bio: user?.bio || '',
        language: user?.language || '',
        timezone: user?.timezone || '',
        instagram: user?.instagram || '',
        twitter: user?.twitter || '',
        facebook: user?.facebook || '',
        linkedin: user?.linkedin || '',
        privacy_profile: user?.privacy_profile || 'public',
        privacy_contact: user?.privacy_contact || 'members',
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    }, [user]);

    useEffect(() => {
      if (!user || activeSection !== 'rsvp-history') {
        return;
      }
      let active = true;
      setHistoryLoading(true);
      setHistoryError('');
      getUserRsvpHistory(300)
        .then((data) => {
          if (active) {
            setRsvpHistory(data.events || []);
          }
        })
        .catch((err) => {
          if (active) {
            setHistoryError(err.message);
          }
        })
        .finally(() => {
          if (active) {
            setHistoryLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [activeSection, user]);

    const interestsArray = Array.isArray(form.interests)
      ? form.interests
      : form.interests
        ? form.interests.split(',').map((item) => item.trim()).filter(Boolean)
        : [];

    const toggleInterest = (value) => {
      setForm((prev) => {
        const current = Array.isArray(prev.interests)
          ? prev.interests
          : prev.interests
            ? prev.interests.split(',').map((item) => item.trim()).filter(Boolean)
            : [];
        const next = current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value];
        return { ...prev, interests: next };
      });
    };

    const handleProfileImageChange = (event) => {
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
        setForm((prev) => ({ ...prev, avatar_url: String(reader.result) }));
      };
      reader.onerror = () => {
        setImageError('Failed to read image.');
      };
      reader.readAsDataURL(file);
    };

    const handleSubmit = async (event) => {
      event.preventDefault();
      setProfileError('');
      setProfileToast(null);
      setSaving(true);
      try {
        const interestString = Array.isArray(form.interests)
          ? form.interests.join(', ')
          : form.interests;
        const data = await updateProfile({
          name: form.name.trim(),
          email: form.email.trim(),
          avatar_url: form.avatar_url.trim(),
          interests: interestString.trim(),
          location: form.location.trim(),
          bio: form.bio.trim(),
          language: form.language.trim(),
          timezone: form.timezone.trim(),
          instagram: form.instagram.trim(),
          twitter: form.twitter.trim(),
          facebook: form.facebook.trim(),
          linkedin: form.linkedin.trim(),
          privacy_profile: form.privacy_profile,
          privacy_contact: form.privacy_contact,
          current_password: form.current_password.trim(),
          new_password: form.new_password.trim(),
          confirm_password: form.confirm_password.trim()
        });
        setUser(data.user);
        setForm((prev) => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
        setProfileToast({ type: 'success', message: 'Changes made' });
      } catch (err) {
        setProfileError(err.message);
        setProfileToast({ type: 'error', message: 'Failed to save changes' });
      } finally {
        setSaving(false);
      }
    };

    if (!user) {
      return (
        <section className="section">
          <div className="empty-state">Log in to edit your profile.</div>
        </section>
      );
    }

    return (
      <section className="section profile-page">
        {profileToast ? (
          <div className={`toast toast--${profileToast.type}`} role="status">
            {profileToast.message}
          </div>
        ) : null}
        <div className="section__header">
          <div>
            <h2>Edit profile</h2>
            <p>Keep your PlayNet profile details up to date.</p>
          </div>
        </div>
        <form className="profile-form profile-form--layout" onSubmit={handleSubmit}>
          <aside className="profile-sidebar">
            <button
              type="button"
              className={`profile-nav__item ${activeSection === 'edit' ? 'profile-nav__item--active' : ''}`}
              onClick={() => setActiveSection('edit')}
            >
              Edit profile
            </button>
            <button
              type="button"
              className={`profile-nav__item ${activeSection === 'account' ? 'profile-nav__item--active' : ''}`}
              onClick={() => setActiveSection('account')}
            >
              Account management
            </button>
            <button
              type="button"
              className={`profile-nav__item ${activeSection === 'privacy' ? 'profile-nav__item--active' : ''}`}
              onClick={() => setActiveSection('privacy')}
            >
              Privacy
            </button>
            <button
              type="button"
              className={`profile-nav__item ${activeSection === 'social' ? 'profile-nav__item--active' : ''}`}
              onClick={() => setActiveSection('social')}
            >
              Social media
            </button>
            <button
              type="button"
              className={`profile-nav__item ${activeSection === 'interests' ? 'profile-nav__item--active' : ''}`}
              onClick={() => setActiveSection('interests')}
            >
              Interests
            </button>
            <button
              type="button"
              className={`profile-nav__item ${activeSection === 'rsvp-history' ? 'profile-nav__item--active' : ''}`}
              onClick={() => setActiveSection('rsvp-history')}
            >
              RSVP history
            </button>
          </aside>

          <div className="profile-content">
            {activeSection === 'edit' ? (
              <div className="profile-section">
                <h3>Edit profile</h3>
                <p>Update your public details.</p>
                <div className="profile-form__grid profile-form__grid--stacked">
                  <div className="image-upload image-upload--round profile-form__full">
                    <span className="image-upload__label">User photo</span>
                    <label className="image-upload__box">
                      {form.avatar_url ? (
                        <img src={form.avatar_url} alt={form.name || 'Profile'} />
                      ) : (
                        <div className="image-upload__placeholder">+</div>
                      )}
                      <input type="file" accept="image/*" onChange={handleProfileImageChange} />
                    </label>
                    {imageError ? <div className="form-error">{imageError}</div> : null}
                  </div>
                  <label>
                    Full name
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="profile-form__full">
                    Location
                    <input
                      type="text"
                      value={form.location}
                      onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="City, Country"
                    />
                  </label>
                  <label className="profile-form__full">
                    Bio
                    <textarea
                      rows="3"
                      value={form.bio}
                      onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                      placeholder="Tell others about your play style."
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeSection === 'account' ? (
              <div className="profile-section">
                <h3>Account management</h3>
                <p>Update your account settings.</p>
                <div className="profile-form__grid profile-form__grid--stacked">
                  <label>
                    Your email
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Language
                    <input
                      type="text"
                      value={form.language}
                      onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))}
                      placeholder="English"
                    />
                  </label>
                  <label>
                    Time zone
                    <input
                      type="text"
                      value={form.timezone}
                      onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                      placeholder="GMT+8"
                    />
                  </label>
                  <label>
                    Current password
                    <input
                      type="password"
                      value={form.current_password}
                      onChange={(event) => setForm((prev) => ({ ...prev, current_password: event.target.value }))}
                      placeholder="Current password"
                    />
                  </label>
                  <label>
                    New password
                    <input
                      type="password"
                      value={form.new_password}
                      onChange={(event) => setForm((prev) => ({ ...prev, new_password: event.target.value }))}
                      placeholder="At least 8 characters"
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input
                      type="password"
                      value={form.confirm_password}
                      onChange={(event) => setForm((prev) => ({ ...prev, confirm_password: event.target.value }))}
                      placeholder="Re-enter new password"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeSection === 'privacy' ? (
              <div className="profile-section">
                <h3>Privacy</h3>
                <p>Control what others can see and how they contact you.</p>
                <div className="privacy-grid">
                  <div className="privacy-card">
                    <div className="privacy-card__title">Public profile</div>
                    <p>Choose who can see your profile, interests, and activity.</p>
                    <label className="privacy-option">
                      <input
                        type="radio"
                        name="privacy_profile"
                        value="public"
                        checked={form.privacy_profile === 'public'}
                        onChange={(event) => setForm((prev) => ({ ...prev, privacy_profile: event.target.value }))}
                      />
                      <span>
                        <strong>Public</strong>
                        <small>Anyone can view your profile.</small>
                      </span>
                    </label>
                    <label className="privacy-option">
                      <input
                        type="radio"
                        name="privacy_profile"
                        value="private"
                        checked={form.privacy_profile === 'private'}
                        onChange={(event) => setForm((prev) => ({ ...prev, privacy_profile: event.target.value }))}
                      />
                      <span>
                        <strong>Private</strong>
                        <small>Only members you join can see you.</small>
                      </span>
                    </label>
                  </div>
                  <div className="privacy-card">
                    <div className="privacy-card__title">Contact settings</div>
                    <p>Decide who can message or reach out to you.</p>
                    <label className="privacy-option">
                      <input
                        type="radio"
                        name="privacy_contact"
                        value="everyone"
                        checked={form.privacy_contact === 'everyone'}
                        onChange={(event) => setForm((prev) => ({ ...prev, privacy_contact: event.target.value }))}
                      />
                      <span>
                        <strong>Everyone</strong>
                        <small>Allow any user to contact you.</small>
                      </span>
                    </label>
                    <label className="privacy-option">
                      <input
                        type="radio"
                        name="privacy_contact"
                        value="members"
                        checked={form.privacy_contact === 'members'}
                        onChange={(event) => setForm((prev) => ({ ...prev, privacy_contact: event.target.value }))}
                      />
                      <span>
                        <strong>Members only</strong>
                        <small>Only community members can contact you.</small>
                      </span>
                    </label>
                    <label className="privacy-option">
                      <input
                        type="radio"
                        name="privacy_contact"
                        value="no_one"
                        checked={form.privacy_contact === 'no_one'}
                        onChange={(event) => setForm((prev) => ({ ...prev, privacy_contact: event.target.value }))}
                      />
                      <span>
                        <strong>No one</strong>
                        <small>Hide contact options entirely.</small>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === 'social' ? (
              <div className="profile-section">
                <h3>Social media</h3>
                <p>Add your handles so people can follow your journey.</p>
                <div className="profile-form__grid profile-form__grid--stacked">
                  <label>
                    Instagram
                    <input
                      type="text"
                      value={form.instagram}
                      onChange={(event) => setForm((prev) => ({ ...prev, instagram: event.target.value }))}
                      placeholder="@handle"
                    />
                  </label>
                  <label>
                    Twitter / X
                    <input
                      type="text"
                      value={form.twitter}
                      onChange={(event) => setForm((prev) => ({ ...prev, twitter: event.target.value }))}
                      placeholder="@handle"
                    />
                  </label>
                  <label>
                    Facebook
                    <input
                      type="text"
                      value={form.facebook}
                      onChange={(event) => setForm((prev) => ({ ...prev, facebook: event.target.value }))}
                      placeholder="facebook.com/..."
                    />
                  </label>
                  <label>
                    LinkedIn
                    <input
                      type="text"
                      value={form.linkedin}
                      onChange={(event) => setForm((prev) => ({ ...prev, linkedin: event.target.value }))}
                      placeholder="linkedin.com/in/..."
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeSection === 'interests' ? (
              <div className="profile-section">
                <h3>Interests</h3>
                <p>Select interests to match with other athletes.</p>
                <div className="interest-toolbar">
                  <input
                    type="text"
                    value={interestSearch}
                    onChange={(event) => setInterestSearch(event.target.value)}
                    placeholder="Search interests"
                  />
                </div>
                <div className="interest-section">
                  <div className="interest-section__title">Selected interests</div>
                  {interestsArray.length ? (
                    <div className="interest-chips">
                      {interestsArray.map((interest) => (
                        <button
                          key={interest}
                          type="button"
                          className="interest-chip interest-chip--selected"
                          onClick={() => toggleInterest(interest)}
                        >
                          {interest} <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="chat__empty">No interests selected yet.</div>
                  )}
                </div>
                <div className="interest-section">
                  <div className="interest-section__title">All interests</div>
                  <div className="interest-grid">
                    {INTEREST_OPTIONS.filter((interest) =>
                      interest.toLowerCase().includes(interestSearch.trim().toLowerCase())
                    ).map((interest) => (
                      <button
                        key={interest}
                        type="button"
                        className={`interest-chip ${interestsArray.includes(interest) ? 'interest-chip--selected' : ''}`}
                        onClick={() => toggleInterest(interest)}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === 'rsvp-history' ? (
              <div className="profile-section">
                <h3>RSVP history</h3>
                <p>All events you have RSVP&apos;d to.</p>
                {historyLoading ? <div className="loading">Loading RSVP history...</div> : null}
                {historyError ? <div className="alert alert--error">{historyError}</div> : null}
                {!historyLoading && !historyError ? (
                  rsvpHistory.length ? (
                    <div className="profile-history-list">
                      {rsvpHistory.map((item) => {
                        const startLabel = item.start_time
                          ? new Date(item.start_time).toLocaleString()
                          : '';
                        return (
                          <button
                            key={`${item.id}-${item.rsvped_at || item.start_time || item.title}`}
                            type="button"
                            className="profile-history-item"
                            onClick={() => navigate(`/events/${item.id}`)}
                          >
                            <div className="profile-history-item__main">
                              <strong>{item.title}</strong>
                              <span>{item.sport || 'Event'}</span>
                            </div>
                            <div className="profile-history-item__meta">
                              <span>{stripLocationLabel(item.location) || 'No location'}</span>
                              <span>{startLabel}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="chat__empty">No RSVP history yet.</div>
                  )
                ) : null}
              </div>
            ) : null}

            {activeSection !== 'rsvp-history' ? (
              <div className="profile-actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                {profileError ? <div className="alert alert--error">{profileError}</div> : null}
              </div>
            ) : null}
          </div>
        </form>
      </section>
    );
  };

  const ResetPasswordPage = () => {
    const location = useLocation();
    const [token, setToken] = useState('');
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState('');
    const [resetError, setResetError] = useState('');
    const [saving, setSaving] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [resetLink, setResetLink] = useState('');

    useEffect(() => {
      const nextToken = new URLSearchParams(location.search).get('token') || '';
      setToken(nextToken);
    }, [location.search]);

    const handleRequest = async (event) => {
      event.preventDefault();
      setStatus('');
      setResetError('');
      setResetLink('');
      if (!email.trim()) {
        setResetError('Email is required.');
        return;
      }
      setRequesting(true);
      try {
        const data = await requestPasswordReset(email.trim());
        if (data && data.resetLink) {
          setResetLink(data.resetLink);
        }
        setStatus('If this email exists, a reset link has been sent.');
      } catch (err) {
        setResetError(err.message);
      } finally {
        setRequesting(false);
      }
    };

    const handleSubmit = async (event) => {
      event.preventDefault();
      setStatus('');
      setResetError('');
      if (!token) {
        setResetError('Reset token is required.');
        return;
      }
      setSaving(true);
      try {
        await resetPassword({ token, new_password: newPassword, confirm_password: confirmPassword });
        setStatus('Password updated. You can log in now.');
        setNewPassword('');
        setConfirmPassword('');
      } catch (err) {
        setResetError(err.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <section className="section section--reset">
        <div className="section__header">
          <div>
            <h2>Reset password</h2>
            <p>Request a reset link or set a new password.</p>
          </div>
        </div>

        {!token ? (
          <form className="event-form reset-form" onSubmit={handleRequest}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            {status ? <div className="alert alert--success">{status}</div> : null}
            {resetError ? <div className="alert alert--error">{resetError}</div> : null}
            {resetLink ? (
              <div className="alert alert--success">
                Reset link (dev):{' '}
                <a href={resetLink} target="_blank" rel="noreferrer">
                  Open reset page
                </a>
              </div>
            ) : null}
            <button type="submit" className="btn btn--primary" disabled={requesting}>
              {requesting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        ) : (
          <form className="event-form reset-form" onSubmit={handleSubmit}>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter new password"
                required
              />
            </label>
            {status ? <div className="alert alert--success">{status}</div> : null}
            {resetError ? <div className="alert alert--error">{resetError}</div> : null}
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </section>
    );
  };

  const getCommunityImageUrl = (community, placePhotoUrl = '', options = {}) => {
    const imageUrl = typeof community?.image_url === 'string' ? community.image_url.trim() : '';
    const baseImageFailed = Boolean(options.baseImageFailed);
    const customImage = imageUrl && !isStaticMapUrl(imageUrl) && !baseImageFailed ? imageUrl : '';
    return customImage || placePhotoUrl || getCommunitySportCoverUrl(community?.sport);
  };

  const EventDetailPage = () => {
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [loadingEvent, setLoadingEvent] = useState(true);
    const [eventError, setEventError] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState('');
    const [memberError, setMemberError] = useState('');
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [memberActionKey, setMemberActionKey] = useState('');
    const [draft, setDraft] = useState('');
    const [imageUploadError, setImageUploadError] = useState('');
    const [imageUploading, setImageUploading] = useState(false);
    const [placePhoto, setPlacePhoto] = useState(null);
    const [baseImageFailed, setBaseImageFailed] = useState(false);
    const [mapLoadFailed, setMapLoadFailed] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [editImageError, setEditImageError] = useState('');
    const [editForm, setEditForm] = useState({
      title: '',
      description: '',
      sport: '',
      location: '',
      image_url: '',
      start_time: '',
      end_time: '',
      capacity: ''
    });
    const mapRef = useRef(null);
    const imageInputRef = useRef(null);
    const [editLocationOptions, setEditLocationOptions] = useState([]);
    const [editLocationLoading, setEditLocationLoading] = useState(false);
    const editLocationDatalistId = useRef(`edit-location-${Math.random().toString(36).slice(2, 8)}`);

    useEffect(() => {
      let active = true;
      setLoadingEvent(true);
      setEventError('');

      (async () => {
        try {
          const res = await fetch(`${apiUrl}/api/events/${id}`, { credentials: 'include' });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload.error || `Request failed (${res.status})`);
          }
          const payload = await res.json();
          if (active) {
            setEvent(payload.event);
          }
        } catch (err) {
          if (active) {
            setEventError(err.message);
          }
        } finally {
          if (active) {
            setLoadingEvent(false);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [id]);

    useEffect(() => {
      if (!event) {
        return;
      }
      const formatDateTime = (value) => {
        if (!value) {
          return '';
        }
        const date = new Date(value);
        if (Number.isNaN(date.valueOf())) {
          return '';
        }
        const pad = (num) => String(num).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
          date.getHours()
        )}:${pad(date.getMinutes())}`;
      };

      setEditForm({
        title: event.title || '',
        description: event.description || '',
        sport: event.sport || '',
        location: stripLocationLabel(event.location || ''),
        image_url: event.image_url || '',
        start_time: formatDateTime(event.start_time),
        end_time: formatDateTime(event.end_time),
        capacity: event.capacity || ''
      });
    }, [event]);

    useEffect(() => {
      setBaseImageFailed(false);
    }, [event?.id, event?.image_url]);

    useEffect(() => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      if (!apiKey || !mapRef.current || !event) {
        return undefined;
      }
      setMapLoadFailed(false);
      const label = stripLocationLabel(event.location);
      const center = parseLatLng(event.location || '');
      if (!label && !center) {
        return undefined;
      }
      let cleanup = () => {};
      initGoogleMap(mapRef.current, apiKey, { center, locationLabel: label })
        .then((dispose) => {
          cleanup = dispose;
          setMapLoadFailed(false);
        })
        .catch(() => {
          setMapLoadFailed(true);
        });
      return () => cleanup();
    }, [event]);

    useEffect(() => {
      let active = true;
      if (!event) {
        setPlacePhoto(null);
        return () => {
          active = false;
        };
      }
      const locationLabel = stripLocationLabel(event.location);
      if (!locationLabel) {
        setPlacePhoto(null);
        return () => {
          active = false;
        };
      }
      const googleKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      getPlacePhotoFromBackend(locationLabel, { maxWidth: 900 })
        .then((result) => {
          if (result) {
            return result;
          }
          if (!googleKey) {
            return null;
          }
          return getPlacePhotoUrl(locationLabel, googleKey, { maxWidth: 900 });
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

      return () => {
        active = false;
      };
    }, [event]);

    useEffect(() => {
      if (!editOpen) {
        return;
      }
      const query = (editForm.location || '').trim();
      if (query.length < 3) {
        setEditLocationOptions([]);
        return;
      }
      let active = true;
      setEditLocationLoading(true);
      const timer = setTimeout(() => {
        searchOneMapLocations(query)
          .then((data) => {
            if (active) {
              setEditLocationOptions(data.results || []);
            }
          })
          .catch(() => {
            if (active) {
              setEditLocationOptions([]);
            }
          })
          .finally(() => {
            if (active) {
              setEditLocationLoading(false);
            }
          });
      }, 300);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [editForm.location, editOpen]);

    const buildLocationValue = (item) => {
      const label = item.BUILDING || item.SEARCHVAL || item.ADDRESS || 'Location';
      return label;
    };

    useEffect(() => {
      if (!event || !user) {
        return;
      }
      const isHostUser = user.id === event.host_id;
      const isGoingUser = Boolean(event.is_going);
      if (!isHostUser && !isGoingUser) {
        setChatMessages([]);
        setChatLoading(false);
        setChatError('');
        return;
      }
      let active = true;
      setChatLoading(true);
      setChatError('');
      getEventMessages(event.id)
        .then((data) => {
          if (active) {
            setChatMessages(data.messages || []);
          }
        })
        .catch(() => {
          if (active) {
            setChatError('Chat is available after you RSVP.');
          }
        })
        .finally(() => {
          if (active) {
            setChatLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [event, user]);

    useEffect(() => {
      if (!event || !user || user.id !== event.host_id) {
        setMembers([]);
        setMembersLoading(false);
        setMemberError('');
        return;
      }
      let active = true;
      setMembersLoading(true);
      setMemberError('');
      getEventMembers(event.id)
        .then((data) => {
          if (active) {
            setMembers(data.members || []);
          }
        })
        .catch((err) => {
          if (active) {
            setMemberError(err.message);
          }
        })
        .finally(() => {
          if (active) {
            setMembersLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [event, user]);

    const handleSend = async (eventForm) => {
      eventForm.preventDefault();
      const message = draft.trim();
      if (!message || !event) {
        return;
      }
      setDraft('');
      setChatError('');
      try {
        const data = await postEventMessage(event.id, message);
        setChatMessages((prev) => [...prev, data.message]);
      } catch (err) {
        setChatError(err.message);
      }
    };

    const handleEventMemberAction = async (memberId, action) => {
      if (!event || !memberId) {
        return;
      }
      const actionKey = `${action}-${memberId}`;
      setMemberActionKey(actionKey);
      setMemberError('');
      const hasMember = members.some((item) => Number(item.user_id) === Number(memberId));
      try {
        if (action === 'kick') {
          await kickEventMember(event.id, memberId);
        } else {
          await banEventMember(event.id, memberId);
        }
        setMembers((prev) => prev.filter((item) => Number(item.user_id) !== Number(memberId)));
        if (hasMember) {
          setEvent((prev) => {
            if (!prev) {
              return prev;
            }
            const currentCount = Number(prev.rsvp_count) || 0;
            return { ...prev, rsvp_count: Math.max(currentCount - 1, 0) };
          });
        }
      } catch (err) {
        setMemberError(err.message);
      } finally {
        setMemberActionKey('');
      }
    };

    const handleEditImageChange = (eventField) => {
      if ((editForm.location || '').trim()) {
        return;
      }
      const file = eventField.target.files && eventField.target.files[0];
      if (!file) {
        return;
      }
      if (!file.type.startsWith('image/')) {
        setEditImageError('Please select an image file.');
        return;
      }
      setEditImageError('');
      const reader = new FileReader();
      reader.onload = () => {
        setEditForm((prev) => ({ ...prev, image_url: String(reader.result) }));
      };
      reader.onerror = () => {
        setEditImageError('Failed to read image.');
      };
      reader.readAsDataURL(file);
    };

    const handleDetailImageChange = (eventField) => {
      const file = eventField.target.files && eventField.target.files[0];
      if (!file) {
        return;
      }
      if (!file.type.startsWith('image/')) {
        setImageUploadError('Please select an image file.');
        return;
      }
      setImageUploadError('');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          setImageUploading(true);
          const payload = { image_url: String(reader.result) };
          const data = await updateEvent(event.id, payload);
          setEvent(data.event);
        } catch (err) {
          setImageUploadError(err.message);
        } finally {
          setImageUploading(false);
        }
      };
      reader.onerror = () => {
        setImageUploadError('Failed to read image.');
      };
      reader.readAsDataURL(file);
      eventField.target.value = '';
    };

    const handleEditSubmit = async (eventForm) => {
      eventForm.preventDefault();
      if (!event) {
        return;
      }
      setEditSaving(true);
      setEventError('');
      try {
        const hasLocation = Boolean((editForm.location || '').trim());
        const payload = {
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          sport: editForm.sport.trim(),
          location: stripLocationLabel(editForm.location.trim()),
          image_url: hasLocation ? '' : editForm.image_url.trim(),
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          capacity: editForm.capacity
        };
        const data = await updateEvent(event.id, payload);
        setEvent(data.event);
        setEditOpen(false);
      } catch (err) {
        setEventError(err.message);
      } finally {
        setEditSaving(false);
      }
    };

    if (loadingEvent) {
      return (
        <section className="section">
          <div className="loading">Loading event...</div>
        </section>
      );
    }

    if (eventError) {
      return (
        <section className="section">
          <div className="alert alert--error">{eventError}</div>
        </section>
      );
    }

    if (!event) {
      return (
        <section className="section">
          <div className="empty-state">Event not found.</div>
        </section>
      );
    }

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
    const paxLabel = capacity ? `${rsvpCount}/${capacity}` : `${rsvpCount}`;
    const locationLabel = stripLocationLabel(event.location) || event.title;
    const hasLocation = Boolean(stripLocationLabel(event.location));
    const showMap = hasLocation && Boolean(import.meta.env.VITE_GOOGLE_MAPS_KEY) && !mapLoadFailed;
    const mapImageUrl = hasLocation ? buildMapImageUrl(event.location) : '';
    const embedMapUrl = hasLocation
      ? `https://www.google.com/maps?q=${encodeURIComponent(locationLabel)}&output=embed`
      : '';
    const showStaticMap = !showMap && Boolean(mapImageUrl);
    const baseImage = event.image_url && !isStaticMapUrl(event.image_url) ? event.image_url : '';
    const placePhotoUrl = placePhoto?.url || '';
    const attribution = placePhoto?.attribution || '';
    const leftImageUrl = (baseImageFailed ? '' : baseImage) || placePhotoUrl || '';
    const isHost = user && user.id === event.host_id;
    const isGoing = Boolean(event.is_going);
    const hostPrivacy = event.host_privacy_contact || 'members';
    const canMessageHost = Boolean(user && user.id !== event.host_id && hostPrivacy !== 'no_one');
    const editHasLocation = Boolean((editForm.location || '').trim());
    const editMapPreview = editHasLocation ? buildMapImageUrl(editForm.location) : '';

    return (
      <section className="section event-detail">
        <div className="event-detail__back">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
            Back to main page
          </button>
        </div>
        <div className="event-detail__content">
          <div className="event-detail__media">
            <div className="event-detail__image event-detail__image--upload">
              {leftImageUrl ? (
                <img
                  src={leftImageUrl}
                  alt={`${event.title} cover`}
                  onError={() => {
                    if (!baseImageFailed && baseImage && leftImageUrl === baseImage) {
                      setBaseImageFailed(true);
                      return;
                    }
                    setPlacePhoto(null);
                  }}
                />
              ) : (
                <div className="event-detail__image-placeholder">
                  <span>{event.sport || 'Event image'}</span>
                </div>
              )}
              {attribution ? (
                <div className="image-attribution" dangerouslySetInnerHTML={{ __html: attribution }} />
              ) : null}
              {isHost ? (
                <div className="event-detail__image-action">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleDetailImageChange}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                  >
                    {imageUploading ? 'Uploading...' : leftImageUrl ? 'Change image' : 'Upload image'}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="event-detail__image event-detail__image--map">
              {showMap ? (
                <div ref={mapRef} className="event-detail__map-frame" />
              ) : embedMapUrl ? (
                <iframe
                  className="event-detail__map-frame"
                  title={`${event.title} location map`}
                  src={embedMapUrl}
                  loading="lazy"
                />
              ) : showStaticMap ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLabel)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="event-detail__image-link"
                >
                  <img src={mapImageUrl} alt={`${event.title} location map`} />
                </a>
              ) : (
                <div className="event-detail__image-placeholder">
                  <span>Map</span>
                </div>
              )}
            </div>
          </div>
          {imageUploadError ? <div className="alert alert--error">{imageUploadError}</div> : null}
          <div className="event-detail__header">
            <span className="pill">{event.sport}</span>
            <h2>{event.title}</h2>
            <p className="event-detail__meta">
              {dateLabel} {timeLabel}{endLabel ? ` - ${endLabel}` : ''}
            </p>
            <div className="event-card__actions">
              {user ? (
                <button
                  type="button"
                  className={`btn ${event.is_going ? 'btn--ghost' : 'btn--primary'}`}
                  onClick={() => handleToggleRsvp(event.id, Boolean(event.is_going))}
                >
                  {event.is_going ? 'Cancel RSVP' : 'RSVP'}
                </button>
              ) : (
                <button type="button" className="btn btn--primary" onClick={() => setAuthOpen(true)}>
                  Log in to RSVP
                </button>
              )}
              {isHost ? (
                <button type="button" className="btn btn--ghost" onClick={() => setEditOpen(true)}>
                  Edit event
                </button>
              ) : null}
            </div>
            {isHost ? (
              null
            ) : null}
          </div>
          <div className="event-detail__grid">
            <div>
              <div className="event-card__label">Location</div>
              <div>{stripLocationLabel(event.location)}</div>
            </div>
            <div>
              <div className="event-card__label">Pax</div>
              <div>{paxLabel}</div>
            </div>
            <div>
              <div className="event-card__label">Host</div>
              <div className="host-row">
                <span>{event.host_name}</span>
                {canMessageHost ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => openMessageComposer({ id: event.host_id, name: event.host_name })}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v.2l8 5 8-5V7H4Zm16 10V9.6l-7.4 4.6a1 1 0 0 1-1.2 0L4 9.6V17h16Z" />
                    </svg>
                    Message
                  </button>
                ) : null}
              </div>
              {hostPrivacy === 'members' ? (
                <div className="privacy-hint">Members only</div>
              ) : null}
              {hostPrivacy === 'no_one' ? (
                <div className="privacy-hint">Messaging disabled</div>
              ) : null}
            </div>
          </div>
          <div className="event-detail__desc">
            <h3>About this event</h3>
            <p>{event.description || 'No description yet.'}</p>
          </div>
          {isHost ? (
            <div className="moderation">
              <div className="moderation__title">Manage attendees</div>
              {membersLoading ? <div className="loading">Loading attendees...</div> : null}
              {memberError ? <div className="alert alert--error">{memberError}</div> : null}
              {members.length ? (
                <div className="moderation__list">
                  {members.map((member) => {
                    const isCreatorMember = Number(member.user_id) === Number(event.host_id);
                    return (
                      <div className="moderation__item" key={member.user_id}>
                        <div>
                          <div className="moderation__name">{member.user_name}</div>
                          <div className="moderation__meta">{member.user_email}</div>
                        </div>
                        <div className="moderation__actions">
                          {isCreatorMember ? (
                            <span className="pill">Creator</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn--ghost btn--small"
                                onClick={() => handleEventMemberAction(member.user_id, 'kick')}
                                disabled={memberActionKey === `kick-${member.user_id}`}
                              >
                                {memberActionKey === `kick-${member.user_id}` ? 'Kicking...' : 'Kick'}
                              </button>
                              <button
                                type="button"
                                className="btn btn--danger btn--small"
                                onClick={() => handleEventMemberAction(member.user_id, 'ban')}
                                disabled={memberActionKey === `ban-${member.user_id}`}
                              >
                                {memberActionKey === `ban-${member.user_id}` ? 'Banning...' : 'Ban'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="chat__empty">No attendees to manage.</div>
              )}
            </div>
          ) : null}
        </div>
        <aside className="event-detail__chat">
          <h3>Event chat</h3>
          {!user ? (
            <div className="chat__locked">Log in to see event chat.</div>
          ) : !isHost && !isGoing ? (
            <div className="chat__locked">RSVP to unlock the chat.</div>
          ) : (
            <>
              {chatLoading ? <div className="loading">Loading chat...</div> : null}
              {chatError ? <div className="alert alert--error">{chatError}</div> : null}
              <div className="chat__list">
                {chatMessages.length ? (
                  chatMessages.map((item) => {
                    const isOwnMessage = user && item.user_id === user.id;
                    return (
                    <div
                      className={`chat__item ${isOwnMessage ? 'chat__item--own' : ''}`}
                      key={item.id}
                    >
                      <div className="chat__meta">
                        <strong>{item.user_name}</strong>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      <div className="chat__message">{item.message}</div>
                    </div>
                  );
                  })
                ) : (
                  <div className="chat__empty">No messages yet. Say hi to the group.</div>
                )}
              </div>
              <form className="chat__form" onSubmit={handleSend}>
                <input
                  type="text"
                  value={draft}
                  onChange={(eventField) => setDraft(eventField.target.value)}
                  placeholder="Send a message..."
                />
                <button type="submit" className="btn btn--primary">Send</button>
              </form>
            </>
          )}
        </aside>

        {editOpen ? (
          <div className="md-modal-backdrop md-modal-backdrop--fixed" role="presentation" onClick={() => setEditOpen(false)}>
            <div
              className="md-modal md-modal--tall"
              role="dialog"
              aria-modal="true"
              onClick={(eventForm) => eventForm.stopPropagation()}
            >
              <button
                type="button"
                className="md-modal__close"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
              >
                x
              </button>
              <h2>Edit event</h2>
              <p className="md-modal__lead">Update your event details.</p>
              <form className="event-form" onSubmit={handleEditSubmit}>
                <div className="event-form__row">
                  <label>
                    Event title
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(eventFormField) =>
                        setEditForm((prev) => ({ ...prev, title: eventFormField.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Sport
                    <input
                      type="text"
                      value={editForm.sport}
                      onChange={(eventFormField) =>
                        setEditForm((prev) => ({ ...prev, sport: eventFormField.target.value }))
                      }
                      required
                    />
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    rows="3"
                    value={editForm.description}
                    onChange={(eventFormField) =>
                      setEditForm((prev) => ({ ...prev, description: eventFormField.target.value }))
                    }
                  />
                </label>
                <div className="image-upload">
                  <span className="image-upload__label">Event image</span>
                  <label className={`image-upload__box ${editHasLocation ? 'image-upload__box--disabled' : ''}`}>
                    {editHasLocation ? (
                      editMapPreview ? (
                        <img src={editMapPreview} alt="Event location preview" />
                      ) : (
                        <div className="image-upload__placeholder">Map</div>
                      )
                    ) : editForm.image_url ? (
                      <img src={editForm.image_url} alt="Event preview" />
                    ) : (
                      <div className="image-upload__placeholder">+</div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={editHasLocation}
                      onChange={handleEditImageChange}
                    />
                  </label>
                  <div className="form-hint">
                    {editHasLocation
                      ? 'Image will be pulled from the selected location.'
                      : 'Upload a cover image if you do not have a location.'}
                  </div>
                  {editImageError ? <div className="form-error">{editImageError}</div> : null}
                </div>
                <div className="event-form__row">
                  <label>
                    Location
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(eventFormField) =>
                        setEditForm((prev) => ({ ...prev, location: eventFormField.target.value }))
                      }
                      required
                      list={editLocationDatalistId.current}
                    />
                    <datalist id={editLocationDatalistId.current}>
                      {editLocationOptions.map((item) => (
                        <option
                          key={item.SEARCHVAL + item.LATITUDE + item.LONGITUDE}
                          value={buildLocationValue(item)}
                        />
                      ))}
                    </datalist>
                    <div className="form-hint">
                      {editLocationLoading
                        ? 'Searching locations...'
                        : 'Pick a location from the dropdown to pin it on the map.'}
                    </div>
                  </label>
                  <label>
                    Max pax
                    <input
                      type="number"
                      min="1"
                      value={editForm.capacity}
                      onChange={(eventFormField) =>
                        setEditForm((prev) => ({ ...prev, capacity: eventFormField.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="event-form__row">
                  <label>
                    Start time
                    <input
                      type="datetime-local"
                      value={editForm.start_time}
                      onChange={(eventFormField) =>
                        setEditForm((prev) => ({ ...prev, start_time: eventFormField.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    End time
                    <input
                      type="datetime-local"
                      value={editForm.end_time}
                      onChange={(eventFormField) =>
                        setEditForm((prev) => ({ ...prev, end_time: eventFormField.target.value }))
                      }
                    />
                  </label>
                </div>
                <button type="submit" className="btn btn--primary" disabled={editSaving}>
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  const CommunityDetailPage = () => {
    const { id } = useParams();
    const [community, setCommunity] = useState(null);
    const [loadingCommunity, setLoadingCommunity] = useState(true);
    const [communityError, setCommunityError] = useState('');
    const [messages, setMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState('');
    const [draft, setDraft] = useState('');
    const [editOpen, setEditOpen] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [editImageError, setEditImageError] = useState('');
    const [editForm, setEditForm] = useState({
      name: '',
      description: '',
      sport: '',
      region: '',
      image_url: '',
      max_members: '',
      visibility: 'public'
    });
    const [requests, setRequests] = useState([]);
    const [requestLoading, setRequestLoading] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);
    const [invites, setInvites] = useState([]);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteError, setInviteError] = useState('');
    const [memberError, setMemberError] = useState('');
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [memberActionKey, setMemberActionKey] = useState('');
    const [memberRoleActionKey, setMemberRoleActionKey] = useState('');
    const [placePhoto, setPlacePhoto] = useState(null);
    const [baseImageFailed, setBaseImageFailed] = useState(false);
    const parseFlag = (value) =>
      value === true || value === 1 || value === '1' || value === 'true' || value === 't';
    const creatorMatchesUser = Boolean(
      user && community && Number(user.id) === Number(community.creator_id)
    );
    const isOwner = parseFlag(community?.is_owner) || creatorMatchesUser || community?.membership_role === 'owner';
    const isAdmin = parseFlag(community?.is_admin) || community?.membership_role === 'admin';
    const canEditCommunity = isOwner || isAdmin;
    const canManageRequests = isOwner || isAdmin;


    useEffect(() => {
      let active = true;
      setLoadingCommunity(true);
      setCommunityError('');
      getCommunity(id)
        .then((data) => {
          if (active) {
            setCommunity(data.community);
          }
        })
        .catch((err) => {
          if (active) {
            setCommunityError(err.message);
          }
        })
        .finally(() => {
          if (active) {
            setLoadingCommunity(false);
          }
        });
      return () => {
        active = false;
      };
    }, [id]);

    useEffect(() => {
      if (!community) {
        return;
      }
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
      setBaseImageFailed(false);
    }, [community?.id, community?.image_url]);

    useEffect(() => {
      let active = true;
      if (!community) {
        setPlacePhoto(null);
        return () => {
          active = false;
        };
      }

      const hasUsableCustomImage = Boolean(
        community.image_url && !isStaticMapUrl(community.image_url) && !baseImageFailed
      );
      if (hasUsableCustomImage) {
        setPlacePhoto(null);
        return () => {
          active = false;
        };
      }

      const photoQuery = [community.sport || community.name].filter(Boolean).join(' ').trim();
      if (!photoQuery) {
        setPlacePhoto(null);
        return () => {
          active = false;
        };
      }

      const googleKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      getPlacePhotoFromBackend(photoQuery, { maxWidth: 900 })
        .catch(() => null)
        .then((result) => {
          if (result || !googleKey) {
            return result || null;
          }
          return getPlacePhotoUrl(photoQuery, googleKey, { maxWidth: 900 }).catch(() => null);
        })
        .then((result) => {
          if (active) {
            setPlacePhoto(result || null);
          }
        });

      return () => {
        active = false;
      };
    }, [community, baseImageFailed]);

    useEffect(() => {
      if (!community || !user) {
        return;
      }
      const isMember = parseFlag(community.is_member);
      if (!isMember && !isOwner) {
        setMessages([]);
        setChatError('');
        setChatLoading(false);
        return;
      }
      let active = true;
      setChatLoading(true);
      setChatError('');
      getCommunityMessages(community.id)
        .then((data) => {
          if (active) {
            setMessages(data.messages || []);
          }
        })
        .catch(() => {
          if (active) {
            setChatError('Chat is available after you join.');
          }
        })
        .finally(() => {
          if (active) {
            setChatLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [community, user]);

    useEffect(() => {
      if (!community || !canManageRequests) {
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
        .catch(() => {})
        .finally(() => {
          if (active) {
            setRequestLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [community, canManageRequests]);

    useEffect(() => {
      if (!community || !isOwner) {
        setMembers([]);
        setMembersLoading(false);
        setMemberError('');
        return;
      }
      let active = true;
      setMembersLoading(true);
      setMemberError('');
      getCommunityMembers(community.id)
        .then((data) => {
          if (active) {
            setMembers(data.members || []);
          }
        })
        .catch((err) => {
          if (active) {
            setMemberError(err.message);
          }
        })
        .finally(() => {
          if (active) {
            setMembersLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [community, isOwner]);

    useEffect(() => {
      if (!community || !isOwner) {
        return;
      }
      let active = true;
      setInviteLoading(true);
      getCommunityInvites(community.id)
        .then((data) => {
          if (active) {
            setInvites(data.invites || []);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) {
            setInviteLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [community, isOwner]);

    const handleJoinLeaveCommunity = async () => {
      if (!community || !user) {
        return;
      }
      setJoinLoading(true);
      setCommunityError('');
      try {
        if (community.is_member) {
          await leaveCommunity(community.id);
          setCommunity((prev) =>
            prev &&
            {
              ...prev,
              is_member: 0,
              membership_status: 'none',
              member_count: Math.max((Number(prev.member_count) || 0) - 1, 0)
            }
          );
          applyCommunityMembershipStatus(community.id, 'none');
          setMessages([]);
        } else {
          const data = await joinCommunity(community.id);
          const nextStatus = data.status || (community.visibility === 'private' ? 'pending' : 'approved');
          const nextIsMember = nextStatus === 'approved';
          setCommunity((prev) =>
            prev &&
            {
              ...prev,
              membership_status: nextStatus,
              is_member: nextIsMember ? 1 : 0,
              member_count: nextIsMember
                ? (Number(prev.member_count) || 0) + (Number(prev.is_member) === 1 ? 0 : 1)
                : Number(prev.member_count) || 0
            }
          );
          applyCommunityMembershipStatus(community.id, nextStatus);
        }
      } catch (err) {
        setCommunityError(err.message);
      } finally {
        setJoinLoading(false);
      }
    };

    const handleAcceptInvite = async () => {
      if (!community || !community.invite_id) {
        return;
      }
      try {
        await acceptCommunityInvite(community.invite_id);
        const refreshed = await getCommunity(community.id);
        setCommunity(refreshed.community);
        mergeCommunityIntoCollections(refreshed.community);
      } catch (err) {
        setCommunityError(err.message);
      }
    };

    const handleDeclineInvite = async () => {
      if (!community || !community.invite_id) {
        return;
      }
      try {
        await declineCommunityInvite(community.invite_id);
        const refreshed = await getCommunity(community.id);
        setCommunity(refreshed.community);
        mergeCommunityIntoCollections(refreshed.community);
      } catch (err) {
        setCommunityError(err.message);
      }
    };

    const handleSendInvite = async (event) => {
      event.preventDefault();
      if (!community) {
        return;
      }
      const email = inviteEmail.trim().toLowerCase();
      if (!email) {
        setInviteError('Email is required.');
        return;
      }
      setInviteError('');
      try {
        await inviteCommunityMember(community.id, email);
        setInviteEmail('');
        const data = await getCommunityInvites(community.id);
        setInvites(data.invites || []);
      } catch (err) {
        setInviteError(err.message);
      }
    };

    const handleSendCommunityMessage = async (event) => {
      event.preventDefault();
      if (!community) {
        return;
      }
      const message = draft.trim();
      if (!message) {
        return;
      }
      setDraft('');
      setChatError('');
      try {
        const data = await postCommunityMessage(community.id, message);
        setMessages((prev) => [...prev, data.message]);
      } catch (err) {
        setChatError(err.message);
      }
    };

    const handleEditCommunityImageChange = (eventField) => {
      const file = eventField.target.files && eventField.target.files[0];
      if (!file) {
        return;
      }
      if (!file.type.startsWith('image/')) {
        setEditImageError('Please select an image file.');
        return;
      }
      setEditImageError('');
      const reader = new FileReader();
      reader.onload = () => {
        setEditForm((prev) => ({ ...prev, image_url: String(reader.result) }));
      };
      reader.onerror = () => {
        setEditImageError('Failed to read image.');
      };
      reader.readAsDataURL(file);
    };

    const handleEditCommunitySubmit = async (event) => {
      event.preventDefault();
      if (!community) {
        return;
      }
      setEditSaving(true);
      setCommunityError('');
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
        setCommunity(data.community);
        mergeCommunityIntoCollections(data.community);
        setEditOpen(false);
      } catch (err) {
        setCommunityError(err.message);
      } finally {
        setEditSaving(false);
      }
    };

    const handleApproveRequest = async (userId) => {
      if (!community) {
        return;
      }
      try {
        await approveCommunityRequest(community.id, userId);
        setRequests((prev) => prev.filter((item) => item.user_id !== userId));
      } catch (err) {
        setCommunityError(err.message);
      }
    };

    const handleRejectRequest = async (userId) => {
      if (!community) {
        return;
      }
      try {
        await rejectCommunityRequest(community.id, userId);
        setRequests((prev) => prev.filter((item) => item.user_id !== userId));
      } catch (err) {
        setCommunityError(err.message);
      }
    };

    const handleCommunityMemberAction = async (userId, action) => {
      if (!community) {
        return;
      }
      const actionKey = `${action}-${userId}`;
      setMemberActionKey(actionKey);
      setMemberError('');
      const hasMember = members.some((item) => Number(item.user_id) === Number(userId));
      try {
        if (action === 'kick') {
          await kickCommunityMember(community.id, userId);
        } else {
          await banCommunityMember(community.id, userId);
        }
        if (hasMember) {
          setMembers((prev) => prev.filter((item) => Number(item.user_id) !== Number(userId)));
          setCommunity((prev) => {
            if (!prev) {
              return prev;
            }
            const currentCount = Number(prev.member_count) || 0;
            return { ...prev, member_count: Math.max(currentCount - 1, 0) };
          });
          updateCommunityCollections(community.id, (item) => {
            const currentCount = Number(item.member_count) || 0;
            return { ...item, member_count: Math.max(currentCount - 1, 0) };
          });
        }
      } catch (err) {
        setMemberError(err.message);
      } finally {
        setMemberActionKey('');
      }
    };

    const handleUpdateMemberRole = async (userId, role) => {
      if (!community) {
        return;
      }
      const actionKey = `${role}-${userId}`;
      setMemberRoleActionKey(actionKey);
      setMemberError('');
      try {
        await updateCommunityMemberRole(community.id, userId, role);
        setMembers((prev) =>
          prev.map((item) =>
            Number(item.user_id) === Number(userId)
              ? { ...item, role }
              : item
          )
        );
      } catch (err) {
        setMemberError(err.message);
      } finally {
        setMemberRoleActionKey('');
      }
    };

    if (loadingCommunity) {
      return (
        <section className="section">
          <div className="loading">Loading community...</div>
        </section>
      );
    }

    if (communityError) {
      return (
        <section className="section">
          <div className="alert alert--error">{communityError}</div>
        </section>
      );
    }

    if (!community) {
      return (
        <section className="section">
          <div className="empty-state">Community not found.</div>
        </section>
      );
    }

    const membersLabel = community.max_members
      ? `${community.member_count || 0}/${community.max_members}`
      : `${community.member_count || 0}`;
    const placePhotoUrl = placePhoto?.url || '';
    const attribution = placePhoto?.attribution || '';
    const imageUrl = getCommunityImageUrl(community, placePhotoUrl, { baseImageFailed });
    const hasCustomImage = Boolean(
      community.image_url && !isStaticMapUrl(community.image_url) && !baseImageFailed
    );
    const isMember = parseFlag(community.is_member);
    const isPending = community.membership_status === 'pending';
    const isInviteOnly = community.visibility === 'invite';
    const ownerPrivacy = community.creator_privacy_contact || 'members';
    const canMessageOwner = Boolean(user && user.id !== community.creator_id && ownerPrivacy !== 'no_one');

    return (
      <section className="section event-detail">
        <div className="event-detail__back">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
            Back to main page
          </button>
        </div>
        <div className="event-detail__content">
          <div className="event-detail__image">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`${community.name} cover`}
                onError={() => {
                  if (hasCustomImage) {
                    setBaseImageFailed(true);
                    return;
                  }
                  setPlacePhoto(null);
                }}
              />
            ) : (
              <div className="event-card__image-placeholder">
                <span>{community.sport || 'Community'}</span>
              </div>
            )}
            {attribution ? (
              <div className="image-attribution" dangerouslySetInnerHTML={{ __html: attribution }} />
            ) : null}
          </div>
          <div className="event-detail__header">
            <span className="pill">{community.sport || 'Community'}</span>
            <h2>{community.name}</h2>
            <p className="event-detail__meta">{community.region || 'All regions'}</p>
            <div className="event-card__actions">
              {user && !isOwner ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleJoinLeaveCommunity}
                  disabled={joinLoading || isPending || (isInviteOnly && !community.invite_id && !isMember && !isOwner)}
                >
                  {isMember ? 'Leave' : isPending ? 'Requested' : isInviteOnly ? 'Invite only' : 'Join'}
                </button>
              ) : null}
              {canEditCommunity ? (
                <button type="button" className="btn btn--primary" onClick={() => setEditOpen(true)}>
                  Edit community
                </button>
              ) : null}
            </div>
          </div>
          <div className="event-detail__grid">
            <div>
              <div className="event-card__label">Members</div>
              <div>{membersLabel}</div>
            </div>
            <div>
              <div className="event-card__label">Visibility</div>
              <div>{community.visibility}</div>
            </div>
            <div>
              <div className="event-card__label">Creator</div>
              <div className="host-row">
                <span>{community.creator_name}</span>
                {canMessageOwner ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => openMessageComposer({ id: community.creator_id, name: community.creator_name })}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v.2l8 5 8-5V7H4Zm16 10V9.6l-7.4 4.6a1 1 0 0 1-1.2 0L4 9.6V17h16Z" />
                    </svg>
                    Message
                  </button>
                ) : null}
              </div>
              {ownerPrivacy === 'members' ? (
                <div className="privacy-hint">Members only</div>
              ) : null}
              {ownerPrivacy === 'no_one' ? (
                <div className="privacy-hint">Messaging disabled</div>
              ) : null}
            </div>
          </div>
          <div className="event-detail__desc">
            <h3>About this community</h3>
            <p>{community.description || 'No description yet.'}</p>
          </div>
          {isOwner ? (
            <div className="moderation">
              <div className="moderation__title">Manage members</div>
              {membersLoading ? <div className="loading">Loading members...</div> : null}
              {memberError ? <div className="alert alert--error">{memberError}</div> : null}
              {members.length ? (
                <div className="moderation__list">
                  {members.map((member) => {
                    const isCreatorMember =
                      Number(member.user_id) === Number(community.creator_id) || member.role === 'owner';
                    return (
                      <div className="moderation__item" key={member.user_id}>
                        <div>
                          <div className="moderation__name">{member.user_name}</div>
                          <div className="moderation__meta">
                            {member.user_email} {member.role ? `· ${member.role}` : ''}
                          </div>
                        </div>
                        <div className="moderation__actions">
                          {isCreatorMember ? (
                            <span className="pill">Creator</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn--ghost btn--small"
                                onClick={() =>
                                  handleUpdateMemberRole(
                                    member.user_id,
                                    member.role === 'admin' ? 'member' : 'admin'
                                  )
                                }
                                disabled={
                                  memberRoleActionKey === `admin-${member.user_id}` ||
                                  memberRoleActionKey === `member-${member.user_id}`
                                }
                              >
                                {memberRoleActionKey === `admin-${member.user_id}` ||
                                memberRoleActionKey === `member-${member.user_id}`
                                  ? 'Saving...'
                                  : member.role === 'admin'
                                    ? 'Set member'
                                    : 'Make admin'}
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--small"
                                onClick={() => handleCommunityMemberAction(member.user_id, 'kick')}
                                disabled={memberActionKey === `kick-${member.user_id}`}
                              >
                                {memberActionKey === `kick-${member.user_id}` ? 'Kicking...' : 'Kick'}
                              </button>
                              <button
                                type="button"
                                className="btn btn--danger btn--small"
                                onClick={() => handleCommunityMemberAction(member.user_id, 'ban')}
                                disabled={memberActionKey === `ban-${member.user_id}`}
                              >
                                {memberActionKey === `ban-${member.user_id}` ? 'Banning...' : 'Ban'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="chat__empty">No members to manage.</div>
              )}
            </div>
          ) : null}
        </div>
        <aside className="event-detail__chat">
          <h3>Community chat</h3>
          {!user ? (
            <div className="chat__locked">Log in to view the chat.</div>
          ) : !isMember && !isOwner ? (
            <div className="chat__locked">
              {isInviteOnly
                ? community.invite_id
                  ? 'You are invited. Accept to join the chat.'
                  : 'Invite only. Ask the admin for access.'
                : 'Join the community to view the chat.'}
              {community.invite_id ? (
                <div className="invite-actions">
                  <button type="button" className="btn btn--primary btn--small" onClick={handleAcceptInvite}>
                    Accept invite
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={handleDeclineInvite}>
                    Decline
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {chatLoading ? <div className="loading">Loading chat...</div> : null}
              {chatError ? <div className="alert alert--error">{chatError}</div> : null}
              <div className="chat__list">
                {messages.length ? (
                  messages.map((item) => {
                    const isOwnMessage = user && item.user_id === user.id;
                    return (
                      <div
                        className={`chat__item ${isOwnMessage ? 'chat__item--own' : ''}`}
                        key={item.id}
                      >
                        <div className="chat__meta">
                          <strong>{item.user_name}</strong>
                          <span>{new Date(item.created_at).toLocaleString()}</span>
                        </div>
                        <div className="chat__message">{item.message}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="chat__empty">No messages yet. Start the conversation.</div>
                )}
              </div>
              <form className="chat__form" onSubmit={handleSendCommunityMessage}>
                <input
                  type="text"
                  value={draft}
                  onChange={(eventField) => setDraft(eventField.target.value)}
                  placeholder="Send a message..."
                />
                <button type="submit" className="btn btn--primary">Send</button>
              </form>
            </>
          )}
        </aside>

        {canManageRequests ? (
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
                        onClick={() => handleRejectRequest(item.user_id)}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => handleApproveRequest(item.user_id)}
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

        {isOwner ? (
          <div className="moderation">
            <div className="moderation__title">Invites</div>
            <form className="invite-form" onSubmit={handleSendInvite}>
              <input
                type="email"
                value={inviteEmail}
                onChange={(eventField) => setInviteEmail(eventField.target.value)}
                placeholder="Invite by email"
              />
              <button type="submit" className="btn btn--primary btn--small">
                Send invite
              </button>
            </form>
            {inviteError ? <div className="alert alert--error">{inviteError}</div> : null}
            {inviteLoading ? <div className="loading">Loading invites...</div> : null}
            {invites.length ? (
              <div className="moderation__list">
                {invites.map((item) => (
                  <div className="moderation__item" key={item.id}>
                    <div>
                      <div className="moderation__name">{item.email}</div>
                      <div className="moderation__meta">{item.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="chat__empty">No invites yet.</div>
            )}
          </div>
        ) : null}

        {editOpen ? (
          <div className="md-modal-backdrop md-modal-backdrop--fixed" role="presentation" onClick={() => setEditOpen(false)}>
            <div
              className="md-modal md-modal--tall"
              role="dialog"
              aria-modal="true"
              onClick={(eventForm) => eventForm.stopPropagation()}
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
              {!isOwner ? (
                <div className="form-hint">Admin access: you can update sport, region, description, and image.</div>
              ) : null}
              <form className="community-form" onSubmit={handleEditCommunitySubmit}>
                <div className="image-upload">
                  <span className="image-upload__label">Community image</span>
                  <label className="image-upload__box">
                    {editForm.image_url ? (
                      <img src={editForm.image_url} alt="Community preview" />
                    ) : (
                      <div className="image-upload__placeholder">{community.sport || 'Community'}</div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditCommunityImageChange}
                    />
                  </label>
                  <div className="form-hint">
                    Upload a cover image (optional). If omitted, we’ll try to fetch one based on the sport.
                  </div>
                  {editImageError ? <div className="form-error">{editImageError}</div> : null}
                </div>
                <label>
                  Name
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(eventField) =>
                      setEditForm((prev) => ({ ...prev, name: eventField.target.value }))
                    }
                    disabled={!isOwner}
                    required
                  />
                </label>
                <label>
                  Sport
                  <input
                    type="text"
                    value={editForm.sport}
                    onChange={(eventField) =>
                      setEditForm((prev) => ({ ...prev, sport: eventField.target.value }))
                    }
                  />
                </label>
                <label>
                  Region
                  <input
                    type="text"
                    value={editForm.region}
                    onChange={(eventField) =>
                      setEditForm((prev) => ({ ...prev, region: eventField.target.value }))
                    }
                  />
                </label>
                <label>
                  Max members
                  <input
                    type="number"
                    min="1"
                    value={editForm.max_members}
                    onChange={(eventField) =>
                      setEditForm((prev) => ({ ...prev, max_members: eventField.target.value }))
                    }
                    disabled={!isOwner}
                  />
                </label>
                <label>
                  Visibility
                  <select
                    value={editForm.visibility}
                    onChange={(eventField) =>
                      setEditForm((prev) => ({ ...prev, visibility: eventField.target.value }))
                    }
                    disabled={!isOwner}
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
                    onChange={(eventField) =>
                      setEditForm((prev) => ({ ...prev, description: eventField.target.value }))
                    }
                  />
                </label>
                <button type="submit" className="btn btn--primary" disabled={editSaving}>
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  const HomePage = () => {
    const eventSource = nearbyEventsData.length ? nearbyEventsData : events;
    const eventsThisMonth = Number(publicStats?.events ?? 0);
    const sportsAvailable = Number(publicStats?.sports ?? SPORT_OPTIONS.length);
    const usersTotal = Number(publicStats?.users ?? 0);
    const regionValue = typeof filters.region === 'string' ? filters.region.trim() : '';
    const nearbyEvents = (regionValue
      ? eventSource.filter((event) =>
        event.location && event.location.toLowerCase().includes(regionValue.toLowerCase())
      )
      : eventSource
    ).slice(0, 3);
    const upcomingEvents = query ? events : events.slice(0, 5);
    const communityRegion = typeof communityFilters.region === 'string' ? communityFilters.region.trim() : '';
    const communitySearch = query.trim().toLowerCase();
    const communitySource = nearbyCommunitiesData.length ? nearbyCommunitiesData : communities;
    const filteredCommunities = communitySource.filter((community) => {
      if (communityFilters.sport && community.sport !== communityFilters.sport) {
        return false;
      }
      if (communityFilters.region && community.region !== communityFilters.region) {
        return false;
      }
      if (!communitySearch) {
        return true;
      }
      const haystack = `${community.name || ''} ${community.description || ''} ${community.sport || ''} ${
        community.region || ''
      }`.toLowerCase();
      return haystack.includes(communitySearch);
    });
    const nearbyCommunities = (communityRegion
      ? filteredCommunities.filter((community) =>
        community.region && community.region.toLowerCase().includes(communityRegion.toLowerCase())
      )
      : filteredCommunities
    ).slice(0, 3);
    const featuredCommunities = query ? filteredCommunities : filteredCommunities.slice(0, 8);

    const handleNearbyRegionChange = (event) => {
      const nextRegion = event.target.value;
      setFilters((prev) => ({ ...prev, region: nextRegion }));
      loadEvents({ filters: { region: nextRegion } });
    };

    const handleSportTabChange = (sport) => {
      setActiveSportTab(sport);
      setFilters((prev) => ({ ...prev, sport }));
      loadEvents({ filters: { sport } });
    };

    const handleCommunitySportTabChange = (sport) => {
      setCommunityActiveSportTab(sport);
      setCommunityFilters((prev) => ({ ...prev, sport }));
    };

    useEffect(() => {
      if (filters.sport !== activeSportTab) {
        setActiveSportTab(filters.sport || '');
      }
    }, [filters.sport, activeSportTab]);

    useEffect(() => {
      if (communityFilters.sport !== communityActiveSportTab) {
        setCommunityActiveSportTab(communityFilters.sport || '');
      }
    }, [communityFilters.sport, communityActiveSportTab]);

    return (
      <>
        {user ? (
          <Dashboard
            user={user}
            data={dashboard}
            loading={dashboardLoading}
            error={dashboardError}
            onDeleteEvent={handleDeleteEvent}
            onUpdateUserRole={handleUpdateUserRole}
            communityCount={communities.length}
            memberCommunityCount={communities.filter((item) => Number(item.is_member) === 1).length}
          />
        ) : null}

        <section className="section section--tabs">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${activeTab === 'events' ? 'tab--active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              Events
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'community' ? 'tab--active' : ''}`}
              onClick={() => setActiveTab('community')}
            >
              Community
            </button>
          </div>
        </section>

        {activeTab === 'events' ? (
          <>
        {!user ? (
          <section className="hero" id="home">
            <div className="hero__copy">
              <h1>Find your next game, meet your next team.</h1>
              <p className="hero__lead">
                PlayNet connects athletes, casual players, and coaches around meetups that feel as
                real as the people showing up. Host a run, join a pickup, build a crew.
              </p>
              <div className="hero__stats">
                <div>
                  <h3><CountUp className="stat-number" end={eventsThisMonth} /></h3>
                  <p>Local meetups this month</p>
                </div>
                <div>
                  <h3><CountUp className="stat-number" end={sportsAvailable} /> sports</h3>
                  <p>From futsal to pickleball</p>
                </div>
                <div>
                  <h3><CountUp className="stat-number" end={usersTotal} /></h3>
                  <p>Users signed up</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!user ? (
          <section className="section section--how">
            <div className="section__header">
              <div>
                <h2>How PlayNet works</h2>
                <p>Three simple steps to get on the court with the right crew.</p>
              </div>
            </div>
            <div className="steps-grid">
              <div className="step-card">
                <span className="step-number">01</span>
                <h4>Discover</h4>
                <p>Filter by sport, region, and date to find your next meetup.</p>
              </div>
              <div className="step-card">
                <span className="step-number">02</span>
                <h4>RSVP</h4>
                <p>Lock in your spot and see who else is joining the session.</p>
              </div>
              <div className="step-card">
                <span className="step-number">03</span>
                <h4>Show up</h4>
                <p>Play, connect, and keep your crew growing week after week.</p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="section section--nearby">
          <div className="section__header">
            <div>
              <h2>Events near you</h2>
              <p>
                {regionValue
                  ? `Showing events around ${regionValue}.`
                  : 'Pick a region to personalize nearby events.'}
              </p>
            </div>
            <div className="section__meta">
              {user ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setShowCreateEvent(true)}
                >
                  Create event
                </button>
              ) : null}
              <label className="inline-select">
                Region
                <select value={filters.region} onChange={handleNearbyRegionChange}>
                  <option value="">All regions</option>
                  {REGION_OPTIONS.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading nearby events...</div>
          ) : nearbyEvents.length ? (
            <div className="card-grid">
              {nearbyEvents.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={index}
                  canRsvp={Boolean(user)}
                  onToggleRsvp={handleToggleRsvp}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No nearby events yet. Try a different region or host a new meetup.
            </div>
          )}
        </section>

        {user && showCreateEvent ? (
        <div className="md-modal-backdrop md-modal-backdrop--fixed" role="presentation" onClick={() => setShowCreateEvent(false)}>
            <div
              className="md-modal md-modal--tall"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="md-modal__close"
                onClick={() => setShowCreateEvent(false)}
                aria-label="Close"
              >
                x
              </button>
              <h2>Create an event</h2>
              <p className="md-modal__lead">Post your run, scrimmage, or skills session in under a minute.</p>
              <EventForm onCreate={handleCreateEvent} disabled={false} />
            </div>
          </div>
        ) : null}

        <section className="section">
          <div className="section__header">
            <div>
              <h2>{query ? `Search results for "${query}"` : 'Upcoming meetups'}</h2>
              <p>{query ? 'Filtered across sport, location, and event titles.' : 'Fresh from the community.'}</p>
            </div>
            <div className="section__meta">
              <span>{events.length} events</span>
              <span>Updated just now</span>
            </div>
          </div>

          <div className="tabs tabs--compact">
            <button
              type="button"
              className={`tab ${activeSportTab === '' ? 'tab--active' : ''}`}
              onClick={() => handleSportTabChange('')}
            >
              All sports
            </button>
            {SPORT_OPTIONS.map((sport) => (
              <button
                key={sport}
                type="button"
                className={`tab ${activeSportTab === sport ? 'tab--active' : ''}`}
                onClick={() => handleSportTabChange(sport)}
              >
                {sport}
              </button>
            ))}
          </div>

          <div className="filter-row">
            <div className="filter-bar-inline">
              <div className="filter-field filter-field--inline">
                <div className="filter-field__label">Region</div>
                <select
                  value={filters.region}
                  onChange={(event) => setFilters((prev) => ({ ...prev, region: event.target.value }))}
                >
                  <option value="">All regions</option>
                  {REGION_OPTIONS.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
              <div className="date-range date-range--inline">
                <div className="date-range__label">Date period</div>
                <div className="date-range__inputs">
                  <label>
                    From
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                    />
                  </label>
                  <span className="date-range__divider">→</span>
                  <label>
                    To
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="filter-actions">
              <button type="button" className="btn btn--primary" onClick={handleApplyFilters}>
                Apply
              </button>
              <button type="button" className="btn btn--ghost" onClick={handleResetFilters}>
                Reset
              </button>
            </div>
          </div>

          {notice ? <div className="alert alert--success">{notice}</div> : null}
          {error ? <div className="alert alert--error">{error}</div> : null}

          {loading ? (
            <div className="loading">Loading events...</div>
          ) : upcomingEvents.length ? (
            <div
              className={`card-grid card-grid--row${upcomingEvents.length > 4 ? ' card-grid--scroll' : ''}`}
            >
              {upcomingEvents.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={index}
                  canRsvp={Boolean(user)}
                  onToggleRsvp={handleToggleRsvp}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No events yet. Try searching a different sport or host a new meetup.
            </div>
          )}
        </section>
        </>
        ) : null}

        {activeTab === 'community' ? (
          <>
            <section className="hero" id="community">
              <div className="hero__copy">
                <h1>Find your crew, build your community.</h1>
                <p className="hero__lead">
                  Discover clubs, groups, and local communities built around every sport and region.
                </p>
              </div>
            </section>

            <section className="section section--nearby">
              <div className="section__header">
                <div>
                  <h2>Community near you</h2>
                  <p>
                    {communityRegion
                      ? `Showing communities around ${communityRegion}.`
                      : 'Pick a region to personalize nearby communities.'}
                  </p>
                </div>
                <div className="section__meta">
                  {user ? (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setShowCreateCommunity(true)}
                    >
                      Create community
                    </button>
                  ) : null}
                  <label className="inline-select">
                    Region
                    <select
                      value={communityFilters.region}
                      onChange={(event) =>
                        setCommunityFilters((prev) => ({ ...prev, region: event.target.value }))
                      }
                    >
                      <option value="">All regions</option>
                      {REGION_OPTIONS.map((region) => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {communityLoading ? (
                <div className="loading">Loading communities...</div>
              ) : nearbyCommunities.length ? (
                <div className="card-grid">
                  {nearbyCommunities.map((community) => (
                    <CommunityCard
                      key={community.id}
                      community={community}
                      canPost={Boolean(user)}
                      onMembershipChange={applyCommunityMembershipStatus}
                      onCommunityUpdated={mergeCommunityIntoCollections}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  No communities yet. Try a different region or start one.
                </div>
              )}
            </section>

            <section className="section section--community">
              <div className="section__header">
                <div>
                  <h2>{query ? `Search results for "${query}"` : 'Discover communities'}</h2>
                  <p>{query ? 'Filtered by sport, region, and keywords.' : 'Fresh from the network.'}</p>
                </div>
                <div className="section__meta">
                  <span>{filteredCommunities.length} communities</span>
                  <span>Updated just now</span>
                </div>
              </div>

              <div className="tabs tabs--compact">
                <button
                  type="button"
                  className={`tab ${communityActiveSportTab === '' ? 'tab--active' : ''}`}
                  onClick={() => handleCommunitySportTabChange('')}
                >
                  All sports
                </button>
                {SPORT_OPTIONS.map((sport) => (
                  <button
                    key={sport}
                    type="button"
                    className={`tab ${communityActiveSportTab === sport ? 'tab--active' : ''}`}
                    onClick={() => handleCommunitySportTabChange(sport)}
                  >
                    {sport}
                  </button>
                ))}
              </div>

              <div className="filter-row">
                <div className="filter-field">
                  <div className="filter-field__label">Region</div>
                  <select
                    value={communityFilters.region}
                    onChange={(event) =>
                      setCommunityFilters((prev) => ({ ...prev, region: event.target.value }))
                    }
                  >
                    <option value="">All regions</option>
                    {REGION_OPTIONS.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-actions">
                  <button type="button" className="btn btn--primary" onClick={handleCommunitySearch}>
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setCommunityFilters({ sport: '', region: '' });
                      setQuery('');
                      setCommunityNotice('');
                      setCommunityError('');
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {communityNotice ? <div className="alert alert--success">{communityNotice}</div> : null}
              {communityError ? <div className="alert alert--error">{communityError}</div> : null}

              {communityLoading ? (
                <div className="loading">Loading communities...</div>
              ) : featuredCommunities.length ? (
                <div
                  className={`community-grid${featuredCommunities.length > 4 ? ' community-grid--scroll' : ''}`}
                >
                  {featuredCommunities.map((community) => (
                    <CommunityCard
                      key={community.id}
                      community={community}
                      canPost={Boolean(user)}
                      onMembershipChange={applyCommunityMembershipStatus}
                      onCommunityUpdated={mergeCommunityIntoCollections}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  No communities yet. Create one to start the conversation.
                </div>
              )}
            </section>
          </>
        ) : null}

        <section className="section section--testimonials">
          <div className="section__header">
            <div>
              <h2>What players are saying</h2>
              <p>Real stories from the PlayNet community.</p>
            </div>
          </div>
          <div className="testimonial-grid">
            <div className="testimonial-card">
              <p className="testimonial-quote">
                “I found a weekly futsal group in two days. PlayNet finally made it easy to play.”
              </p>
              <div className="testimonial-user">
                <span className="testimonial-name">Alyssa P.</span>
                <span className="testimonial-meta">Futsal • Downtown</span>
              </div>
            </div>
            <div className="testimonial-card">
              <p className="testimonial-quote">
                “Our running club doubled in size after we started hosting events here.”
              </p>
              <div className="testimonial-user">
                <span className="testimonial-name">Marcus R.</span>
                <span className="testimonial-meta">Running • North</span>
              </div>
            </div>
            <div className="testimonial-card">
              <p className="testimonial-quote">
                “The RSVP list keeps everything organized. No more overbooked courts.”
              </p>
              <div className="testimonial-user">
                <span className="testimonial-name">Jin L.</span>
                <span className="testimonial-meta">Tennis • East</span>
              </div>
            </div>
          </div>
        </section>

      </>
    );
  };

  const AboutPage = () => (
    <section className="section about-page" id="about">
      <div className="about-hero">
        <div className="about-hero__copy">
          <p className="eyebrow">About PlayNet</p>
          <h1>Build high-trust sports communities with clear data.</h1>
          <p>
            PlayNet helps athletes, coaches, and organizers discover sessions, manage attendance,
            and grow reliable local networks. Everything is built for consistency, performance, and
            recruiter-friendly visibility.
          </p>
          <div className="about-hero__actions">
            <button type="button" className="btn btn--primary" onClick={handleFooterCta}>
              Join PlayNet
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
              Start a group
            </button>
          </div>
        </div>
        <div className="about-hero__panel">
          <div className="about-panel__title">Community snapshot</div>
          <div className="stat-grid">
            <div className="stat-card">
              <CountUp className="stat-value" end={120} suffix="+" />
              <div className="stat-label">weekly sessions</div>
            </div>
            <div className="stat-card">
              <CountUp className="stat-value" end={35} />
              <div className="stat-label">sports tracked</div>
            </div>
            <div className="stat-card">
              <CountUp className="stat-value" end={50} suffix="+" />
              <div className="stat-label">local regions</div>
            </div>
            <div className="stat-card">
              <CountUp className="stat-value" end={92} suffix="%" />
              <div className="stat-label">show-up rate</div>
            </div>
          </div>
          <p className="about-panel__note">Snapshot reflects early access activity.</p>
        </div>
      </div>

      <div className="about-section">
        <div className="section__header">
          <div>
            <h2>What you can do on PlayNet</h2>
            <p>Find the right sessions, organize quickly, and keep performance visible.</p>
          </div>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <span className="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </span>
            <h4>Find sessions fast</h4>
            <p>Search by sport, level, and location to discover reliable meetups.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 7h16v10H4z" />
                <path d="M8 7V5h8v2" />
                <path d="M9 11h6" />
              </svg>
            </span>
            <h4>Host with structure</h4>
            <p>Set capacity, location, and time so every session runs on schedule.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 19V5h16v14" />
                <path d="M7 15h4v4H7z" />
                <path d="M13 9h4v10h-4z" />
              </svg>
            </span>
            <h4>Show performance</h4>
            <p>Track attendance and consistency so recruiters see real participation.</p>
          </div>
        </div>
      </div>

      <div className="about-section">
        <div className="section__header">
          <div>
            <h2>How PlayNet works</h2>
            <p>Simple steps to build momentum and keep teams connected.</p>
          </div>
        </div>
        <div className="steps-grid">
          <div className="step-card">
            <span className="step-number">01</span>
            <h4>Discover</h4>
            <p>Filter by sport, region, and date to find the right session.</p>
          </div>
          <div className="step-card">
            <span className="step-number">02</span>
            <h4>Confirm</h4>
            <p>RSVP to lock your spot and keep attendance accurate.</p>
          </div>
          <div className="step-card">
            <span className="step-number">03</span>
            <h4>Perform</h4>
            <p>Show up, compete, and build your reputation with every session.</p>
          </div>
        </div>
      </div>

      <div className="about-section">
        <div className="section__header">
          <div>
            <h2>Why teams trust PlayNet</h2>
            <p>Professional tools that keep sports communities consistent and transparent.</p>
          </div>
        </div>
        <div className="value-grid">
          <div className="value-card">
            <h4>Verified hosts</h4>
            <p>Profiles and event history give players confidence before they commit.</p>
          </div>
          <div className="value-card">
            <h4>Clear expectations</h4>
            <p>Level, format, and attendance rules are visible before you RSVP.</p>
          </div>
          <div className="value-card">
            <h4>Trackable impact</h4>
            <p>Attendance and consistency data help clubs and recruiters assess performance.</p>
          </div>
        </div>
      </div>

      <div className="about-cta">
        <div>
          <h2>Ready to build your next squad?</h2>
          <p>Join PlayNet and connect with athletes who show up and play hard.</p>
        </div>
        <div className="about-cta__actions">
          <button type="button" className="btn btn--primary" onClick={handleFooterCta}>
            Get started
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
            Browse events
          </button>
        </div>
      </div>
    </section>
  );

  const ContactPage = () => {
    const [sent, setSent] = useState(false);

    const handleSubmit = (event) => {
      event.preventDefault();
      setSent(true);
      event.currentTarget.reset();
    };

    return (
      <section className="section" id="contact">
        <div className="section__header">
          <div>
            <h2>Contact</h2>
            <p>Questions or partnerships? Reach the PlayNet team.</p>
          </div>
        </div>
        <div className="section__header">
          <div>
            <h3>Send us a message</h3>
            <p>We reply within 1-2 business days.</p>
          </div>
        </div>
        <div className="contact-layout">
          <div className="contact-form-wrapper">
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-form__row">
                <label>
                  Full name
                  <input type="text" name="name" autoComplete="name" required />
                </label>
                <label>
                  Email
                  <input type="email" name="email" autoComplete="email" required />
                </label>
              </div>
              <label>
                Subject
                <select name="subject" required>
                  <option value="">Select a topic</option>
                  <option value="Support">Community support</option>
                  <option value="Hosting">Hosting an event</option>
                  <option value="Partnerships">Partnerships</option>
                  <option value="Press">Press inquiry</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label>
                Message
                <textarea name="message" rows="5" required />
              </label>
              <button type="submit" className="btn btn--primary">
                Send message
              </button>
              {sent ? (
                <div className="alert alert--success" role="status">
                  Thanks! Your message has been sent.
                </div>
              ) : null}
            </form>
          </div>
          <div className="contact-grid">
            <div className="contact-card">
              <h4>Community support</h4>
              <div>support@matchday.local</div>
              <div>Mon to Fri, 9am to 5pm</div>
            </div>
            <div className="contact-card">
              <h4>Partnerships</h4>
              <div>teams@matchday.local</div>
              <div>Local clubs, facilities, and organizers</div>
            </div>
            <div className="contact-card">
              <h4>Press</h4>
              <div>press@matchday.local</div>
              <div>Story ideas and media requests</div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const MessagesPage = () => {
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [messagesError, setMessagesError] = useState('');

    useEffect(() => {
      if (!user) {
        return;
      }
      let active = true;
      setLoadingMessages(true);
      setMessagesError('');
      getInboxMessages({ limit: 50 })
        .then((data) => {
          if (active) {
            setMessages(data.messages || []);
          }
        })
        .catch((err) => {
          if (active) {
            setMessagesError(err.message);
          }
        })
        .finally(() => {
          if (active) {
            setLoadingMessages(false);
          }
        });

      return () => {
        active = false;
      };
    }, [user]);

    if (!user) {
      return (
        <section className="section">
          <div className="empty-state">Log in to view your messages.</div>
        </section>
      );
    }

    return (
      <section className="section">
        <div className="section__header">
          <div>
            <h2>Messages</h2>
            <p>Private messages from other members.</p>
          </div>
        </div>
        {loadingMessages ? <div className="loading">Loading messages...</div> : null}
        {messagesError ? <div className="alert alert--error">{messagesError}</div> : null}
        {messages.length ? (
          <div className="message-list">
            {messages.map((item) => (
              <div className="message-card" key={item.id}>
                <div className="message-card__avatar">
                  {item.sender_avatar ? (
                    <img src={item.sender_avatar} alt={item.sender_name} />
                  ) : (
                    <div className="message-card__initials">
                      {item.sender_name ? item.sender_name.split(' ').map((part) => part[0]).join('').slice(0, 2) : 'ME'}
                    </div>
                  )}
                </div>
                <div className="message-card__body">
                  <div className="message-card__meta">
                    <strong>{item.sender_name}</strong>
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <div className="message-card__text">{item.message}</div>
                </div>
                <div className="message-card__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => openMessageComposer({ id: item.sender_id, name: item.sender_name })}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v.2l8 5 8-5V7H4Zm16 10V9.6l-7.4 4.6a1 1 0 0 1-1.2 0L4 9.6V17h16Z" />
                    </svg>
                    Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No messages yet.</div>
        )}
      </section>
    );
  };

  const communitySportLabel = communityForm.sport.trim() || 'Community';
  const searchPlaceholder = activeTab === 'community'
    ? 'Search communities by sport, region, or keyword'
    : 'Search events by sport, location, or title';

  return (
    <div className="app">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenAuth={(mode = 'register') => {
          setAuthMode(mode);
          setAuthOpen(true);
        }}
        searchValue={query}
        onSearchChange={setQuery}
        onSearchSubmit={handleSearch}
        onSearchClear={handleClearSearch}
        searchPlaceholder={searchPlaceholder}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        apiUrl={apiUrl}
        googleEnabled={googleEnabled}
        onRegister={handleRegister}
        onLogin={handleLogin}
      />
      {activeTab === 'community' && user && showCreateCommunity ? (
        <div className="md-modal-backdrop md-modal-backdrop--fixed" role="presentation" onClick={() => setShowCreateCommunity(false)}>
            <div
              className="md-modal md-modal--tall"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
            <button
              type="button"
              className="md-modal__close"
              onClick={() => setShowCreateCommunity(false)}
              aria-label="Close"
            >
              x
            </button>
            <h2>Create a community</h2>
            <p className="md-modal__lead">Set up a space for your club or league.</p>
            <form className="community-form" onSubmit={handleCreateCommunity}>
              <div className="image-upload">
                <span className="image-upload__label">Community image</span>
                <label className="image-upload__box">
                  {communityForm.image_url ? (
                    <img src={communityForm.image_url} alt="Community preview" />
                  ) : (
                    <div className="image-upload__placeholder">{communitySportLabel}</div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCommunityImageChange}
                  />
                </label>
                <div className="form-hint">
                  Upload a cover image (optional). If omitted, we’ll try to fetch one based on the sport.
                </div>
                {communityImageError ? <div className="form-error">{communityImageError}</div> : null}
              </div>
              <label>
                Name
                <input
                  type="text"
                  value={communityForm.name}
                  onChange={(event) =>
                    setCommunityForm((prev) => ({ ...prev, name: capitalizeWords(event.target.value) }))
                  }
                  placeholder="Downtown Ballers"
                  required
                />
              </label>
              <label>
                Sport
                <input
                  type="text"
                  value={communityForm.sport}
                  onChange={(event) =>
                    setCommunityForm((prev) => ({ ...prev, sport: capitalizeWords(event.target.value) }))
                  }
                  placeholder="Basketball"
                />
              </label>
              <label>
                Region
                <input
                  type="text"
                  value={communityForm.region}
                  onChange={(event) =>
                    setCommunityForm((prev) => ({ ...prev, region: capitalizeWords(event.target.value) }))
                  }
                  placeholder="Downtown"
                />
              </label>
              <label>
                Max members
                <input
                  type="number"
                  min="1"
                  value={communityForm.max_members}
                  onChange={(event) =>
                    setCommunityForm((prev) => ({ ...prev, max_members: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </label>
              <label>
                Visibility
                <select
                  value={communityForm.visibility}
                  onChange={(event) =>
                    setCommunityForm((prev) => ({ ...prev, visibility: event.target.value }))
                  }
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
                  value={communityForm.description}
                  onChange={(event) =>
                    setCommunityForm((prev) => ({ ...prev, description: capitalizeWords(event.target.value) }))
                  }
                  placeholder="Who this community is for and what you do."
                />
              </label>
              <button type="submit" className="btn btn--primary">
                Create community
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {messageOpen && messageTarget ? (
        <div className="md-modal-backdrop md-modal-backdrop--fixed" role="presentation" onClick={closeMessageComposer}>
          <div
            className="md-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="md-modal__close"
              onClick={closeMessageComposer}
              aria-label="Close"
            >
              x
            </button>
            <h2>Message {messageTarget.name}</h2>
            <p className="md-modal__lead">Send a private message.</p>
            <form className="message-form" onSubmit={handleSendPrivateMessage}>
              <label>
                Message
                <textarea
                  rows="4"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder="Write your message..."
                  required
                />
              </label>
              {messageError ? <div className="alert alert--error">{messageError}</div> : null}
              {messageSuccess ? <div className="alert alert--success">{messageSuccess}</div> : null}
              <button type="submit" className="btn btn--primary" disabled={messageSending}>
                {messageSending ? 'Sending...' : 'Send message'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reset" element={<ResetPasswordPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/communities/:id" element={<CommunityDetailPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand">
            <div className="footer__title">PlayNet</div>
            <p>Built for local sports communities.</p>
            <div className="footer__meta">© {currentYear} PlayNet</div>
          </div>
          <div className="footer__actions">
            <button type="button" className="btn btn--primary" onClick={handleFooterCta}>
              Join the next meetup
            </button>
            <div className="footer__social">
              <a className="footer__social-link" href="#" aria-label="PlayNet on Instagram">
                <svg className="footer__social-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="5" />
                  <circle cx="12" cy="12" r="3.5" />
                  <circle cx="17.2" cy="6.8" r="1.2" />
                </svg>
                <span className="sr-only">Instagram</span>
              </a>
              <a className="footer__social-link" href="#" aria-label="PlayNet on TikTok">
                <svg className="footer__social-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 5c1 1.5 2.3 2.4 4 2.6v2.4c-1.7-.1-3.1-.7-4-1.6V16a4 4 0 1 1-4-4h1.5v2.3H10a1.7 1.7 0 1 0 1.7 1.7V5h2.3Z" />
                </svg>
                <span className="sr-only">TikTok</span>
              </a>
              <a className="footer__social-link" href="#" aria-label="PlayNet on YouTube">
                <svg className="footer__social-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="7" width="18" height="10" rx="3" />
                  <polygon points="11,9.5 16,12 11,14.5" />
                </svg>
                <span className="sr-only">YouTube</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
