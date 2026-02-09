// API Base URL - use relative path so it works on any domain
const API_URL = '/api';

// Store user data in localStorage after login
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
const THEME_KEY = 'mnp_theme';

// ── Core API Helper ──────────────────────────────────────────────────────────

async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || result.message || 'API call failed');
    }

    // Unwrap standardized { success, data, message } response format
    return result.data !== undefined ? result.data : result;
}

// ── TMDB API Functions ───────────────────────────────────────────────────────

async function seedDatabaseWithTMDBMovies() {
    return await apiCall('/tmdb/seed', 'POST');
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
    return await apiCall(`/tmdb/movie/${tmdbId}`);
}

async function addMovieToGroup(tmdbMovie, groupId) {
    return await apiCall('/tmdb/add-to-group', 'POST', { tmdbMovie, groupId });
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

// ── Authentication Functions ─────────────────────────────────────────────────

async function register(name, email, password) {
    return await apiCall('/users/register', 'POST', { name, email, password });
}

async function login(email, password) {
    const user = await apiCall('/users/login', 'POST', { email, password });
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    setTimeout(() => { window.location.href = 'website.html'; }, 1000);
    return user;
}

async function logout() {
    try {
        await apiCall('/users/logout', 'POST');
    } catch (err) {
        console.error('Logout failed:', err);
    }
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateAuthNav();
    window.location.href = 'website.html';
}

function checkAuth() {
    return !!currentUser;
}

function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
}

function initThemeToggle() {
    const header = document.querySelector('.header');
    if (!header) return;

    let actions = header.querySelector('.nav-actions');
    if (!actions) {
        actions = document.createElement('div');
        actions.className = 'nav-actions';
        header.appendChild(actions);
    }

    let toggle = document.getElementById('themeToggle');
    if (!toggle) {
        toggle = document.createElement('button');
        toggle.id = 'themeToggle';
        toggle.className = 'btn-icon theme-toggle';
        toggle.type = 'button';
        actions.appendChild(toggle);
    }

    const setIcon = () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        toggle.textContent = isLight ? '🌙' : '☀';
        toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
        toggle.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
    };

    toggle.addEventListener('click', () => {
        const nextTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
        setIcon();
    });

    setIcon();
}

function initMobileNavToggle() {
    const header = document.querySelector('.header');
    const nav = document.querySelector('.main-nav');
    if (!header || !nav) return;

    let menuToggle = document.getElementById('navMobileToggle');
    if (!menuToggle) {
        menuToggle = document.createElement('button');
        menuToggle.id = 'navMobileToggle';
        menuToggle.type = 'button';
        menuToggle.className = 'btn-icon nav-mobile-toggle';
        menuToggle.setAttribute('aria-label', 'Toggle navigation menu');
        menuToggle.textContent = '☰';
        header.appendChild(menuToggle);
    }

    menuToggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('nav-open');
        menuToggle.textContent = isOpen ? '✕' : '☰';
    });
}

