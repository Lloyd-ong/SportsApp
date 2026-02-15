import { useEffect, useState } from 'react';

const initialForm = {
  name: '',
  email: '',
  password: ''
};

function AuthModal({ open, onClose, apiUrl, googleEnabled, initialMode = 'register', onRegister, onLogin }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setMode(initialMode);
    setForm(initialForm);
    setBusy(false);
    setError('');

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, initialMode]);

  if (!open) {
    return null;
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (mode === 'register') {
        await onRegister({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password
        });
      } else {
        await onLogin({
          email: form.email.trim(),
          password: form.password
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-modal__backdrop auth-modal__backdrop--fixed" onClick={onClose} role="presentation">
      <div className="auth-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="auth-modal__close" onClick={onClose} aria-label="Close">
          x
        </button>
        <h3>Log in or create an account</h3>
        <p className="auth-modal__lead">
          Join PlayNet using your Google account or an email and password.
        </p>
        <div className="auth-modal__actions">
          <a
            className={`btn btn--primary btn--google ${googleEnabled ? '' : 'btn--disabled'}`}
            href={googleEnabled ? `${apiUrl}/auth/google` : '#'}
            aria-disabled={!googleEnabled}
          >
            <span className="btn__icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.7 13.3l7.8 6.1C12.6 13.5 17.9 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.4h12.7c-.3 2-1.8 5-5 7.1l7.7 6c4.5-4.2 6.7-10.3 6.7-16.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.5 28.1C9.9 26.5 9.6 24.8 9.6 23s.3-3.5.9-5.1l-7.8-6.1C.9 15.1 0 18.9 0 23s.9 7.9 2.7 11.2l7.8-6.1z"
                />
                <path
                  fill="#34A853"
                  d="M24 46c6.2 0 11.4-2 15.2-5.6l-7.7-6c-2.1 1.4-4.9 2.4-7.5 2.4-6.1 0-11.4-4-13.5-9.4l-7.8 6.1C6.5 41.6 14.6 46 24 46z"
                />
              </svg>
            </span>
            Continue with Google
          </a>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
        </div>

        {mode === 'login' ? (
          <div className="auth-reset">
            <button
              type="button"
              className="auth-reset__link"
              onClick={() => {
                onClose();
                window.location.assign('/reset');
              }}
            >
              Forgot password?
            </button>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <label>
              Full name
              <input
                type="text"
                value={form.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder="Alex Morgan"
                autoComplete="name"
                disabled={busy}
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => handleChange('email', event.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              disabled={busy}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => handleChange('password', event.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              disabled={busy}
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Working...' : mode === 'register' ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="auth-modal__note">
          By continuing you agree to the PlayNet community guidelines.
        </p>
      </div>
    </div>
  );
}

export default AuthModal;
