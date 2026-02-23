// API Base URL - use relative path so it works on any domain
const API_URL = '/api';

// Keep auth state in memory and validate it against the server on load.
let currentUser = null;
let authStatePromise = null;
const THEME_KEY = 'mnp_theme';
const LAST_SEED_KEY = 'mnp_last_seed_at';

function normalizeCollection(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    return [];
}

function getErrorMessage(error, fallback = 'Request failed') {
    if (error && typeof error.message === 'string' && error.message.trim()) {
        return error.message;
    }
    return fallback;
}

function setStatusMessage(successEl, errorEl, message, type = 'error', autoHideMs = 0) {
    if (type === 'success' && successEl) {
        successEl.textContent = message;
        successEl.style.display = 'block';
    }
    if (type === 'error' && errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
    if (type === 'success' && errorEl) errorEl.style.display = 'none';
    if (type === 'error' && successEl) successEl.style.display = 'none';

    if (typeof showToast === 'function') {
        showToast(message, type === 'success' ? 'success' : 'error');
    }

    if (autoHideMs > 0) {
        window.setTimeout(() => {
            if (successEl) successEl.style.display = 'none';
            if (errorEl) errorEl.style.display = 'none';
        }, autoHideMs);
    }
}

function renderStandardState(container, type, title, message) {
    if (!container) return;
    const safeTitle = escapeHtml(title || '');
    const safeMessage = escapeHtml(message || '');

    if (type === 'loading') {
        container.innerHTML = `
            <div class="loading-spinner" role="status" aria-live="polite">
                <div class="spinner"></div>
                <span class="sr-only">Loading</span>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="empty-state card" role="${type === 'error' ? 'alert' : 'status'}" aria-live="${type === 'error' ? 'assertive' : 'polite'}">
            <h3>${safeTitle}</h3>
            ${safeMessage ? `<p>${safeMessage}</p>` : ''}
        </div>
    `;
}

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
        const err = new Error(result.error || result.message || 'API call failed');
        err.status = response.status;
        if (response.status === 401 && endpoint !== '/users/login' && endpoint !== '/users/register') {
            clearAuthState();
            updateAuthUI();
        }
        throw err;
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

function setCurrentUser(user) {
    currentUser = user || null;
    if (currentUser) {
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('currentUser');
    }
}

function clearAuthState() {
    setCurrentUser(null);
    if (typeof homeUserGroups !== 'undefined') {
        homeUserGroups = [];
    }
}

async function ensureAuthState(forceRefresh = false) {
    if (!forceRefresh && authStatePromise) return authStatePromise;

    authStatePromise = (async () => {
        try {
            const user = await apiCall('/users/me');
            setCurrentUser(user);
            return currentUser;
        } catch (error) {
            if (error.status === 401 || error.status === 404) {
                clearAuthState();
                return null;
            }
            console.error('Failed to validate auth state:', error);
            clearAuthState();
            return null;
        } finally {
            updateAuthUI();
        }
    })();

    return authStatePromise;
}

async function register(name, email, password) {
    return await apiCall('/users/register', 'POST', { name, email, password });
}

async function login(email, password) {
    const user = await apiCall('/users/login', 'POST', { email, password });
    setCurrentUser(user);
    if (typeof homeUserGroups !== 'undefined') {
        homeUserGroups = [];
    }
    authStatePromise = Promise.resolve(currentUser);
    updateAuthUI();
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
    clearAuthState();
    authStatePromise = Promise.resolve(null);
    updateAuthUI();
    window.location.href = 'website.html';
}

function checkAuth() {
    return !!currentUser;
}

function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
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

    const navAuth = document.querySelector('.nav-auth');
    if (navAuth) {
        navAuth.querySelectorAll('a, button').forEach((el) => {
            el.addEventListener('click', closeNav);
        });
    }

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

function initSkipLink() {
    const main = document.querySelector('main');
    if (!main) return;

    if (!main.id) {
        main.id = 'mainContent';
    }
    if (!main.hasAttribute('tabindex')) {
        main.setAttribute('tabindex', '-1');
    }
    if (document.querySelector('.skip-link')) return;

    const skipLink = document.createElement('a');
    skipLink.className = 'skip-link';
    skipLink.href = `#${main.id}`;
    skipLink.textContent = 'Skip to main content';
    document.body.insertBefore(skipLink, document.body.firstChild);
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

async function getGroupActivity(groupId, { eventType = '', actorUserId = '', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (eventType) params.set('eventType', eventType);
    if (actorUserId) params.set('actorUserId', actorUserId);
    params.set('page', String(page));
    params.set('limit', String(limit));

    try {
        return await apiCall(`/groups/${groupId}/activity?${params.toString()}`);
    } catch (error) {
        console.error('Failed to fetch group activity:', error);
        return [];
    }
}

async function addGroupMember(groupId, email) {
    return await apiCall(`/groups/${groupId}/members`, 'POST', { email });
}

async function updateGroupMemberRole(groupId, memberId, role) {
    return await apiCall(`/groups/${groupId}/members/${memberId}/role`, 'PATCH', { role });
}

async function removeGroupMember(groupId, memberId) {
    return await apiCall(`/groups/${groupId}/members/${memberId}`, 'DELETE');
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

async function createMovieNight(groupId, scheduledDate, chosenMovieId = null, options = {}) {
    return await apiCall(`/groups/${groupId}/movie-nights`, 'POST', {
        scheduledDate,
        chosenMovieId,
        ...options,
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

async function setMovieNightLock(groupId, nightId, locked) {
    return await apiCall(`/groups/${groupId}/movie-nights/${nightId}/lock`, 'PATCH', { locked });
}

async function sendRsvpReminder(groupId, nightId, force = true) {
    return await apiCall(`/groups/${groupId}/movie-nights/${nightId}/rsvp-reminders`, 'POST', { force });
}

async function setMovieNightAvailability(groupId, nightId, isAvailable) {
    return await apiCall(`/groups/${groupId}/movie-nights/${nightId}/availability`, 'POST', { isAvailable });
}

async function getMovieNightAvailability(groupId, nightId) {
    return await apiCall(`/groups/${groupId}/movie-nights/${nightId}/availability`);
}

function getFilenameFromDisposition(disposition, fallback = 'movie-night.ics') {
    if (!disposition) return fallback;
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
    return plainMatch && plainMatch[1] ? plainMatch[1] : fallback;
}

async function exportMovieNightIcs(groupId, nightId) {
    const response = await fetch(`${API_URL}/groups/${groupId}/movie-nights/${nightId}/ics`, {
        method: 'GET',
        credentials: 'include'
    });

    if (!response.ok) {
        let errMessage = 'Failed to export calendar invite';
        try {
            const errorBody = await response.json();
            errMessage = errorBody.error || errorBody.message || errMessage;
        } catch (_error) {
            // Keep generic fallback message when API does not return JSON.
        }
        const err = new Error(errMessage);
        err.status = response.status;
        throw err;
    }

    const blob = await response.blob();
    const filename = getFilenameFromDisposition(
        response.headers.get('content-disposition'),
        `movie-night-${nightId}.ics`
    );

    return { blob, filename };
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

async function getNotifications({ page = 1, limit = 20 } = {}) {
    if (!checkAuth()) return [];
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    return await apiCall(`/notifications?${params.toString()}`);
}

async function getUnreadNotificationsCount() {
    if (!checkAuth()) return 0;
    const result = await apiCall('/notifications/unread-count');
    const count = Number(result && result.count);
    return Number.isFinite(count) && count >= 0 ? count : 0;
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

// Homepage runtime is loaded from `js/homepage.js` on `website.html`.

// ── Navigation & Auth UI ─────────────────────────────────────────────────────

function updateAuthUI() {
    const loginLink = document.getElementById('loginLink');
    const signUpLink = document.getElementById('signUpLink');
    const logoutLink = document.getElementById('logoutLink');

    if (!loginLink || !signUpLink || !logoutLink) return;

    if (currentUser) {
        loginLink.style.display = 'none';
        signUpLink.style.display = 'none';
        logoutLink.style.display = '';

        let userBtn = document.getElementById('navUserBtn');
        if (!userBtn) {
            userBtn = document.createElement('a');
            userBtn.id = 'navUserBtn';
            userBtn.className = 'nav-auth-btn nav-auth-ghost';
            userBtn.href = 'Setting.html';
            logoutLink.parentNode.insertBefore(userBtn, logoutLink);
        }
        userBtn.textContent = currentUser.name;
    } else {
        loginLink.style.display = '';
        signUpLink.style.display = '';
        logoutLink.style.display = 'none';

        const userBtn = document.getElementById('navUserBtn');
        if (userBtn) userBtn.remove();
    }
}

// ── Initialization ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getPreferredTheme());
    initSkipLink();
    updateAuthUI();
    ensureAuthState().catch((error) => {
        console.error('Auth initialization failed:', error);
    });
    initMobileNavToggle();
    setActiveNavLink();
    initScrollObserver();

    const pageName = window.location.pathname.split('/').pop() || 'website.html';

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to sign out?')) {
                logout();
            }
        });
    }

    switch (pageName) {
        case 'website.html':
        case '':
        case '/':
        case 'index.html':
            if (typeof loadHomepageContent === 'function') {
                loadHomepageContent();
            }
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