function setActiveNavLink() {
    const pageName = window.location.pathname.split('/').pop() || 'website.html';
    const links = document.querySelectorAll('.main-nav > a');
    links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        if (href === pageName || (pageName === 'index.html' && href === 'website.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// ── Group Management Functions ───────────────────────────────────────────────

async function createGroup(groupName) {
    if (!checkAuth()) return;
    return await apiCall('/groups', 'POST', { groupName });
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
    return await apiCall(`/groups/${groupId}/members`, 'POST', { email });
}

// ── Friends / Invites API ────────────────────────────────────────────────────

async function getFriends() {
    try {
        return await apiCall('/friends');
    } catch (error) {
        console.error('Failed to fetch friends:', error);
        return [];
    }
}

async function getFriendRequests() {
    try {
        return await apiCall('/friends/requests');
    } catch (error) {
        console.error('Failed to fetch friend requests:', error);
        return [];
    }
}

async function sendFriendRequest(email) {
    return await apiCall('/friends/requests', 'POST', { email });
}

async function acceptFriendRequest(requestId) {
    return await apiCall(`/friends/requests/${requestId}/accept`, 'POST');
}

async function declineFriendRequest(requestId) {
    return await apiCall(`/friends/requests/${requestId}/decline`, 'POST');
}

async function removeFriend(friendId) {
    return await apiCall(`/friends/${friendId}`, 'DELETE');
}

// ── Movie Night Functions ────────────────────────────────────────────────────

async function createMovieNight(groupId, scheduledDate, chosenMovieId = null) {
    return await apiCall(`/groups/${groupId}/movie-nights`, 'POST', {
        scheduledDate,
        chosenMovieId
    });
}

async function getMovieNights(groupId) {
    try {
        return await apiCall(`/groups/${groupId}/movie-nights`);
    } catch (error) {
        console.error('Failed to fetch movie nights:', error);
        return [];
    }
}

// ── Watchlist Functions ──────────────────────────────────────────────────────

async function addToWatchlist(groupId, movieId) {
    return await apiCall(`/groups/${groupId}/watchlist`, 'POST', { movieId });
}

async function getWatchlist(groupId) {
    try {
        return await apiCall(`/groups/${groupId}/watchlist`);
    } catch (error) {
        console.error('Failed to fetch watchlist:', error);
        return [];
    }
}

// ── Voting Functions ─────────────────────────────────────────────────────────

async function voteOnMovie(groupId, movieId, voteValue) {
    return await apiCall('/votes', 'POST', { groupId, movieId, voteValue });
}

async function getMovieVotes(groupId, movieId) {
    try {
        return await apiCall(`/groups/${groupId}/movies/${movieId}/votes`);
    } catch (error) {
        console.error('Failed to fetch movie votes:', error);
        return [];
    }
}

// ── Notification Functions ───────────────────────────────────────────────────

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
    return await apiCall(`/notifications/${notificationId}/read`, 'POST');
}

async function markAllNotificationsAsRead() {
    return await apiCall('/notifications/read-all', 'POST');
}

// ── Movie Functions ──────────────────────────────────────────────────────────

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

// ── Homepage Functions ───────────────────────────────────────────────────────

async function loadHomepageContent() {
    try {
        await seedDatabaseWithTMDBMovies();

        const featuredMovies = await getFeaturedMovies();

        if (featuredMovies && featuredMovies.length > 0) {
            displayHeroMovie(featuredMovies[0]);
            displayFeaturedMovies(featuredMovies);
        } else {
            showError('No movies found in database');
        }
    } catch (error) {
        console.error('Error loading homepage content:', error);
        showError('Failed to load content. Please try again later.');
    }
}

function displayHeroMovie(movie) {
    const heroSection = document.getElementById('hero-section');
    if (!heroSection) return;

    let ratingDisplay = 'N/A';
    if (movie.rating !== null && movie.rating !== undefined && !isNaN(movie.rating)) {
        ratingDisplay = Number(movie.rating).toFixed(1);
    }

    const posterUrl = movie.poster_url || '';
    const title = escapeHtml(movie.title);
    const year = escapeHtml(String(movie.release_year || 'Unknown'));

    heroSection.innerHTML = `
        <div class="hero-content">
            <div class="hero-text">
                <h1>Watch your<br>Favorite<br>Movie</h1>
                <p>Anytime Anywhere with Anyone</p>
            </div>
            <div class="hero-movie">
                ${posterUrl
                    ? `<img src="${posterUrl}" alt="${title}" loading="lazy">`
                    : '<div style="width:100%;height:600px;background:#333;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#666;">No Poster</div>'}
                <div class="hero-movie-info">
                    <h3>${title} (${year})</h3>
                    <div class="rating">${ratingDisplay}/10</div>
                </div>
            </div>
        </div>
    `;
    heroSection.classList.remove('loading');
}

function displayFeaturedMovies(movies) {
    const featuredSection = document.getElementById('featured-movies');
    if (!featuredSection) return;

    const movieCards = movies.map(movie => {
        const posterUrl = movie.poster_url || '';
        const title = escapeHtml(movie.title);
        const year = escapeHtml(String(movie.release_year || 'Unknown'));

        return `
            <div class="movie-card" data-movie-id="${movie.movie_id}">
                <div class="movie-poster">
                    ${posterUrl
                        ? `<img src="${posterUrl}" alt="${title}" loading="lazy">`
                        : '<span>No Poster</span>'}
                </div>
                <div class="movie-info">
                    <h4>${title}</h4>
                    <p>${year}</p>
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
}

function showError(message) {
    const heroSection = document.getElementById('hero-section');
    const featuredSection = document.getElementById('featured-movies');
    const safeMessage = escapeHtml(message);

    if (heroSection && heroSection.classList.contains('loading')) {
        heroSection.innerHTML = `<div class="error">${safeMessage}</div>`;
        heroSection.classList.remove('loading');
    }

    if (featuredSection && featuredSection.classList.contains('loading')) {
        featuredSection.innerHTML = `<div class="error">${safeMessage}</div>`;
        featuredSection.classList.remove('loading');
    }
}

// ── Navigation & Auth UI ─────────────────────────────────────────────────────

function updateAuthNav() {
    const loginLink = document.getElementById('loginLink');
    const signUpLink = document.getElementById('signUpLink');
    const logoutLink = document.getElementById('logoutLink');

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

function updateAuthUI() {
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signUpLink');

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
        signupLink.onclick = null;
    }
}

// ── Initialization ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getPreferredTheme());
    updateAuthNav();
    initThemeToggle();
    initMobileNavToggle();
    setActiveNavLink();

    const pageName = window.location.pathname.split('/').pop() || 'website.html';

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    switch (pageName) {
        case 'website.html':
        case '':
        case '/':
        case 'index.html':
            loadHomepageContent();
            break;
    }
});

// ── Utility Functions ────────────────────────────────────────────────────────

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
