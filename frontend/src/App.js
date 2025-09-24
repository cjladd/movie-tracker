import React, { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Root component for the Movie Tracker frontend.  On mount it requests
 * movie data from the backend and renders a simple list.  This file is
 * intentionally minimal — as the project grows you should extract
 * components into their own files under `src/components` and introduce
 * routing with a library like react-router.
 */
function App() {
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Request all movies from the API.  During development the
    // `proxy` setting in package.json will forward this request
    // to the Express server running on port 4000.
    axios.get('/api/movies')
      .then((response) => {
        setMovies(response.data);
      })
      .catch((err) => {
        console.error('Error fetching movies:', err);
        setError('Failed to load movies. Please check that the API is running.');
      });
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Movie Tracker</h1>
      <p>This is the starter UI. The list below is fetched from the backend API.</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {movies.map((movie) => (
          <li key={movie.id}>
            {movie.title} {movie.release_year ? `(${movie.release_year})` : ''}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;