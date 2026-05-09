// ============================================
// GLOBAL CONFIGURATION
// ============================================

const CONFIG = {
    API_BASE_URL: window.location.origin,
    SUPABASE_URL: 'https://cklgmpmiuncxfgpoqqcm.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrbGdtcG1pdW5jeGZncG9xcWNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMxMjE5MiwiZXhwIjoyMDkzODg4MTkyfQ.CXDYzgyfoZFvmWyLhjCR1T1BBSkjikrPq3QqjOgM178',
    
    // Message limits per role
    LIMITS: {
        user: 50,
        premium: 200,
        owner: Infinity
    },

    // Toast durations
    TOAST_DURATION: 3000,

    // Typing animation delay (ms)
    TYPING_DELAY: 1500
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// API Helper
const api = {
    async get(endpoint) {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
            credentials: 'same-origin'
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    },

    async put(endpoint, data) {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    },

    async delete(endpoint) {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    }
};

// Toast Notification System
class Toast {
    static container = null;

    static init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    static show(message, type = 'info') {
        this.init();
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.TOAST_DURATION);
    }
}

// Format date helper
function formatTime(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const diff = now - messageDate;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return 'Yesterday';
    return messageDate.toLocaleDateString();
}

// Check authentication
async function checkAuth() {
    try {
        const { user } = await api.get('/api/auth/me');
        return user;
    } catch (error) {
        return null;
    }
}

// Redirect based on role
async function redirectBasedOnRole() {
    const user = await checkAuth();
    if (user) {
        if (user.role === 'owner') {
            window.location.href = '/owner.html';
        } else {
            window.location.href = '/chat.html';
        }
    }
}
