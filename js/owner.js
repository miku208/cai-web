// ============================================
// OWNER DASHBOARD SCRIPTS
// ============================================

class OwnerDashboard {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.editingCharacter = null;
        
        this.init();
    }

    async init() {
        // Check authentication and role
        this.currentUser = await checkAuth();
        if (!this.currentUser) {
            window.location.href = '/index.html';
            return;
        }
        
        if (this.currentUser.role !== 'owner') {
            window.location.href = '/chat.html';
            return;
        }

        // Load initial page
        await this.loadDashboard();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    async loadDashboard() {
        try {
            const { stats } = await api.get('/api/owner/stats');
            
            document.getElementById('statUsers').textContent = stats.totalUsers;
            document.getElementById('statChats').textContent = stats.totalChats;
            document.getElementById('statMessages').textContent = stats.totalMessages;
            document.getElementById('statCharacters').textContent = stats.totalCharacters;
        } catch (error) {
            Toast.show('Failed to load dashboard stats', 'error');
        }
    }

    async loadUsers() {
        try {
            const { users } = await api.get('/api/owner/users');
            const tbody = document.getElementById('usersTableBody');
            
            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
                return;
            }

            tbody.innerHTML = users.map(user => `
                <tr>
                    <td>
                        <strong>${this.escapeHtml(user.username)}</strong>
                        ${user.id === this.currentUser.id ? ' <span class="badge badge-info">You</span>' : ''}
                    </td>
                    <td>
                        <span class="badge badge-${user.role === 'owner' ? 'info' : user.role === 'premium' ? 'warning' : 'success'}">
                            ${user.role}
                        </span>
                    </td>
                    <td>${user.daily_message_count || 0}</td>
                    <td>${user.premium_expired_at ? new Date(user.premium_expired_at).toLocaleDateString() : '-'}</td>
                    <td>
                        ${user.is_banned 
                            ? '<span class="badge badge-danger">Banned</span>' 
                            : '<span class="badge badge-success">Active</span>'}
                    </td>
                    <td>
                        <div class="action-buttons">
                            ${user.id !== this.currentUser.id ? `
                                <button class="btn-sm btn-icon" onclick="changeUserRole('${user.id}', '${user.role}')" title="Change Role">
                                    👤
                                </button>
                                <button class="btn-sm btn-icon" onclick="togglePremium('${user.id}', '${user.premium_expired_at}')" title="Premium">
                                    ⭐
                                </button>
                                <button class="btn-sm btn-icon" onclick="resetLimit('${user.id}')" title="Reset Limit">
                                    🔄
                                </button>
                                <button class="btn-sm btn-icon" onclick="toggleBan('${user.id}', ${user.is_banned})" title="${user.is_banned ? 'Unban' : 'Ban'}">
                                    ${user.is_banned ? '✅' : '🚫'}
                                </button>
                                <button class="btn-sm btn-icon" onclick="deleteUser('${user.id}')" title="Delete" style="color: var(--danger);">
                                    🗑️
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            Toast.show('Failed to load users', 'error');
        }
    }

    async loadCharacters() {
        try {
            const { characters } = await api.get('/api/owner/characters');
            const tbody = document.getElementById('charactersTableBody');
            
            if (characters.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">No AI characters found</td></tr>';
                return;
            }

            tbody.innerHTML = characters.map(char => `
                <tr>
                    <td>
                        <img src="${char.avatar_url}" alt="${char.name}" 
                             style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;"
                             onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=default'">
                    </td>
                    <td>
                        <strong>${this.escapeHtml(char.name)}</strong>
                        ${char.description ? `<br><small style="color: var(--text-muted);">${this.escapeHtml(char.description).substring(0, 50)}...</small>` : ''}
                    </td>
                    <td>${char.model_name || 'N/A'}</td>
                    <td>
                        <span class="badge badge-${char.status === 'online' ? 'success' : char.status === 'maintenance' ? 'warning' : 'danger'}">
                            ${char.status}
                        </span>
                    </td>
                    <td>
                        <span class="badge badge-${char.visibility === 'public' ? 'info' : char.visibility === 'premium-only' ? 'warning' : 'danger'}">
                            ${char.visibility}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-sm btn-icon" onclick="editCharacter('${char.id}')" title="Edit">✏️</button>
                            <button class="btn-sm btn-icon" onclick="deleteCharacter('${char.id}')" title="Delete" style="color: var(--danger);">🗑️</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            Toast.show('Failed to load characters', 'error');
        }
    }

    async loadLogs() {
        try {
            const { logs } = await api.get('/api/owner/logs');
            const tbody = document.getElementById('logsTableBody');
            
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No logs found</td></tr>';
                return;
            }

            tbody.innerHTML = logs.map(log => `
                <tr>
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${log.user_id || 'System'}</td>
                    <td>${this.escapeHtml(log.action)}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                        ${JSON.stringify(log.details)}
                    </td>
                    <td>${log.ip_address || '-'}</td>
                </tr>
            `).join('');
        } catch (error) {
            Toast.show('Failed to load logs', 'error');
        }
    }

    showCharacterForm(character = null) {
        this.editingCharacter = character;
        
        document.getElementById('characterModalTitle').textContent = 
            character ? 'Edit AI Character' : 'Add AI Character';
        
        document.getElementById('charName').value = character?.name || '';
        document.getElementById('charAvatar').value = character?.avatar_url || '';
        document.getElementById('charDescription').value = character?.description || '';
        document.getElementById('charPrompt').value = character?.system_prompt || '';
        document.getElementById('charEndpoint').value = character?.endpoint_url || '';
        document.getElementById('charModel').value = character?.model_name || 'gpt-3.5-turbo';
        document.getElementById('charApiKey').value = character?.api_key || '';
        document.getElementById('charStatus').value = character?.status || 'online';
        document.getElementById('charVisibility').value = character?.visibility || 'public';
        
        document.getElementById('characterModal').classList.remove('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupEventListeners() {
        // Character form submission
        document.getElementById('characterForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const characterData = {
                name: document.getElementById('charName').value,
                avatar_url: document.getElementById('charAvatar').value,
                description: document.getElementById('charDescription').value,
                system_prompt: document.getElementById('charPrompt').value,
                endpoint_url: document.getElementById('charEndpoint').value,
                model_name: document.getElementById('charModel').value,
                api_key: document.getElementById('charApiKey').value || null,
                status: document.getElementById('charStatus').value,
                visibility: document.getElementById('charVisibility').value
            };

            try {
                if (this.editingCharacter) {
                    await api.put(`/api/owner/characters/${this.editingCharacter.id}`, characterData);
                    Toast.show('Character updated successfully', 'success');
                } else {
                    await api.post('/api/owner/characters', characterData);
                    Toast.show('Character created successfully', 'success');
                }
                
                document.getElementById('characterModal').classList.add('hidden');
                await this.loadCharacters();
            } catch (error) {
                Toast.show(error.message, 'error');
            }
        });
    }
}

// Initialize dashboard
const dashboard = new OwnerDashboard();

// Global functions
function switchPage(page) {
    dashboard.currentPage = page;
    
    // Hide all pages
    ['dashboard', 'users', 'characters', 'logs'].forEach(p => {
        document.getElementById(`page-${p}`).classList.add('hidden');
    });
    
    // Show selected page
    document.getElementById(`page-${page}`).classList.remove('hidden');
    
    // Update nav
    document.querySelectorAll('.dashboard-nav-item[data-page]').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // Load page data
    switch(page) {
        case 'dashboard':
            dashboard.loadDashboard();
            break;
        case 'users':
            dashboard.loadUsers();
            break;
        case 'characters':
            dashboard.loadCharacters();
            break;
        case 'logs':
            dashboard.loadLogs();
            break;
    }
}

function showCharacterForm() {
    dashboard.showCharacterForm();
}

function editCharacter(charId) {
    // Find character and edit
    api.get('/api/owner/characters').then(({ characters }) => {
        const character = characters.find(c => c.id === charId);
        if (character) {
            dashboard.showCharacterForm(character);
        }
    });
}

async function deleteCharacter(charId) {
    if (confirm('Are you sure you want to delete this character?')) {
        try {
            await api.delete(`/api/owner/characters/${charId}`);
            Toast.show('Character deleted', 'success');
            dashboard.loadCharacters();
        } catch (error) {
            Toast.show('Failed to delete character', 'error');
        }
    }
}

async function changeUserRole(userId, currentRole) {
    const newRole = currentRole === 'user' ? 'premium' : 'user';
    try {
        await api.put(`/api/owner/users/${userId}`, { role: newRole });
        Toast.show(`User role changed to ${newRole}`, 'success');
        dashboard.loadUsers();
    } catch (error) {
        Toast.show('Failed to change role', 'error');
    }
}

async function togglePremium(userId, currentExpiry) {
    if (currentExpiry && currentExpiry !== 'null') {
        // Remove premium
        try {
            await api.put(`/api/owner/users/${userId}`, { 
                role: 'user',
                premium_expired_at: null 
            });
            Toast.show('Premium removed', 'success');
        } catch (error) {
            Toast.show('Failed to update premium', 'error');
        }
    } else {
        // Add premium for 30 days
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        
        try {
            await api.put(`/api/owner/users/${userId}`, { 
                role: 'premium',
                premium_expired_at: expiry.toISOString()
            });
            Toast.show('Premium added for 30 days', 'success');
        } catch (error) {
            Toast.show('Failed to update premium', 'error');
        }
    }
    dashboard.loadUsers();
}

async function resetLimit(userId) {
    try {
        await api.put(`/api/owner/users/${userId}`, { daily_message_count: 0 });
        Toast.show('Limit reset', 'success');
        dashboard.loadUsers();
    } catch (error) {
        Toast.show('Failed to reset limit', 'error');
    }
}

async function toggleBan(userId, isBanned) {
    try {
        await api.put(`/api/owner/users/${userId}`, { is_banned: !isBanned });
        Toast.show(isBanned ? 'User unbanned' : 'User banned', 'success');
        dashboard.loadUsers();
    } catch (error) {
        Toast.show('Failed to update user', 'error');
    }
}

async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            await api.delete(`/api/owner/users/${userId}`);
            Toast.show('User deleted', 'success');
            dashboard.loadUsers();
        } catch (error) {
            Toast.show('Failed to delete user', 'error');
        }
    }
}

async function refreshUsers() {
    await dashboard.loadUsers();
    Toast.show('Users refreshed', 'success');
}

function goToChat() {
    window.location.href = '/chat.html';
}

async function logout() {
    try {
        await api.post('/api/auth/logout');
        window.location.href = '/index.html';
    } catch (error) {
        Toast.show('Failed to logout', 'error');
    }
}

// Mobile sidebar toggle
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.createElement('button');
    hamburger.className = 'hamburger-btn';
    hamburger.textContent = '☰';
    hamburger.style.cssText = `
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 300;
        display: none;
    `;
    
    hamburger.addEventListener('click', () => {
        document.getElementById('dashboardSidebar').classList.toggle('open');
    });
    
    document.body.appendChild(hamburger);
    
    // Show/hide based on screen size
    function updateHamburger() {
        hamburger.style.display = window.innerWidth <= 768 ? 'block' : 'none';
    }
    
    updateHamburger();
    window.addEventListener('resize', updateHamburger);
});