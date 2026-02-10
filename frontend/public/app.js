// API Base URL - use relative path so it works on any domain
const API_URL = '/api';

// Store user data in localStorage after login
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
const THEME_KEY = 'mnp_theme';
const LAST_SEED_KEY = 'mnp_last_seed_at';

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
    let result = {};
    try {
        result = await response.json();
    } catch (_e) {
        result = {};
    }

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
    showToast('Logged in successfully', 'success');
    setTimeout(() => { window.location.href = 'website.html'; }, 1000);
    return user;
}

async function logout() {
    try {
        await apiCall('/users/logout', 'POST');
        showToast('Logged out', 'info');
    } catch (err) {
        console.error('Logout failed:', err);
        showToast('Logout request failed, local session cleared', 'warning');
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
        toggle.textContent = isLight ? 'Dark' : 'Light';
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
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.textContent = 'Menu';
        header.appendChild(menuToggle);
    }

    const closeNav = () => {
        nav.classList.remove('nav-open');
        menuToggle.textContent = 'Menu';
        menuToggle.setAttribute('aria-expanded', 'false');
    };

    menuToggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('nav-open');
        menuToggle.textContent = isOpen ? 'Close' : 'Menu';
        menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    nav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeNav);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeNav();
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
            link.setAttribute('aria-current', 'page');
        } else {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        }
    });
}

function ensureToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'info', duration = 4000) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.textContent = message;
    container.appendChild(toast);

    window.setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(12px)';
        toast.style.transition = 'opacity 180ms ease, transform 180ms ease';
        window.setTimeout(() => toast.remove(), 180);
    }, duration);
}

