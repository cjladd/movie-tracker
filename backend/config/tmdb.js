const axios = require('axios');
const env = require('./env');
const logger = require('../utils/logger');

const TMDB_IMAGE_URL = `${env.tmdb.imageBase}/w780`;
const TMDB_BACKDROP_URL = `${env.tmdb.imageBase}/w1280`;

const tmdbClient = axios.create({
  baseURL: env.tmdb.baseUrl,
  headers: {
    Authorization: `Bearer ${env.tmdb.readToken}`,
    accept: 'application/json',
  },
  timeout: 10000,
});

async function fetchFromTMDB(endpoint, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const start = Date.now();
      const response = await tmdbClient.get(endpoint);
      logger.debug(`TMDB ${endpoint} completed in ${Date.now() - start}ms`);
      return response.data;
    } catch (error) {
      if (attempt === retries) {
        logger.error(`TMDB API failed after ${retries + 1} attempts: ${endpoint}`, {
          status: error.response?.status,
          message: error.message,
        });
        throw error;
      }
      const delay = Math.pow(2, attempt) * 500;
      logger.warn(`TMDB retry ${attempt + 1} for ${endpoint} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function mapTMDBMovie(tmdbMovie) {
  return {
    title: tmdbMovie.title,
    runtime_minutes: tmdbMovie.runtime || null,
    genre: tmdbMovie.genres
      ? tmdbMovie.genres.map((g) => g.name).join(', ')
      : null,
    release_year: tmdbMovie.release_date
      ? new Date(tmdbMovie.release_date).getFullYear()
      : null,
    rating: tmdbMovie.vote_average || null,
    poster_url: tmdbMovie.poster_path
      ? `${TMDB_IMAGE_URL}${tmdbMovie.poster_path}`
      : null,
    tmdb_id: tmdbMovie.id,
  };
}

function addImageUrls(movie) {
  return {
    ...movie,
    poster_url: movie.poster_path
      ? `${TMDB_IMAGE_URL}${movie.poster_path}`
      : null,
    backdrop_url: movie.backdrop_path
      ? `${TMDB_BACKDROP_URL}${movie.backdrop_path}`
      : null,
  };
}

module.exports = { fetchFromTMDB, mapTMDBMovie, addImageUrls };
