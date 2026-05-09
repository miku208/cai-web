// ============================================
// CHAT APPLICATION - FULL WITH MOOD INDICATOR
// With Back Button, Typing, Context, Mood
// ============================================

class ChatApp {
    constructor() {
        this.currentUser = null;
        this.currentCharacter = null;
        this.currentChat = null;
        this.characters = [];
        this.chats = [];
        this.messages = [];
        this.isLoading = false;
        this.backBtn = null;
        
        // DOM refs
        this.sidebar = document.getElementById('sidebar');
        this.aiList = document.getElementById('aiList');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatInputContainer = document.getElementById('chatInputContainer');
        this.limitCounter = document.getElementById('limitCounter');
        this.chatHeaderName = document.getElementById('chatHeaderName');
        this.chatHeaderStatus = document.getElementById('chatHeaderStatus');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.hamburgerBtn = document.getElementById('hamburgerBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.searchAI = document.getElementById('searchAI');
        this.userAvatar = document.getElementById('userAvatar');
        this.userName = document.getElementById('userName');
        this.userRole = document.getElementById('userRole');
        this.aiSource = document.getElementById('aiSource');
        
        this.init();
    }

    async init() {
        this.currentUser = await checkAuth();
        if (!this.currentUser) { window.location.href = '/index.html'; return; }
        
        this.userAvatar.textContent = this.currentUser.username[0].toUpperCase();
        this.userName.textContent = this.currentUser.username;
        this.userRole.textContent = this.currentUser.role;
        this.userRole.style.textTransform = 'capitalize';
        
        if (this.currentUser.role === 'owner') this.userRole.style.color = '#8b5cf6';
        else if (this.currentUser.role === 'premium') this.userRole.style.color = '#f59e0b';
        
        this.createBackButton();
        await this.loadData();
        this.setupEvents();
        this.updateLimitCounter();
        
        if (this.currentUser.role === 'owner') this.addOwnerLink();
    }

    // ============================================
    // BACK BUTTON
    // ============================================
    createBackButton() {
        const header = document.getElementById('chatHeader');
        if (!header) return;
        
        const btn = document.createElement('button');
        btn.id = 'backBtn';
        btn.innerHTML = '← Back';
        btn.style.cssText = `
            display: flex; align-items: center; gap: 4px;
            background: #1a1b23; border: 1px solid #27272a;
            color: #e4e4e7; font-size: 13px; font-weight: 600;
            cursor: pointer; padding: 8px 16px; border-radius: 20px;
            white-space: nowrap; flex-shrink: 0; margin-right: 8px;
            transition: all 0.2s ease; font-family: inherit;
        `;
        
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
            btn.style.borderColor = 'transparent';
            btn.style.color = 'white';
            btn.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.3)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = '#1a1b23';
            btn.style.borderColor = '#27272a';
            btn.style.color = '#e4e4e7';
            btn.style.boxShadow = 'none';
        });
        
        btn.addEventListener('click', () => this.goBack());
        
        const hamburger = document.getElementById('hamburgerBtn');
        if (hamburger) {
            hamburger.after(btn);
        } else {
            header.insertBefore(btn, header.firstChild);
        }
        
        this.backBtn = btn;
    }

    goBack() {
        this.currentCharacter = null;
        this.currentChat = null;
        this.messages = [];
        
        this.chatInputContainer.style.display = 'none';
        this.chatHeaderName.textContent = 'Select an AI';
        this.resetMoodIndicator();
        
        if (this.aiSource) this.aiSource.style.display = 'none';
        
        this.messagesContainer.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-icon">🤖</div>
                <h2 class="welcome-title">Welcome to AI Chat</h2>
                <p class="welcome-subtitle">Select an AI from the sidebar to start.</p>
            </div>
        `;
        
        this.renderAIList();
        this.updateLimitCounter();
        
        if (window.innerWidth <= 768) this.sidebar.classList.add('open');
        this.searchAI?.focus();
    }

    // ============================================
    // MOOD INDICATOR
    // ============================================
    updateMoodIndicator(mood, emoji, color, relationship) {
        if (!this.chatHeaderStatus) return;
        
        const moodColors = {
            happy: '#10b981',
            neutral: '#71717a',
            annoyed: '#ef4444',
            clingy: '#ec4899',
            sleepy: '#8b5cf6',
            caring: '#3b82f6'
        };
        
        const moodEmojis = {
            happy: '😊',
            neutral: '😐',
            annoyed: '😤',
            clingy: '🥺',
            sleepy: '😴',
            caring: '🤗'
        };
        
        const m = mood || 'neutral';
        const e = emoji || moodEmojis[m] || '😐';
        const c = color || moodColors[m] || '#71717a';
        const r = relationship || 50;
        
        // Heart color based on relationship
        let heartColor = '#71717a';
        if (r >= 80) heartColor = '#ec4899';
        else if (r >= 60) heartColor = '#f59e0b';
        else if (r >= 40) heartColor = '#10b981';
        else if (r < 20) heartColor = '#ef4444';
        
        this.chatHeaderStatus.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px;">
                <span class="status-dot" style="background: ${c}; width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
                <span class="mood-${m}" style="color: ${c}; font-weight: 500;">${e} ${m}</span>
                <span style="font-size: 11px; color: ${heartColor}; margin-left: 2px;">
                    ❤️ ${r}/100
                </span>
            </span>
        `;
        
        // Add pulse animation for non-neutral moods
        const dot = this.chatHeaderStatus.querySelector('.status-dot');
        if (dot && m !== 'neutral') {
            dot.style.animation = 'moodPulse 2s infinite';
        }
    }

    resetMoodIndicator() {
        if (!this.chatHeaderStatus) return;
        this.chatHeaderStatus.innerHTML = `
            <span class="status-dot"></span>
            <span>Online</span>
        `;
    }

    // ============================================
    // DATA LOADING
    // ============================================
    async loadData() {
        try {
            const [charRes, chatRes] = await Promise.all([
                api.get('/api/characters'),
                api.get('/api/chats')
            ]);
            this.characters = charRes.characters || [];
            this.chats = chatRes.chats || [];
            this.renderAIList();
        } catch (e) {
            console.error('Load error:', e);
            Toast.show('Failed to load data', 'error');
        }
    }

    renderAIList(filter = '') {
        if (!this.aiList) return;
        this.aiList.innerHTML = '';
        
        const filtered = this.characters.filter(c => 
            c.name.toLowerCase().includes((filter || '').toLowerCase()) ||
            (c.description || '').toLowerCase().includes((filter || '').toLowerCase())
        );
        
        if (filtered.length === 0) {
            this.aiList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #71717a;">
                    <p style="font-size: 40px; margin-bottom: 12px;">🔍</p>
                    <p>No AI characters found</p>
                </div>`;
            return;
        }
        
        filtered.forEach(c => {
            const chat = this.chats.find(ch => ch.character_id === c.id);
            const div = document.createElement('div');
            div.className = 'ai-list-item';
            if (this.currentCharacter?.id === c.id) div.classList.add('active');
            
            // Get mood for this chat
            const moodEmoji = chat?.mood ? this.getMoodEmoji(chat.mood) : '';
            
            div.innerHTML = `
                <div class="ai-avatar">
                    <img src="${c.avatar_url}" alt="${this.escapeHtml(c.name)}" 
                         onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=default'">
                    <span class="online-indicator" style="${c.status !== 'online' ? 'background: #71717a;' : ''}"></span>
                </div>
                <div class="ai-info">
                    <div class="ai-name">
                        ${this.escapeHtml(c.name)}
                        ${moodEmoji ? `<span style="font-size:12px;margin-left:4px;">${moodEmoji}</span>` : ''}
                    </div>
                    <div class="ai-last-message">${(chat?.last_message?.content || c.description || 'Start a conversation').substring(0, 35)}</div>
                </div>
                <div class="ai-meta">
                    <div class="ai-time">${chat ? formatTime(chat.updated_at) : ''}</div>
                </div>
            `;
            
            div.addEventListener('click', () => this.selectCharacter(c));
            this.aiList.appendChild(div);
        });
    }

    getMoodEmoji(mood) {
        const emojis = {
            happy: '😊',
            neutral: '😐',
            annoyed: '😤',
            clingy: '🥺',
            sleepy: '😴',
            caring: '🤗'
        };
        return emojis[mood] || '';
    }

    async selectCharacter(c) {
        this.currentCharacter = c;
        this.chatHeaderName.textContent = c.name;
        this.resetMoodIndicator();
        this.chatInputContainer.style.display = 'block';
        this.chatInput.disabled = false;
        this.sendBtn.disabled = false;
        
        let chat = this.chats.find(ch => ch.character_id === c.id);
        if (!chat) {
            try {
                const res = await api.post('/api/chats', { character_id: c.id });
                chat = res.chat;
                this.chats.unshift(chat);
            } catch (e) {
                Toast.show('Failed to create chat', 'error');
                return;
            }
        }
        this.currentChat = chat;
        
        // Update mood indicator if chat has mood
        if (chat.mood && chat.mood !== 'neutral') {
            const emojis = {
                happy: '😊', neutral: '😐', annoyed: '😤',
                clingy: '🥺', sleepy: '😴', caring: '🤗'
            };
            const colors = {
                happy: '#10b981', neutral: '#71717a', annoyed: '#ef4444',
                clingy: '#ec4899', sleepy: '#8b5cf6', caring: '#3b82f6'
            };
            this.updateMoodIndicator(chat.mood, emojis[chat.mood], colors[chat.mood], chat.relationship_level || 50);
        }
        
        await this.loadMessages();
        this.renderAIList();
        this.chatInput.focus();
        if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
    }

    async loadMessages() {
        if (!this.currentChat) return;
        try {
            const res = await api.get(`/api/chats/${this.currentChat.id}/messages`);
            this.messages = res.messages || [];
            this.renderMessages();
        } catch (e) {
            console.error('Load messages error:', e);
        }
    }

    // ============================================
    // MESSAGE RENDERING
    // ============================================
    renderMessages() {
        if (!this.messagesContainer) return;
        this.messagesContainer.innerHTML = '';
        
        if (this.messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #71717a;">
                    <p style="font-size: 48px; margin-bottom: 16px;">💭</p>
                    <p style="font-size: 16px;">Start chatting with</p>
                    <p style="font-size: 18px; font-weight: 600; color: #e4e4e7; margin-top: 4px;">
                        ${this.escapeHtml(this.currentCharacter?.name || 'AI')}
                    </p>
                </div>`;
            return;
        }
        
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        let lastDate = '';
        
        this.messages.forEach(msg => {
            const msgDate = new Date(msg.created_at).toDateString();
            
            if (msgDate !== lastDate) {
                lastDate = msgDate;
                const sep = document.createElement('div');
                sep.style.cssText = 'text-align:center;padding:20px 0 12px;color:#71717a;font-size:12px;font-weight:600;';
                if (msgDate === today) sep.textContent = 'Today';
                else if (msgDate === yesterday) sep.textContent = 'Yesterday';
                else sep.textContent = new Date(msg.created_at).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
                this.messagesContainer.appendChild(sep);
            }
            
            const div = document.createElement('div');
            div.className = `message ${msg.role}`;
            div.style.animation = 'messageSlideIn 0.3s ease-out';
            const time = formatTime(msg.created_at);
            
            if (msg.role === 'assistant') {
                div.innerHTML = `
                    <img src="${this.currentCharacter?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=default'}" 
                         style="width:28px;height:28px;border-radius:50%;flex-shrink:0;margin-top:4px;" 
                         onerror="this.style.display='none'">
                    <div>
                        <div class="message-bubble">${this.formatMessage(msg.content)}</div>
                        <div class="message-time">${time}</div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div style="flex:1;"></div>
                    <div style="text-align:right;">
                        <div class="message-bubble">${this.formatMessage(msg.content)}</div>
                        <div class="message-time">${time}</div>
                    </div>
                    <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;flex-shrink:0;margin-top:4px;">
                        ${this.currentUser.username[0].toUpperCase()}
                    </div>
                `;
            }
            
            this.messagesContainer.appendChild(div);
        });
        
        this.scrollToBottom();
    }

    formatMessage(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        let formatted = div.innerHTML;
        formatted = formatted.replace(/\n/g, '<br>');
        formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, 
            '<pre style="background:#0a0a0f;padding:12px;border-radius:8px;overflow-x:auto;margin:8px 0;font-size:13px;"><code>$2</code></pre>');
        formatted = formatted.replace(/`([^`]+)`/g, 
            '<code style="background:#0a0a0f;padding:2px 6px;border-radius:4px;font-size:13px;">$1</code>');
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // ============================================
    // SEND MESSAGE
    // ============================================
    async sendMessage() {
        const content = this.chatInput?.value.trim();
        if (!content || this.isLoading || !this.currentChat) return;
        
        const limit = CONFIG.LIMITS[this.currentUser.role] || 50;
        if (limit !== Infinity && this.currentUser.daily_message_count >= limit) {
            document.getElementById('limitModal')?.classList.remove('hidden');
            return;
        }
        
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';
        
        this.messages.push({ role: 'user', content, created_at: new Date().toISOString() });
        this.renderMessages();
        
        this.showTyping();
        
        this.isLoading = true;
        if (this.chatInput) this.chatInput.disabled = true;
        if (this.sendBtn) this.sendBtn.disabled = true;
        
        try {
            const res = await api.post(`/api/chats/${this.currentChat.id}/messages`, { content });
            this.hideTyping();
            
            this.messages.push(res.aiMessage);
            
            // Update source
            if (res.aiSource && this.aiSource) {
                this.aiSource.textContent = `🤖 ${res.aiSource}`;
                this.aiSource.style.display = 'block';
            }
            
            // Update mood indicator
            if (res.mood) {
                this.updateMoodIndicator(
                    res.mood, 
                    res.moodEmoji, 
                    res.moodColor, 
                    res.relationship_level
                );
            }
            
            // Update counter
            if (res.remaining !== undefined) {
                this.currentUser.daily_message_count = (CONFIG.LIMITS[this.currentUser.role] || 50) - res.remaining;
            }
            
            this.renderMessages();
            this.updateLimitCounter();
            
            // Refresh chats
            const chatRes = await api.get('/api/chats');
            this.chats = chatRes.chats || [];
            this.renderAIList();
            
            // Update current chat mood
            const updatedChat = this.chats.find(c => c.id === this.currentChat?.id);
            if (updatedChat) {
                this.currentChat.mood = updatedChat.mood;
                this.currentChat.relationship_level = updatedChat.relationship_level;
            }
            
        } catch (e) {
            this.hideTyping();
            if (e.message.includes('Daily limit')) {
                document.getElementById('limitModal')?.classList.remove('hidden');
                this.messages.pop();
                this.renderMessages();
            } else {
                Toast.show('Error: ' + e.message, 'error');
            }
        } finally {
            this.isLoading = false;
            if (this.chatInput) this.chatInput.disabled = false;
            if (this.sendBtn) this.sendBtn.disabled = false;
            if (this.chatInput) this.chatInput.focus();
        }
    }

    // ============================================
    // TYPING INDICATOR
    // ============================================
    showTyping() {
        this.hideTyping();
        const div = document.createElement('div');
        div.id = 'typingIndicator';
        div.style.cssText = `
            display: flex; align-items: center; gap: 10px;
            padding: 14px 8px; color: #a1a1aa; font-size: 14px;
        `;
        div.innerHTML = `
            <img src="${this.currentCharacter?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=default'}" 
                 style="width:24px;height:24px;border-radius:50%;" 
                 onerror="this.style.display='none'">
            <span>${this.currentCharacter?.name || 'AI'} is typing</span>
            <span style="display:flex;gap:4px;">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </span>
        `;
        this.messagesContainer.appendChild(div);
        this.scrollToBottom();
    }

    hideTyping() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

    scrollToBottom() {
        setTimeout(() => {
            if (this.messagesContainer) {
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }
        }, 50);
    }

    updateLimitCounter() {
        if (!this.limitCounter) return;
        const limit = CONFIG.LIMITS[this.currentUser.role] || 50;
        const used = this.currentUser.daily_message_count || 0;
        const remaining = limit === Infinity ? '∞' : limit - used;
        this.limitCounter.textContent = `Messages remaining: ${remaining}/${limit === Infinity ? '∞' : limit}`;
        
        this.limitCounter.classList.remove('warning', 'danger');
        if (limit !== Infinity && remaining <= 10 && remaining > 0) {
            this.limitCounter.classList.add('warning');
        } else if (remaining <= 0) {
            this.limitCounter.classList.add('danger');
        }
    }

    addOwnerLink() {
        const footer = document.querySelector('.sidebar-footer');
        if (!footer) return;
        const link = document.createElement('a');
        link.href = '/owner.html';
        link.textContent = '👑 Owner Dashboard';
        link.style.cssText = `
            display: block; text-align: center; padding: 10px; margin-bottom: 8px;
            color: #8b5cf6; text-decoration: none; font-size: 13px; font-weight: 600;
            border: 1px solid #8b5cf6; border-radius: 12px; transition: all 0.2s ease;
        `;
        link.addEventListener('mouseenter', () => link.style.background = 'rgba(139, 92, 246, 0.15)');
        link.addEventListener('mouseleave', () => link.style.background = 'transparent');
        footer.insertBefore(link, footer.firstChild);
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    setupEvents() {
        this.chatInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.chatInput?.addEventListener('input', () => {
            this.chatInput.style.height = 'auto';
            this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 100) + 'px';
        });
        
        this.sendBtn?.addEventListener('click', () => this.sendMessage());
        this.newChatBtn?.addEventListener('click', () => this.goBack());
        this.hamburgerBtn?.addEventListener('click', () => this.sidebar?.classList.toggle('open'));
        
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                this.sidebar?.classList.contains('open') &&
                !this.sidebar.contains(e.target) && 
                !this.hamburgerBtn?.contains(e.target)) {
                this.sidebar.classList.remove('open');
            }
        });
        
        this.searchAI?.addEventListener('input', (e) => this.renderAIList(e.target.value));
        
        this.logoutBtn?.addEventListener('click', async () => {
            try {
                await api.post('/api/auth/logout');
                window.location.href = '/index.html';
            } catch (e) {
                Toast.show('Failed to logout', 'error');
            }
        });
        
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && this.sidebar) {
                this.sidebar.classList.remove('open');
            }
        });
        
        // Right-click delete
        this.messagesContainer?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.currentChat) {
                const modal = document.getElementById('deleteModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    document.getElementById('confirmDeleteBtn').onclick = async () => {
                        try {
                            await api.delete(`/api/chats/${this.currentChat.id}`);
                            modal.classList.add('hidden');
                            Toast.show('Chat deleted', 'success');
                            this.chats = this.chats.filter(c => c.id !== this.currentChat.id);
                            this.goBack();
                        } catch (err) {
                            Toast.show('Failed to delete', 'error');
                        }
                    };
                }
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== this.chatInput)) {
                e.preventDefault();
                this.searchAI?.focus();
            }
            if (e.key === 'Escape' && this.currentCharacter) {
                this.goBack();
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});

// Add mood pulse animation
const moodStyle = document.createElement('style');
moodStyle.textContent = `
    @keyframes moodPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.3); }
    }
    @keyframes messageSlideIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .mood-happy { color: #10b981; }
    .mood-neutral { color: #71717a; }
    .mood-annoyed { color: #ef4444; }
    .mood-clingy { color: #ec4899; }
    .mood-sleepy { color: #8b5cf6; }
    .mood-caring { color: #3b82f6; }
`;
document.head.appendChild(moodStyle);