function initScrollObserver() {
    const targets = document.querySelectorAll('[data-animate]');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (targets.length === 0 || !('IntersectionObserver' in window) || reduceMotion) {
        targets.forEach((el) => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

    targets.forEach((el) => observer.observe(el));
}

function shouldSeedMovies() {
    const last = localStorage.getItem(LAST_SEED_KEY);
    if (!last) return true;
    const elapsed = Date.now() - Number(last);
    const oneDay = 24 * 60 * 60 * 1000;
    return Number.isNaN(elapsed) || elapsed > oneDay;
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
        if (shouldSeedMovies()) {
            await seedDatabaseWithTMDBMovies();
            localStorage.setItem(LAST_SEED_KEY, String(Date.now()));
        }

        const [featuredMovies, trending] = await Promise.all([
            getFeaturedMovies(),
            getTrendingMovies()
        ]);

        const trendingResults = (trending && Array.isArray(trending.results)) ? trending.results : [];

        if (featuredMovies && featuredMovies.length > 0) {
            displayHeroMovie(featuredMovies[0]);
            displayFeaturedMovies(featuredMovies);
        } else if (trendingResults.length > 0) {
            // Fall back to trending data for hero when DB is empty
            const heroTrending = trendingResults[0];
            displayHeroMovie({
                title: heroTrending.title || heroTrending.name || 'Unknown',
                poster_url: heroTrending.poster_path ? `https://image.tmdb.org/t/p/w500${heroTrending.poster_path}` : '',
                release_year: (heroTrending.release_date || '').slice(0, 4) || 'Unknown',
                rating: heroTrending.vote_average || null,
            });
            displayFeaturedFromTrending(trendingResults.slice(0, 8));
        } else {
            showError('No movies found. Please try again later.');
        }

        if (trendingResults.length > 0) {
            displayTrendingMovies(trendingResults.slice(0, 8));
        } else {
            const trendingSection = document.getElementById('trending-movies');
            if (trendingSection) {
                trendingSection.innerHTML = '<div class="error">No trending movies found right now.</div>';
                trendingSection.classList.remove('loading');
            }
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
        <div class="hero-content card">
            <div class="hero-text" data-animate>
                <span class="hero-eyebrow">Tonight's Hero Pick</span>
                <h2 class="hero-title">Plan a <span class="gradient">Movie Night</span> that everyone actually wants.</h2>
                <p class="hero-subtitle">
                    Build group watchlists, vote fast, and lock in a plan with less back-and-forth.
                </p>
                <div class="hero-actions">
                    <a class="btn btn-primary" href="Binge_Bank.html">Discover Movies</a>
                    <a class="btn btn-secondary" href="Stream_team.html">Open Groups</a>
                </div>
            </div>
            <div class="hero-poster" data-animate>
                ${posterUrl
                    ? `<img src="${posterUrl}" alt="${title}" loading="lazy">`
                    : '<div class="loading">No poster available</div>'}
                <div class="hero-meta">
                    <h3>${title} (${year})</h3>
                    <div class="rating">${ratingDisplay}/10</div>
                </div>
            </div>
        </div>
    `;
    heroSection.classList.remove('loading');
    heroSection.querySelectorAll('[data-animate]').forEach(el => el.classList.add('is-visible'));
}

function displayFeaturedMovies(movies) {
    const featuredSection = document.getElementById('featured-movies');
    if (!featuredSection) return;

    const movieCards = movies.map((movie, index) => {
        const posterUrl = movie.poster_url || '';
        const title = escapeHtml(movie.title);
        const year = escapeHtml(String(movie.release_year || 'Unknown'));
        const rating = movie.rating ? `${Number(movie.rating).toFixed(1)}/10` : 'NR';

        const tmdbId = movie.tmdb_id || movie.movie_id;
        return `
            <article class="movie-card animate-fade-in-up stagger-${Math.min(index + 1, 8)}" data-movie-id="${movie.movie_id}" onclick="showHomeMovieDetails(${tmdbId})" style="cursor:pointer;">
                <div class="movie-poster">
                    ${posterUrl
                        ? `<img src="${posterUrl}" alt="${title}" loading="lazy">`
                        : '<span>No Poster</span>'}
                </div>
                <div class="movie-info">
                    <h4>${title}</h4>
                    <p>${year} · ${rating}</p>
                </div>
            </article>
        `;
    }).join('');

    featuredSection.innerHTML = `
        <div class="featured-row">
            ${movieCards}
        </div>
    `;
    featuredSection.classList.remove('loading');
}

function displayTrendingMovies(movies) {
    const trendingSection = document.getElementById('trending-movies');
    if (!trendingSection) return;

    const cards = movies.map((movie, index) => {
        const title = escapeHtml(movie.title || movie.name || 'Unknown title');
        const year = escapeHtml((movie.release_date || '').slice(0, 4) || 'Unknown');
        const rating = movie.vote_average ? Number(movie.vote_average).toFixed(1) : 'NR';
        const poster = movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : '';

        return `
            <article class="trending-card card animate-fade-in-up stagger-${Math.min(index + 1, 8)}" onclick="showHomeMovieDetails(${movie.id})" style="cursor:pointer;">
                ${poster ? `<img src="${poster}" alt="${title}" loading="lazy">` : '<div class="loading">No poster</div>'}
                <div class="trending-overlay">
                    <h4>${title}</h4>
                    <p>${year} · ${rating}/10</p>
                </div>
            </article>
        `;
    }).join('');

    trendingSection.innerHTML = `<div class="trending-grid">${cards}</div>`;
    trendingSection.classList.remove('loading');
}

function displayFeaturedFromTrending(movies) {
    const featuredSection = document.getElementById('featured-movies');
    if (!featuredSection) return;

    const movieCards = movies.map((movie, index) => {
        const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '';
        const title = escapeHtml(movie.title || movie.name || 'Unknown');
        const year = escapeHtml((movie.release_date || '').slice(0, 4) || 'Unknown');
        const rating = movie.vote_average ? `${Number(movie.vote_average).toFixed(1)}/10` : 'NR';

        return `
            <article class="movie-card animate-fade-in-up stagger-${Math.min(index + 1, 8)}" onclick="showHomeMovieDetails(${movie.id})" style="cursor:pointer;">
                <div class="movie-poster">
                    ${posterUrl
                        ? `<img src="${posterUrl}" alt="${title}" loading="lazy">`
                        : '<span>No Poster</span>'}
                </div>
                <div class="movie-info">
                    <h4>${title}</h4>
                    <p>${year} · ${rating}</p>
                </div>
            </article>
        `;
    }).join('');

    featuredSection.innerHTML = `<div class="featured-row">${movieCards}</div>`;
    featuredSection.classList.remove('loading');
}

// ── Homepage Movie Modal ────────────────────────────────────────────────────

let homeModalMovieData = null;
let homeUserGroups = [];

async function loadHomeUserGroups() {
    if (!currentUser || homeUserGroups.length > 0) return;
    try {
        const result = await getGroups();
        homeUserGroups = Array.isArray(result) ? result : (Array.isArray(result.data) ? result.data : []);
    } catch (error) {
        homeUserGroups = [];
    }
}

async function showHomeMovieDetails(tmdbId) {
    const modal = document.getElementById('movieModal');
    if (!modal) return;

    try {
        const movie = await getMovieDetails(tmdbId);
        homeModalMovieData = movie;

        document.getElementById('modalTitle').textContent = movie.title;
        document.getElementById('modalMeta').innerHTML = `
            <span>${movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown'}</span>
            <span>${movie.runtime ? `${movie.runtime} min` : ''}</span>
            <span>${movie.vote_average ? `Rating ${movie.vote_average.toFixed(1)}/10` : 'Rating N/A'}</span>
        `;

        const modalHeader = document.getElementById('modalHeader');
        modalHeader.style.backgroundImage = movie.backdrop_url ? `url(${movie.backdrop_url})` : 'none';

        document.getElementById('modalDescription').innerHTML = `
            <p class="modal-overview">${movie.overview || 'No description available.'}</p>
            ${movie.genres && movie.genres.length > 0 ? `<p><strong>Genres:</strong> ${movie.genres.map((g) => g.name).join(', ')}</p>` : ''}
            ${movie.cast && movie.cast.length > 0 ? `<p><strong>Cast:</strong> ${movie.cast.slice(0, 5).map((c) => c.name).join(', ')}</p>` : ''}
        `;

        const groupSelector = document.getElementById('groupSelector');
        if (currentUser) {
            await loadHomeUserGroups();
            if (homeUserGroups.length > 0) {
                const groupList = document.getElementById('groupList');
                groupList.innerHTML = homeUserGroups.map((group) => `
                    <div class="group-option">
                        <span class="group-name">${escapeHtml(group.group_name)}</span>
                        <button class="btn btn-primary add-to-group-btn" onclick="addHomeMovieToGroup(${group.group_id})">Add</button>
                    </div>
                `).join('');
                groupSelector.style.display = 'block';
            } else {
                groupSelector.style.display = 'none';
            }
        } else {
            groupSelector.style.display = 'none';
        }

        modal.style.display = 'flex';
    } catch (error) {
        console.error('Failed to load movie details:', error);
        showToast('Failed to load movie details', 'error');
    }
}

async function addHomeMovieToGroup(groupId) {
    if (!homeModalMovieData) return;
    try {
        await addMovieToGroup(homeModalMovieData, groupId);
        const groupName = homeUserGroups.find((g) => g.group_id === groupId)?.group_name || 'group';
        showToast(`Added to "${groupName}" watchlist`, 'success');
        closeHomeModal();
    } catch (error) {
        showToast(error.message || 'Failed to add movie to group', 'error');
    }
}

function closeHomeModal() {
    const modal = document.getElementById('movieModal');
    if (modal) modal.style.display = 'none';
}

// Close modal on backdrop click or Escape
document.addEventListener('click', (e) => {
    const modal = document.getElementById('movieModal');
    if (e.target === modal) closeHomeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHomeModal();
});

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

    const trendingSection = document.getElementById('trending-movies');
    if (trendingSection && trendingSection.classList.contains('loading')) {
        trendingSection.innerHTML = `<div class="error">${safeMessage}</div>`;
        trendingSection.classList.remove('loading');
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
    initScrollObserver();

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
