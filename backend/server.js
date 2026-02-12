const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const { pool, testConnection } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');
const logger = require('./utils/logger');

// Route modules
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const movieRoutes = require('./routes/movies');
const tmdbRoutes = require('./routes/tmdb');
const friendRoutes = require('./routes/friends');
const voteRoutes = require('./routes/votes');
const notificationRoutes = require('./routes/notifications');

const app = express();

// --------------- Security & performance middleware ---------------

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://image.tmdb.org'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());
app.use(requestId);

const morganFormat = env.isProduction ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimit.general,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api/', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimit.auth,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
});
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);

// --------------- Body parsing ---------------

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------- CORS ---------------

app.use(
  cors({
    origin: env.isProduction
      ? env.cors.origins
      : ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:5500'],
    credentials: true,
  })
);

// --------------- Sessions ---------------
// In local/dev environments, default to memory store to avoid hard failures when the
// MySQL sessions table is missing. Production still uses MySQL-backed sessions.
const sessionStore = env.isProduction ? new MySQLStore({}, pool) : null;

app.use(
  session({
    key: 'movie_tracker_sid',
    secret: env.session.secret,
    store: sessionStore || undefined,
    resave: false,
    saveUninitialized: false,
    proxy: env.isProduction,
    cookie: {
      secure: env.isProduction,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: env.isProduction ? 'none' : 'lax',
    },
  })
);

// --------------- Static files ---------------

app.use(express.static(path.join(__dirname, '../frontend/public'), {
  maxAge: env.isProduction ? '1d' : 0,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return;
    }

    if (env.isProduction) {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// --------------- Health check ---------------

app.get('/health', async (_req, res) => {
  try {
    await testConnection();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      environment: env.nodeEnv,
      pool: {
        threadId: pool.pool?._freeConnections?.length ?? 'unknown',
      },
    });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

// --------------- API routes ---------------

app.get('/api', (_req, res) => {
  res.json({ success: true, status: 'Movie Tracker API v1' });
});

app.use('/api/users', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/notifications', notificationRoutes);

// --------------- SPA catch-all ---------------

app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '../frontend/public/website.html'));
});

// --------------- Error handling ---------------

app.use(errorHandler);

// --------------- Start server ---------------

async function start() {
  try {
    await testConnection();
    logger.info('Database connected');
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);
    logger.info(`→ http://localhost:${env.port}`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down`);
    server.close(() => {
      logger.info('HTTP server closed');
      pool.end().then(() => {
        logger.info('Database pool closed');
        process.exit(0);
      });
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
