// API Base URL
const API_URL = 'http://localhost:4000/api';

// Store user data in localStorage after login
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// API Helper Functions
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'API call failed');
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// TMDB API Functions
async function seedDatabaseWithTMDBMovies() {
    try {
        const result = await apiCall('/tmdb/seed', 'POST');
        console.log('Database seeded successfully:', result);
        return result;
    } catch (error) {
        console.error('Failed to seed database:', error);
        throw error;
    }
}

async function getFeaturedMovies() {
    try {
        return await apiCall('/movies/featured');
    } catch (error) {
        console.error('Failed to fetch featured movies:', error);
        return [];
    }
}

async function getHeroMovie() {
    try {
        return await apiCall('/movies/hero');
    } catch (error) {
        console.error('Failed to fetch hero movie:', error);
        return null;
    }
}

// Authentication Functions
async function register(name, email, password) {
    try {
        const result = await apiCall('/users/register', 'POST', { name, email, password });
        alert('Registration successful! Please log in.');
        window.location.href = 'Log_In.html';
        return result;
    } catch (error) {
        alert(`Registration failed: ${error.message}`);
        throw error;
    }
}

async function login(email, password) {
    try {
        const result = await apiCall('/users/login', 'POST', { email, password });
        currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        alert('Login successful!');
        window.location.href = 'website.html';
        return result;
    } catch (error) {
        alert(`Login failed: ${error.message}`);
        throw error;
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    window.location.href = 'Log_In.html';
}

function checkAuth() {
    if (!currentUser) {
        window.location.href = 'Log_In.html';
        return false;
    }
    return true;
}

function updateAuthUI() {
  const loginLink = document.getElementById('loginLink');
  const signupLink = document.getElementById('signupLink');

  if (currentUser && loginLink && signupLink) {
    loginLink.textContent = 'Logout';
    loginLink.href = '#';
    loginLink.onclick = e => {
      e.preventDefault();
      if (confirm('Are you sure you want to logout?')) {
        logout();
      }
    };

    signupLink.textContent = currentUser.name;
    signupLink.href = 'Setting.html';
    signupLink.onclick = null; // remove any residual handler
  }
}


// Group Management Functions
async function createGroup(groupName) {
    if (!checkAuth()) return;

    try {
        const result = await apiCall('/groups', 'POST', {
            groupName,
            userId: currentUser.id
        });
        alert('Group created successfully!');
        return result;
    } catch (error) {
        alert(`Failed to create group: ${error.message}`);
        throw error;
    }
}

async function getGroups() {
    try {
        return await apiCall('/groups');
    } catch (error) {
        console.error('Failed to fetch groups:', error);
        return [];
    }
}

async function getGroupMembers(groupId) {
    try {
        return await apiCall(`/groups/${groupId}/members`);
    } catch (error) {
        console.error('Failed to fetch group members:', error);
        return [];
    }
}

// Movie Functions
async function getMovies() {
    try {
        return await apiCall('/movies');
    } catch (error) {
        console.error('Failed to fetch movies:', error);
        return [];
    }
}

async function getMovie(movieId) {
    try {
        return await apiCall(`/movies/${movieId}`);
    } catch (error) {
        console.error('Failed to fetch movie:', error);
        return null;
    }
}

// Homepage Functions
async function loadHomepageContent() {
    console.log('🎬 Starting to load homepage content...');

    try {
        // First, seed database
        console.log('📚 Seeding database...');
        await seedDatabaseWithTMDBMovies();

        // Load featured movies
        console.log('🎥 Loading featured movies...');
        const featuredMovies = await getFeaturedMovies();

        if (featuredMovies && featuredMovies.length > 0) {
            console.log(`✅ Found ${featuredMovies.length} movies`);

            // Display hero movie (first one)
            displayHeroMovie(featuredMovies[0]);

            // Display featured movies
            displayFeaturedMovies(featuredMovies);
        } else {
            console.log('❌ No movies found');
            showError('No movies found in database');
        }
    } catch (error) {
        console.error('❌ Error loading homepage content:', error);
        showError(`Failed to load content: ${error.message}`);
    }
}

function displayHeroMovie(movie) {
    const heroSection = document.getElementById('hero-section');
    if (!heroSection) {
        console.error('Hero section element not found');
        return;
    }

    // FIXED: Safely handle rating
    let ratingDisplay = 'N/A';
    if (movie.rating !== null && movie.rating !== undefined && !isNaN(movie.rating)) {
        ratingDisplay = Number(movie.rating).toFixed(1);
    }

    const posterUrl = movie.poster_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDUwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjI1MCIgeT0iMzAwIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiPk5vIFBvc3RlcjwvdGV4dD4KPHN2Zz4=';

    heroSection.innerHTML = `
        <div class="hero-content">
            <div class="hero-text">
                <h1>Watch your<br>Favorite<br>Movie</h1>
                <p>Anytime Anywhere with Anyone</p>
            </div>
            <div class="hero-movie">
                <img src="${posterUrl}" alt="${movie.title}">
                <div class="hero-movie-info">
                    <h3>${movie.title} (${movie.release_year || 'Unknown'})</h3>
                    <div class="rating">${ratingDisplay}/10</div>
                </div>
            </div>
        </div>
    `;

    heroSection.classList.remove('loading');
    console.log('✅ Hero movie displayed:', movie.title);
}

function displayFeaturedMovies(movies) {
    const featuredSection = document.getElementById('featured-movies');
    if (!featuredSection) {
        console.error('Featured movies section element not found');
        return;
    }

    const movieCards = movies.map(movie => {
        const posterUrl = movie.poster_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDE0MCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjcwIiB5PSIxMDAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiI+Tm8gUG9zdGVyPC90ZXh0Pgo8L3N2Zz4=';

        return `
            <div class="movie-card">
                <div class="movie-poster">
                    <img src="${posterUrl}" alt="${movie.title}">
                </div>
                <div class="movie-info">
                    <h4>${movie.title}</h4>
                    <p>${movie.release_year || 'Unknown'}</p>
                </div>
            </div>
        `;
    }).join('');

    featuredSection.innerHTML = `
        <h2>Top 8 Movies</h2>
        <div class="movies-grid">
            ${movieCards}
        </div>
    `;

    featuredSection.classList.remove('loading');
    console.log(`✅ Featured movies displayed: ${movies.length} movies`);
}

function showError(message) {
    const heroSection = document.getElementById('hero-section');
    const featuredSection = document.getElementById('featured-movies');

    if (heroSection && heroSection.classList.contains('loading')) {
        heroSection.innerHTML = `<div class="error">${message}</div>`;
        heroSection.classList.remove('loading');
    }

    if (featuredSection && featuredSection.classList.contains('loading')) {
        featuredSection.innerHTML = `<div class="error">${message}</div>`;
        featuredSection.classList.remove('loading');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing app...');

    updateAuthUI();

    // Add page-specific initialization
    const currentPage = window.location.pathname.split('/').pop();
    console.log(`📄 Current page: ${currentPage}`);

    switch (currentPage) {
        case 'website.html':
        case '':
        case '/':
            console.log('🏠 Loading homepage content...');
            loadHomepageContent();
            break;

        case 'Stream_team.html':
            console.log('👥 Loading groups...');
            loadGroups();
            break;

        case 'Binge_Bank.html':
            console.log('🎥 Loading movies...');
            loadMovies();
            break;
    }
});

// Helper functions for specific pages
async function loadGroups() {
    if (!checkAuth()) return;
    const groups = await getGroups();
    console.log('Groups:', groups);
}

async function loadMovies() {
    const movies = await getMovies();
    console.log('Movies:', movies);
}

console.log('✅ app.js loaded successfully');