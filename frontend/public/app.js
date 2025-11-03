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

// Check if user is logged in
function checkAuth() {
    if (!currentUser) {
        window.location.href = 'Log_In.html';
        return false;
    }
    return true;
}

// Update UI based on login status
function updateAuthUI() {
    const loginLink = document.querySelector('a[href="Log_In.html"]');
    const signupLink = document.querySelector('a[href="Sign_Up.html"]');

    if (currentUser && loginLink) {
        // Change login link to logout
        loginLink.textContent = 'Logout';
        loginLink.href = '#';
        loginLink.onclick = (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                logout();
            }
        };

        // Change signup link to show user name
        if (signupLink) {
            signupLink.textContent = currentUser.name;
            signupLink.href = 'Setting.html';
        }
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();

    // Add page-specific initialization
    const currentPage = window.location.pathname.split('/').pop();

    switch (currentPage) {
        case 'website.html':
            // Homepage specific code
            if (currentUser) {
                const welcomeMessage = document.createElement('p');
                welcomeMessage.textContent = `Welcome back, ${currentUser.name}!`;
                welcomeMessage.style.textAlign = 'center';
                welcomeMessage.style.marginTop = '20px';
                document.querySelector('h1').after(welcomeMessage);
            }
            break;

        case 'Stream_team.html':
            // Load and display groups
            loadGroups();
            break;

        case 'Binge_Bank.html':
            // Load and display movies
            loadMovies();
            break;
    }
});

// Helper functions for specific pages
async function loadGroups() {
    if (!checkAuth()) return;

    const groups = await getGroups();
    // Add code to display groups on the page
    console.log('Groups:', groups);
}

async function loadMovies() {
    const movies = await getMovies();
    // Add code to display movies on the page
    console.log('Movies:', movies);
}