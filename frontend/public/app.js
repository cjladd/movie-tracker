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
        },
        credentials: 'include' // This ensures session cookies are sent
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

async function searchMovies(query, page = 1) {
    try {
        return await apiCall(`/tmdb/search?query=${encodeURIComponent(query)}&page=${page}`);
    } catch (error) {
        console.error('Failed to search movies:', error);
        return { results: [], total_results: 0, total_pages: 0 };
    }
}

async function getPopularMovies(page = 1) {
    try {
        return await apiCall(`/tmdb/popular?page=${page}`);
    } catch (error) {
        console.error('Failed to fetch popular movies:', error);
        return { results: [], total_results: 0, total_pages: 0 };
    }
}

async function getTrendingMovies() {
    try {
        return await apiCall('/tmdb/trending');
    } catch (error) {
        console.error('Failed to fetch trending movies:', error);
        return { results: [], total_results: 0, total_pages: 0 };
    }
}

async function getMovieDetails(tmdbId) {
    try {
        return await apiCall(`/tmdb/movie/${tmdbId}`);
    } catch (error) {
        console.error('Failed to fetch movie details:', error);
        throw error;
    }
}

async function addMovieToGroup(tmdbMovie, groupId) {
    try {
        return await apiCall('/tmdb/add-to-group', 'POST', { tmdbMovie, groupId });
    } catch (error) {
        console.error('Failed to add movie to group:', error);
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
        return result;
    } catch (error) {
        throw error;
    }
}

async function login(email, password) {
    try {
        const result = await apiCall('/users/login', 'POST', { email, password });
        currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Redirect to homepage after successful login
        setTimeout(() => {
            window.location.href = 'website.html';
        }, 1000);

        return result;
    } catch (error) {
        throw error;
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    // Call logout API
    apiCall('/users/logout', 'POST').catch(console.error);
}

function checkAuth() {
    if (!currentUser) {
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
                window.location.href = 'Log_In.html';
            }
        };

        signupLink.textContent = currentUser.name;
        signupLink.href = 'Setting.html';
        signupLink.onclick = null;
    }
}

// Group Management Functions
async function createGroup(groupName) {
    if (!checkAuth()) return;

    try {
        const result = await apiCall('/groups', 'POST', {
            groupName
        });
        return result;
    } catch (error) {
        console.error('Failed to create group:', error);
        throw error;
    }
}

async function getGroups() {
    if (!checkAuth()) return [];

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

async function addGroupMember(groupId, email) {
    try {
        return await apiCall(`/groups/${groupId}/members`, 'POST', { email });
    } catch (error) {
        console.error('Failed to add group member:', error);
        throw error;
    }
}

/**************************\
 * Friends / Invites API  *
\**************************/

// Get list of current friends
async function getFriends() {
  const res = await fetch('/api/friends', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch friends');
  return res.json();
}

// Get pending friend requests
async function getFriendRequests() {
  const res = await fetch('/api/friends/requests', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch friend requests');
  return res.json();
}

// Send a friend request by email
async function sendFriendRequest(email) {
  const res = await fetch('/api/friends/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send friend request');
  return data;
}

// Accept a pending friend request
async function acceptFriendRequest(requestId) {
  const res = await fetch('/api/friends/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ requestId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to accept friend request');
  return data;
}

// Remove an existing friend
async function removeFriend(friendId) {
  const res = await fetch(`/api/friends/${friendId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to remove friend');
  return data;
}


// Movie Night Functions
async function createMovieNight(groupId, scheduledDate, chosenMovieId = null) {
    try {
        return await apiCall(`/groups/${groupId}/movie-nights`, 'POST', {
            scheduledDate,
            chosenMovieId
        });
    } catch (error) {
        console.error('Failed to create movie night:', error);
        throw error;
    }
}

async function getMovieNights(groupId) {
    try {
        return await apiCall(`/groups/${groupId}/movie-nights`);
    } catch (error) {
        console.error('Failed to fetch movie nights:', error);
        return [];
    }
}

// Watchlist Functions
async function addToWatchlist(groupId, movieId) {
    try {
        return await apiCall(`/groups/${groupId}/watchlist`, 'POST', { movieId });
    } catch (error) {
        console.error('Failed to add to watchlist:', error);
        throw error;
    }
}

async function getWatchlist(groupId) {
    try {
        return await apiCall(`/groups/${groupId}/watchlist`);
    } catch (error) {
        console.error('Failed to fetch watchlist:', error);
        return [];
    }
}

// Voting Functions
async function voteOnMovie(groupId, movieId, voteValue) {
    try {
        return await apiCall('/votes', 'POST', {
            groupId,
            movieId,
            voteValue
        });
    } catch (error) {
        console.error('Failed to vote on movie:', error);
        throw error;
    }
}

async function getMovieVotes(groupId, movieId) {
    try {
        return await apiCall(`/groups/${groupId}/movies/${movieId}/votes`);
    } catch (error) {
        console.error('Failed to fetch movie votes:', error);
        return [];
    }
}

// Notification Functions
async function getNotifications() {
    if (!checkAuth()) return [];

    try {
        return await apiCall('/notifications');
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        return await apiCall(`/notifications/${notificationId}/read`, 'POST');
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        throw error;
    }
}

async function markAllNotificationsAsRead() {
    try {
        return await apiCall('/notifications/read-all', 'POST');
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        throw error;
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
            console.log('⚠️ No movies found');
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
            <div class="movie-card" data-movie-id="${movie.movie_id}">
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
    updateAuthNav();
    updateAuthUI();

    // Add page-specific initialization
    const currentPage = window.location.pathname.split('/').pop() || 'website.html';
    console.log(`📄 Current page: ${currentPage}`);

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
        });
    }       


    switch (currentPage) {
        case 'website.html':
        case '':
        case '/':
        case 'index.html':
            console.log('🏠 Loading homepage content...');
            loadHomepageContent();
            break;

        case 'Stream_team.html':
            console.log('👥 Loading groups page...');
            // Groups page will handle its own loading
            break;

        case 'Binge_Bank.html':
            console.log('🎥 Loading movies page...');
            // Movies page will handle its own loading
            break;

        case 'heads_up.html':
            console.log('🔔 Loading notifications page...');
            // Notifications page will handle its own loading
            break;
    }
});

// Helper functions for specific pages (keeping for compatibility)

// Toggle nav links based on authentication state
function updateAuthNav() {
  const loginLink = document.getElementById('loginLink');
  const signUpLink = document.getElementById('signUpLink');
  const logoutLink = document.getElementById('logoutLink');

  // If these elements aren’t found on the current page, do nothing
  if (!loginLink || !signUpLink || !logoutLink) return;

  if (currentUser) {
    loginLink.style.display = 'none';
    signUpLink.style.display = 'none';
    logoutLink.style.display = 'inline-block';
  } else {
    loginLink.style.display = '';
    signUpLink.style.display = '';
    logoutLink.style.display = 'none';
  }
}

// Perform logout
async function logout() {
  try {
    await fetch('/api/users/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {
    console.error('Logout failed:', err);
  }
  currentUser = null;
  localStorage.removeItem('currentUser');
  updateAuthNav();
  // Redirect to home or login page after logout
  window.location.href = 'website.html';
}


async function loadGroups() {
    if (!checkAuth()) return;
    const groups = await getGroups();
    console.log('Groups:', groups);
}

async function loadMovies() {
    const movies = await getMovies();
    console.log('Movies:', movies);
}

// Utility functions
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.toString().replace(/[&<>"']/g, m => map[m]) : '';
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString();
}

function getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return formatDate(dateString);
}

console.log('✅ app.js loaded successfully');