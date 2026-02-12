const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

const required = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'SESSION_SECRET',
  'TMDB_READ_TOKEN',
];

const missing = required.filter((key) => !process.env[key]);
if (nodeEnv !== 'test' && missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv,
  isProduction: process.env.NODE_ENV === 'production',
  app: {
    baseUrl: process.env.APP_BASE_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 4000}`,
  },

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
  },

  session: {
    secret: process.env.SESSION_SECRET,
  },

  tmdb: {
    baseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
    imageBase: process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p',
    readToken: process.env.TMDB_READ_TOKEN,
  },

  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
      : ['http://localhost:3000', 'http://localhost:4000'],
  },

  rateLimit: {
    general: parseInt(process.env.RATE_LIMIT_GENERAL, 10) || 200,
    auth: parseInt(process.env.RATE_LIMIT_AUTH, 10) || 10,
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    resendFrom: process.env.RESEND_FROM_EMAIL || '',
    resendFromName: process.env.RESEND_FROM_NAME || 'MovieNightPlanner',
  },
};
