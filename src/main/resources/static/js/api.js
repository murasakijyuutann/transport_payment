// API Configuration and Utility Functions

const API_BASE_URL = 'http://localhost:8080/api';

// Storage keys
const STORAGE_KEYS = {
    TOKEN: 'auth_token',
    USER: 'user_data',
    USER_ID: 'user_id'
};

// Get stored token
function getToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

// Set token
function setToken(token) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
}

// Get stored user
function getUser() {
    const userData = localStorage.getItem(STORAGE_KEYS.USER);
    return userData ? JSON.parse(userData) : null;
}

// Set user
function setUser(user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.USER_ID, user.id);
}

// Get user ID
function getUserId() {
    return localStorage.getItem(STORAGE_KEYS.USER_ID);
}

// Clear storage and logout
function logout() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
    window.location.href = '/';
}

// Check if user is authenticated
function isAuthenticated() {
    return !!getToken();
}

// Redirect to login if not authenticated
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        // Handle unauthorized
        if (response.status === 401) {
            logout();
            throw new Error('Session expired. Please login again.');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// Auth API
const AuthAPI = {
    login: async (email, password) => {
        return await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    register: async (userData) => {
        return await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }
};

// User API
const UserAPI = {
    getProfile: async (userId) => {
        return await apiRequest(`/users/${userId}`);
    },

    updateProfile: async (userId, userData) => {
        return await apiRequest(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    },

    addBalance: async (userId, amount) => {
        return await apiRequest(`/users/${userId}/balance/add?amount=${amount}`, {
            method: 'POST'
        });
    },

    changePassword: async (userId, oldPassword, newPassword) => {
        return await apiRequest(`/users/${userId}/password`, {
            method: 'PUT',
            body: JSON.stringify({ oldPassword, newPassword })
        });
    }
};

// Card API
const CardAPI = {
    getUserCards: async (userId) => {
        return await apiRequest(`/cards/user/${userId}`);
    },

    addCard: async (userId, cardData) => {
        return await apiRequest(`/cards/user/${userId}`, {
            method: 'POST',
            body: JSON.stringify(cardData)
        });
    },

    setDefaultCard: async (cardId) => {
        return await apiRequest(`/cards/${cardId}/set-default`, {
            method: 'PUT'
        });
    },

    deleteCard: async (cardId) => {
        return await apiRequest(`/cards/${cardId}`, {
            method: 'DELETE'
        });
    }
};

// Journey API
const JourneyAPI = {
    getUserJourneys: async (userId) => {
        return await apiRequest(`/journeys/user/${userId}`);
    },

    tapIn: async (journeyData) => {
        return await apiRequest('/journeys/tap-in', {
            method: 'POST',
            body: JSON.stringify(journeyData)
        });
    },

    tapOut: async (journeyId, exitStationId) => {
        return await apiRequest(`/journeys/${journeyId}/tap-out?exitStationId=${exitStationId}`, {
            method: 'PUT'
        });
    },

    getActiveJourney: async (userId) => {
        try {
            const journeys = await apiRequest(`/journeys/user/${userId}`);
            return journeys.data?.find(j => j.status === 'IN_PROGRESS') || null;
        } catch (error) {
            return null;
        }
    }
};

// Transaction API
const TransactionAPI = {
    getUserTransactions: async (userId) => {
        return await apiRequest(`/transactions/user/${userId}`);
    }
};

// Station API
const StationAPI = {
    getAllStations: async () => {
        return await apiRequest('/stations');
    },

    getStationById: async (stationId) => {
        return await apiRequest(`/stations/${stationId}`);
    }
};

// Utility Functions
function showAlert(containerId, message, type = 'success') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.innerHTML = '';
    container.appendChild(alertDiv);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function getStatusBadge(status) {
    const statusMap = {
        'ACTIVE': 'success',
        'BLOCKED': 'danger',
        'EXPIRED': 'warning',
        'COMPLETED': 'success',
        'IN_PROGRESS': 'warning',
        'CANCELLED': 'danger',
        'SUCCESS': 'success',
        'FAILED': 'danger',
        'PENDING': 'info'
    };
    
    const badgeClass = statusMap[status] || 'secondary';
    return `<span class="badge bg-${badgeClass}">${status}</span>`;
}

function maskCardNumber(cardNumber) {
    if (!cardNumber) return '';
    const lastFour = cardNumber.slice(-4);
    return `•••• •••• •••• ${lastFour}`;
}

// Initialize common elements
function initializeCommonElements() {
    // Set user name in navbar
    const user = getUser();
    if (user) {
        const userNameElements = document.querySelectorAll('#userName');
        userNameElements.forEach(el => {
            el.textContent = `${user.firstName} ${user.lastName}`;
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                logout();
            }
        });
    }
}

// Call on page load for protected pages
if (window.location.pathname !== '/' && window.location.pathname !== '/register.html') {
    document.addEventListener('DOMContentLoaded', () => {
        if (requireAuth()) {
            initializeCommonElements();
        }
    });
}
