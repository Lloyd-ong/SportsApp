const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const passport = require('passport');
const { router: authRouter, initAuth } = require('./routes/auth');
const eventsRouter = require('./routes/events');
const dashboardRouter = require('./routes/dashboard');
const adminRouter = require('./routes/admin');
const communityRouter = require('./routes/community');
const onemapRouter = require('./routes/onemap');
const placesRouter = require('./routes/places');
const messagesRouter = require('./routes/messages');
const optionalAuth = require('./middleware/optionalAuth');
const { ensureSportsCatalogTable } = require('./utils/sportsCatalog');
const db = require('./db');

const app = express();
const port = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';
const defaultOriginList = isProd ? '' : 'http://localhost:5173';
const configuredOrigins = (process.env.CLIENT_ORIGIN || defaultOriginList)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }
  if (!configuredOrigins.length) {
    return true;
  }
  if (configuredOrigins.includes(origin)) {
    return true;
  }
  if (!allowVercelPreviews) {
    return false;
  }
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app');
  } catch (err) {
    return false;
  }
};

if (isProd) {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd
    }
  })
);

initAuth();
app.use(passport.initialize());
app.use(passport.session());
app.use(optionalAuth);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/health/db', async (req, res) => {
  try {
    const db = require('./db');
    await db.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    console.error('DB health check failed', err);
    res.status(500).json({
      ok: false,
      code: err.code,
      message: err.message
    });
  }
});

app.use('/auth', authRouter);
app.use('/api', eventsRouter);
app.use('/api', dashboardRouter);
app.use('/api', adminRouter);
app.use('/api', communityRouter);
app.use('/api', onemapRouter);
app.use('/api', placesRouter);
app.use('/api', messagesRouter);

app.use((err, req, res, next) => {
  console.error('Unexpected server error', err);
  res.status(500).json({ error: 'Unexpected server error' });
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const updatePublicStats = async () => {
  await ensureSportsCatalogTable();
  const [[userCount]] = await db.execute('SELECT COUNT(*) AS count FROM users');
  const [[eventCount]] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM events
     WHERE start_time >= date_trunc('month', CURRENT_DATE)
       AND start_time < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`
  );
  const [[sportCount]] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT LOWER(TRIM(sport)) AS sport FROM events
       UNION
       SELECT LOWER(TRIM(sport)) AS sport FROM communities
       UNION
       SELECT LOWER(TRIM(name)) AS sport FROM sports_catalog WHERE verified = TRUE
     ) AS sports
     WHERE sport IS NOT NULL AND sport <> ''`
  );

  await db.execute(
    `INSERT INTO public_stats (id, users, events, sports)
     VALUES (1, ?, ?, ?)
     ON CONFLICT (id)
     DO UPDATE SET
       users = EXCLUDED.users,
       events = EXCLUDED.events,
       sports = EXCLUDED.sports,
       updated_at = CURRENT_TIMESTAMP`,
    [userCount.count, eventCount.count, sportCount.count]
  );
};

const startServer = () => {
  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
    updatePublicStats().catch((err) => console.error('Failed to update public stats', err));
    setInterval(() => {
      updatePublicStats().catch((err) => console.error('Failed to update public stats', err));
    }, WEEK_MS);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;
