import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import SearchBar from './SearchBar.jsx';

const logoUrl = '/images/SportAppLogo.png';

function Navbar({
  user,
  onLogout,
  onOpenAuth,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  searchPlaceholder
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = user && user.name ? user.name.split(' ').map((part) => part[0]).join('').slice(0, 2) : '';
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="nav">
      <div className="nav__inner">
        <Link className="nav__brand" to="/" onClick={closeMenu} aria-label="Go to homepage">
          <div className="nav__brand-main">
            <img className="nav__logo-mark" src={logoUrl} alt="PlayNet logo" />
            <span className="nav__logo">PlayNet</span>
          </div>
          <span className="nav__tag">Connect. Share. Grow.</span>
        </Link>
        <button
          type="button"
          className="nav__toggle"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav__toggle-bar" />
          <span className="nav__toggle-bar" />
          <span className="nav__toggle-bar" />
        </button>
        <div className="nav__search">
          <SearchBar
            value={searchValue}
            onChange={onSearchChange}
            onSubmit={onSearchSubmit}
            onClear={onSearchClear}
            placeholder={searchPlaceholder}
          />
        </div>
        <div className={`nav__panel ${menuOpen ? 'nav__panel--open' : ''}`} id="primary-nav">
          <nav className="nav__links" aria-label="Primary">
            <NavLink
              to="/"
              onClick={closeMenu}
              className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
            >
              <span className="nav__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z" />
                </svg>
              </span>
              <span className="nav__label">Home</span>
            </NavLink>
            <NavLink
              to="/about"
              onClick={closeMenu}
              className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
            >
              <span className="nav__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20a7 7 0 0 1 14 0" />
                </svg>
              </span>
              <span className="nav__label">About</span>
            </NavLink>
            <NavLink
              to="/contact"
              onClick={closeMenu}
              className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
            >
              <span className="nav__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7.6 4h2.3l.7 3.2-1.6 1.3a11 11 0 0 0 5.1 5.1l1.3-1.6 3.2.7v2.3c0 1-0.8 1.9-1.9 2-6.7.5-12.2-5-11.7-11.7C5.1 4.8 6.1 4 7.6 4Z" />
                </svg>
              </span>
              <span className="nav__label">Contact</span>
            </NavLink>
            {user ? (
              <NavLink
                to="/messages"
                onClick={closeMenu}
                className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
              >
                <span className="nav__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v.2l8 5 8-5V7H4Zm16 10V9.6l-7.4 4.6a1 1 0 0 1-1.2 0L4 9.6V17h16Z" />
                  </svg>
                </span>
                <span className="nav__label">Messages</span>
              </NavLink>
            ) : null}
          </nav>
          <div className="nav__actions">
            {user ? (
              <div className="user-pill">
                <NavLink
                  to="/profile"
                  className="user-pill__link"
                  onClick={closeMenu}
                  aria-label="Open profile"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} />
                  ) : (
                    <div className="user-pill__initials">{initials || 'ME'}</div>
                  )}
                  <div>
                    <div className="user-pill__name">{user.name}</div>
                  </div>
                </NavLink>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    closeMenu();
                    onLogout();
                  }}
                >
                  Log out
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    closeMenu();
                    onOpenAuth('login');
                  }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    closeMenu();
                    onOpenAuth('register');
                  }}
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
