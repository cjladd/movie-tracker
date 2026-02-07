const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { testConnection } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');

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

// Trust proxy so rate-limit and secure cookies work behind Railway / reverse proxy
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false, // disabled so inline scripts in static HTML work
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());

if (env.isProduction) {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Rate limiting — general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', generalLimiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);

// --------------- Body parsing ---------------

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

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

app.use(
  session({
    secret: env.session.secret,
    resave: false,
    saveUninitialized: false,
    proxy: env.isProduction,
    cookie: {
      secure: env.isProduction,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: env.isProduction ? 'none' : 'lax',
    },
  })
);

// --------------- Static files ---------------

app.use(express.static(path.join(__dirname, '../frontend/public')));

// --------------- Health check ---------------

app.get('/health', async (_req, res) => {
  try {
    await testConnection();
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

// --------------- API routes ---------------

app.get('/api', (req, res) => {
  res.json({ status: 'Movie Tracker API is running', authenticated: !!req.session.userId });
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
  res.sendFile(path.join(__dirname, '../frontend/public/website.html'));
});

// --------------- Error handling ---------------

app.use(errorHandler);

// --------------- Start server ---------------

async function start() {
  try {
    await testConnection();
    console.log('Database connected');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`${signal} received — shutting down`);
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
    // Force exit after 10 s if connections are hanging
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
