function formatDateTime(value) {
  if (!value) {
    return 'TBD';
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function roleBadgeClass(role) {
  if (role === 'superadmin') {
    return 'role-badge role-badge--super';
  }
  if (role === 'admin') {
    return 'role-badge role-badge--admin';
  }
  return 'role-badge role-badge--user';
}

function Dashboard({
  user,
  data,
  loading,
  error,
  onDeleteEvent,
  onUpdateUserRole,
  communityCount = 0,
  memberCommunityCount = 0
}) {
  if (!user) {
    return null;
  }

  const role = (user.role || 'user').toLowerCase();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isSuperadmin = role === 'superadmin';

  const userStats = data && data.userStats ? data.userStats : {};
  const adminStats = data && data.adminStats ? data.adminStats : {};
  const showRecentUsers = isAdmin && data && Array.isArray(data.recentUsers);

  const renderEventList = (items, withAction) => {
    if (!items || !items.length) {
      return <div className="dash-empty">No events yet.</div>;
    }

    return (
      <ul className="dash-list">
        {items.map((event) => (
          <li key={event.id} className="dash-list__item">
            <div>
              <div className="dash-title">{event.title}</div>
              <div className="dash-meta">
                {event.sport} | {event.location ? event.location.replace(/\s*\([^)]*\)\s*$/, '') : ''} | {formatDateTime(event.start_time)}
              </div>
              <div className="dash-meta">RSVPs: {event.rsvp_count}</div>
            </div>
            {withAction ? (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => onDeleteEvent(event)}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    );
  };

  const renderUserList = (items) => {
    if (!items || !items.length) {
      return <div className="dash-empty">No recent users.</div>;
    }

    return (
      <ul className="dash-list">
        {items.map((member) => (
          <li key={member.id} className="dash-list__item">
            <div>
              <div className="dash-title">{member.name}</div>
              <div className="dash-meta">{member.email || 'No email'}</div>
            </div>
            <span className={roleBadgeClass(member.role)}>{member.role}</span>
          </li>
        ))}
      </ul>
    );
  };

  const renderRoleManager = (items) => {
    if (!items || !items.length) {
      return <div className="dash-empty">No users found.</div>;
    }

    return (
      <div className="dash-table">
        <div className="dash-table__row dash-table__header">
          <span>User</span>
          <span>Role</span>
          <span>Update role</span>
        </div>
        {items.map((member) => (
          <div key={member.id} className="dash-table__row">
            <div>
              <div className="dash-title">{member.name}</div>
              <div className="dash-meta">{member.email || 'No email'}</div>
            </div>
            <span className={roleBadgeClass(member.role)}>{member.role}</span>
            <select
              className="role-select"
              value={member.role}
              onChange={(event) => onUpdateUserRole(member.id, event.target.value)}
              aria-label={`Update role for ${member.name}`}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="section dashboard">
      <div className="section__header">
        <div>
          <h2>Dashboard</h2>
          <p>Manage your activity and access based on your role.</p>
        </div>
        <span className={roleBadgeClass(role)}>{role}</span>
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}

      {loading ? (
        <div className="loading">Loading dashboard...</div>
      ) : (
        <div className="dashboard-grid">
          <div className="dash-card">
            <h3>Your stats</h3>
            <div className="dash-stats">
              <div className="stat-card">
                <div className="stat-label">Hosted events</div>
                <div className="stat-value">{userStats.hosted || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">RSVPs</div>
                <div className="stat-value">{userStats.rsvps || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Your communities</div>
                <div className="stat-value">{memberCommunityCount}</div>
              </div>
              {isAdmin ? (
                <div className="stat-card">
                  <div className="stat-label">Total communities</div>
                  <div className="stat-value">{communityCount}</div>
                </div>
              ) : null}
              {isAdmin ? (
                <div className="stat-card">
                  <div className="stat-label">Total users</div>
                  <div className="stat-value">{adminStats.users || 0}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="dash-card">
            <h3>Hosted events</h3>
            {renderEventList(data ? data.hostedEvents : [], false)}
          </div>

          <div className="dash-card">
            <h3>Your RSVPs</h3>
            {renderEventList(data ? data.rsvpEvents : [], false)}
          </div>

          {isAdmin ? (
            <div className="dash-card dash-card--wide">
              <h3>Admin overview</h3>
              <div className="dash-stats dash-stats--wide">
                <div className="stat-card">
                  <div className="stat-label">Users</div>
                  <div className="stat-value">{adminStats.users || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Events</div>
                  <div className="stat-value">{adminStats.events || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">RSVPs</div>
                  <div className="stat-value">{adminStats.rsvps || 0}</div>
                </div>
              </div>
            </div>
          ) : null}

          {isAdmin ? (
            <div className="dash-card">
              <h3>Recent events</h3>
              {renderEventList(data ? data.recentEvents : [], true)}
            </div>
          ) : null}

          {showRecentUsers ? (
            <div className="dash-card">
              <h3>Recent users</h3>
              {renderUserList(data ? data.recentUsers : [])}
            </div>
          ) : null}

          {isSuperadmin ? (
            <div className="dash-card dash-card--wide">
              <h3>Role management</h3>
              {renderRoleManager(data ? data.users : [])}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default Dashboard;
