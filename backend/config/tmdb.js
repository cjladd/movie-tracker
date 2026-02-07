const axios = require('axios');
const env = require('./env');

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

async function fetchFromTMDB(endpoint) {
  const response = await tmdbClient.get(endpoint);
  return response.data;
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
