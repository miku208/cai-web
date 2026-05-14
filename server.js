// ============================================
// AI CHAT BACKEND SERVER - MODULAR
// ChatEverywhere + Gemini + Neosantara + Ryuu + Custom
// Gender + Mood + Adult System
// Email OTP via Resend
// User-Generated AI Characters with Package System + Visibility
// Music Player via NexRay Spotify API
// Security: Public settings FILTERED, Owner-only full settings
// ============================================

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const config = require('./config.json');

const { callAI } = require('./ai-callers');
const { buildMoodPrompt, getLimit } = require('./mood-builder');
const { setupMusicRoutes } = require('./music-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Configuration
const supabase = createClient(config.supabase_url, config.supabase_anon_key);

// ============================================
// MIDDLEWARE SETUP
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OG Image & Social Media Scrapers
app.use((req, res, next) => {
    const ua = (req.get('user-agent') || '').toLowerCase();
    const scrapers = [
        'facebookexternalhit', 'twitterbot', 'whatsapp',
        'telegrambot', 'discordbot', 'linkedinbot', 'slackbot'
    ];
    if (scrapers.some(s => ua.includes(s)) && req.method === 'GET' && !req.path.startsWith('/api/')) {
        console.log('✅ Scraper allowed:', ua.substring(0, 50));
        return next();
    }
    next();
});

// OG Image endpoint
app.get('/og-image.png', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0a0a0f"/>
                <stop offset="100%" style="stop-color:#1a1025"/>
            </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#bg)"/>
        <circle cx="200" cy="200" r="150" fill="#7c3aed" opacity="0.1"/>
        <circle cx="1000" cy="450" r="200" fill="#7c3aed" opacity="0.08"/>
        <rect x="80" y="80" width="1040" height="470" rx="40" fill="#121217" stroke="#7c3aed" stroke-width="3" opacity="0.9"/>
        <text x="600" y="240" text-anchor="middle" fill="white" font-size="80" font-family="sans-serif" font-weight="bold">c.ai</text>
        <text x="600" y="310" text-anchor="middle" fill="#a0a0a0" font-size="30" font-family="sans-serif">By MikuHost</text>
        <text x="600" y="380" text-anchor="middle" fill="#7c3aed" font-size="26" font-family="sans-serif">AI Characters with Personality</text>
        <rect x="400" y="440" width="400" height="56" rx="28" fill="#7c3aed"/>
        <text x="600" y="477" text-anchor="middle" fill="white" font-size="24" font-family="sans-serif" font-weight="bold">Start Chatting 💬</text>
    </svg>`);
});

// Session
app.use(session({
    secret: config.session_secret || 'fallback-secret-change-me-please',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ============================================
// SERVE HTML FILES
// ============================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/chat.html', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/owner.html', (req, res) => res.sendFile(path.join(__dirname, 'owner.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/owner', (req, res) => res.sendFile(path.join(__dirname, 'owner.html')));
app.get('/qris', (req, res) => res.sendFile(path.join(__dirname, 'qris.html')));
app.get('/verify', (req, res) => res.sendFile(path.join(__dirname, 'verify.html')));

// ============================================
// MUSIC ROUTES
// ============================================
setupMusicRoutes(app);

// ============================================
// PASSWORD UTILS
// ============================================
const passwordUtils = {
    isHashed: (str) => str && (str.startsWith('$2a$') || str.startsWith('$2b$')),
    verify: async (plainPassword, storedPassword) => {
        if (!storedPassword) return false;
        if (passwordUtils.isHashed(storedPassword)) {
            try { return await bcrypt.compare(plainPassword, storedPassword); }
            catch (e) { console.error('bcrypt compare error:', e.message); return false; }
        }
        return plainPassword === storedPassword;
    },
    hash: async (password) => {
        try { return await bcrypt.hash(password, 10); }
        catch (e) { console.error('bcrypt hash error:', e.message); throw new Error('Password hashing failed'); }
    }
};

// ============================================
// AUTH MIDDLEWARE
// ============================================
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized - Please login first' });
    }
    next();
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!roles.includes(req.session.userRole)) {
            return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
        }
        next();
    };
};

// ============================================
// EMAIL OTP UTILS (Resend API)
// ============================================
async function sendOTPEmail(email, otp) {
    try {
        const { data: settings } = await supabase.from('settings').select('resend_api_key, sender_email').eq('id', 1).single();
        if (!settings?.resend_api_key || !settings?.sender_email) {
            console.log('❌ OTP not sent: Resend API key or sender email not configured');
            return;
        }
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.resend_api_key}` },
            body: JSON.stringify({
                from: `MikuHost <${settings.sender_email}>`, to: email,
                subject: 'Verify your email - Chat-Ai By MikuHost',
                html: `<div style="background:#07070a;padding:30px;font-family:Arial"><div style="max-width:420px;margin:auto;background:#111827;border-radius:20px;overflow:hidden;border:1px solid #7c3aed55"><img src="https://cdn.aceimg.com/27a9dbe8f.jpg" style="width:100%;height:180px;object-fit:cover"><div style="padding:30px;text-align:center"><h1 style="color:#a855f7">Chat-Ai Verification</h1><p style="color:#d1d5db">Your OTP code:</p><div style="background:#0f172a;border-radius:14px;padding:18px;font-size:36px;letter-spacing:6px;color:#c084fc;font-weight:bold;margin:20px 0">${otp}</div><p style="color:#9ca3af;font-size:13px">Expires in 10 minutes</p></div></div></div>`
            })
        });
        console.log('✅ OTP sent to:', email);
    } catch(e) { console.error('❌ Send OTP error:', e.message); }
}

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, gender, email } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
        if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).single();
        if (existingUser) return res.status(400).json({ error: 'Username already taken' });
        if (email) { const { data: existingEmail } = await supabase.from('users').select('id').eq('email', email).single(); if (existingEmail) return res.status(400).json({ error: 'Email already registered' }); }

        const passwordHash = await passwordUtils.hash(password);
        const userEmail = email || username;
        const { data: newUser, error } = await supabase.from('users').insert({
            username, email: userEmail, password_hash: passwordHash,
            role: 'user', gender: gender || 'unknown', verified: false,
            daily_message_count: 0, last_message_date: new Date().toISOString().split('T')[0],
            is_banned: false, max_ai_characters: 5
        }).select().single();
        if (error) throw error;

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('email_verifications').insert({ user_id: newUser.id, email: userEmail, otp, expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
        sendOTPEmail(userEmail, otp).catch(e => console.log('OTP send failed:', e.message));
        await supabase.from('logs').insert({ user_id: newUser.id, action: 'user_registered', details: { username }, ip_address: req.ip });

        res.json({ message: 'Registration successful. Please check your email for OTP.', user: { id: newUser.id, username: newUser.username, role: newUser.role, gender: newUser.gender, verified: false }, requireOTP: true });
    } catch (error) { res.status(500).json({ error: 'Registration failed. Please try again.' }); }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body; if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
        const { data: verification } = await supabase.from('email_verifications').select('*').eq('email', email).eq('otp', otp).eq('is_used', false).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).single();
        if (!verification) return res.status(400).json({ error: 'Invalid or expired OTP' });
        await supabase.from('email_verifications').update({ is_used: true }).eq('id', verification.id);
        await supabase.from('users').update({ verified: true }).eq('id', verification.user_id);
        res.json({ success: true, message: 'Email verified! You can now login.' });
    } catch(e) { res.status(500).json({ error: 'Verification failed' }); }
});

app.post('/api/auth/resend-otp', async (req, res) => {
    try {
        const { email } = req.body; if (!email) return res.status(400).json({ error: 'Email required' });
        const { data: user } = await supabase.from('users').select('id, verified').or(`email.eq.${email},username.eq.${email}`).single();
        if (!user) return res.status(404).json({ error: 'User not found' }); if (user.verified) return res.status(400).json({ error: 'Already verified' });
        const userEmail = email.includes('@') ? email : email + '@unknown.com';
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('email_verifications').insert({ user_id: user.id, email: userEmail, otp, expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
        sendOTPEmail(userEmail, otp).catch(e => console.log('Resend OTP failed:', e.message));
        res.json({ success: true, message: 'OTP resent!' });
    } catch(e) { res.status(500).json({ error: 'Failed to resend OTP' }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

        const { data: user, error } = await supabase.from('users').select('*').or(`username.eq.${username},email.eq.${username}`).single();
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (user.is_banned) return res.status(403).json({ error: 'Account is banned' });
        if (user.verified === false) return res.status(403).json({ error: 'Email not verified. Please check your inbox.', requireOTP: true, email: user.email || user.username });

        const valid = await passwordUtils.verify(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        if (user.role === 'premium' && user.premium_expired_at && new Date(user.premium_expired_at) < new Date()) {
            await supabase.from('users').update({ role: 'user', premium_expired_at: null }).eq('id', user.id);
            user.role = 'user';
        }
        const today = new Date().toISOString().split('T')[0];
        if (user.last_message_date !== today) { await supabase.from('users').update({ daily_message_count: 0, last_message_date: today }).eq('id', user.id); user.daily_message_count = 0; }

        await supabase.from('logs').insert({ user_id: user.id, action: 'user_login', details: { username: user.username }, ip_address: req.ip });
        req.session.userId = user.id; req.session.userRole = user.role; req.session.username = user.username; req.session.userGender = user.gender;

        res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: user.role, gender: user.gender, daily_message_count: user.daily_message_count || 0 } });
    } catch (error) { res.status(500).json({ error: 'Login failed. Please try again.' }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy((err) => { if (err) return res.status(500).json({ error: 'Logout failed' }); res.json({ message: 'Logged out successfully' }); }); });

app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try { const { data: user, error } = await supabase.from('users').select('id, username, role, gender').eq('id', req.session.userId).single(); if (error) throw error; res.json({ user }); }
    catch (error) { res.status(500).json({ error: 'Failed to get user data' }); }
});

// ============================================
// SETTINGS
// ============================================
app.get('/api/settings', async (req, res) => { const { data } = await supabase.from('settings').select('qris_url, owner_whatsapp').eq('id', 1).single(); res.json({ settings: data }); });
app.get('/api/owner/settings', requireRole('owner'), async (req, res) => { const { data } = await supabase.from('settings').select('*').eq('id', 1).single(); res.json({ settings: data }); });
app.put('/api/owner/settings', requireRole('owner'), async (req, res) => { await supabase.from('settings').update(req.body).eq('id', 1); res.json({ success: true }); });

// ============================================
// CHANGE PASSWORD
// ============================================
app.put('/api/auth/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
        const { data: user } = await supabase.from('users').select('password_hash').eq('id', req.session.userId).single();
        if (!user) return res.status(404).json({ error: 'User not found' });
        const valid = await passwordUtils.verify(currentPassword, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Current password is wrong' });
        const newHash = await passwordUtils.hash(newPassword);
        await supabase.from('users').update({ password_hash: newHash }).eq('id', req.session.userId);
        await supabase.from('logs').insert({ user_id: req.session.userId, action: 'password_changed', details: { message: 'User changed their password' }, ip_address: req.ip });
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/owner/users/:userId/password', requireRole('owner'), async (req, res) => {
    try {
        const { newPassword } = req.body; if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
        const newHash = await passwordUtils.hash(newPassword);
        await supabase.from('users').update({ password_hash: newHash }).eq('id', req.params.userId);
        res.json({ success: true, message: 'Password changed for user' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// UPDATE USER GENDER
// ============================================
app.put('/api/auth/gender', requireAuth, async (req, res) => {
    const { gender } = req.body; if (!gender || !['male','female'].includes(gender)) return res.status(400).json({ error: 'Invalid gender' });
    await supabase.from('users').update({ gender }).eq('id', req.session.userId);
    req.session.userGender = gender;
    res.json({ success: true, gender });
});

// ============================================
// CHARACTER/AI ROUTES
// ============================================
app.get('/api/characters', requireAuth, async (req, res) => {
    try {
        let query = supabase.from('characters').select('*');
        if (req.session.userRole === 'owner') { query = query.in('status', ['online', 'active', 'maintenance']); }
        else { query = query.or(`created_by.eq.${req.session.userId},visibility.eq.public,and(visibility.in.(public,all)${req.session.userRole === 'premium' ? ',visibility.in.(premium-only)' : ''})`).in('status', ['online', 'active']); }
        const { data: characters, error } = await query.order('name');
        if (error) throw error;
        if (!characters || characters.length === 0) {
            const defaults = [
                { name: 'GPT-4 Assistant', avatar_url: '🤖', description: 'Asisten AI dengan GPT-4', system_prompt: 'Kamu adalah asisten AI profesional.', endpoint_url: '', model_name: 'gpt-4', status: 'online', visibility: 'all', gender: 'female' },
                { name: 'Creative Writer', avatar_url: '✍️', description: 'Spesialis konten kreatif', system_prompt: 'Kamu adalah AI penulis kreatif profesional.', endpoint_url: '', model_name: 'gpt-4', status: 'online', visibility: 'all', gender: 'female' }
            ];
            const { data: inserted } = await supabase.from('characters').insert(defaults).select();
            return res.json({ characters: inserted });
        }
        res.json({ characters });
    } catch (error) { res.status(500).json({ error: 'Failed to get characters' }); }
});

// ============================================
// USER AI CHARACTERS
// ============================================
app.get('/api/user/characters', requireAuth, async (req, res) => {
    try { const { data, error } = await supabase.from('characters').select('*, ai_packages(name, is_premium, model_name)').eq('created_by', req.session.userId).order('created_at', { ascending: false }); if (error) throw error; res.json({ characters: data || [] }); }
    catch (error) { res.status(500).json({ error: 'Failed to get your characters' }); }
});

app.post('/api/user/characters', requireAuth, async (req, res) => {
    try {
        const { name, avatar_url, description, system_prompt, package_id, gender, visibility } = req.body;
        if (!name || !system_prompt) return res.status(400).json({ error: 'Name and system prompt are required' });
        const { data: user } = await supabase.from('users').select('role, max_ai_characters').eq('id', req.session.userId).single();
        const { count } = await supabase.from('characters').select('*', { count: 'exact', head: true }).eq('created_by', req.session.userId);
        const maxLimit = user.max_ai_characters || 5;
        if (count >= maxLimit) return res.status(400).json({ error: `Max ${maxLimit} AI characters reached. Upgrade to premium for 15!` });
        let modelName = 'gpt-4', endpointUrl = '';
        if (package_id) { const { data: pkg } = await supabase.from('ai_packages').select('*').eq('id', package_id).single(); if (!pkg) return res.status(400).json({ error: 'Package not found' }); if (pkg.is_premium && req.session.userRole === 'user') return res.status(403).json({ error: 'This package is for premium users only.' }); modelName = pkg.model_name || 'gpt-4'; endpointUrl = pkg.url || ''; }
        const { data, error } = await supabase.from('characters').insert({ name, avatar_url: avatar_url || '🤖', description: description || '', system_prompt, package_id: package_id || null, model_name: modelName, endpoint_url: endpointUrl, gender: gender || 'female', status: 'online', visibility: visibility || 'private', created_by: req.session.userId }).select().single();
        if (error) throw error;
        await supabase.from('logs').insert({ user_id: req.session.userId, action: 'user_created_character', details: { character_name: name, package_id }, ip_address: req.ip });
        res.json({ character: data });
    } catch (error) { res.status(500).json({ error: error.message || 'Failed to create character' }); }
});

app.put('/api/user/characters/:id', requireAuth, async (req, res) => {
    try {
        const { data: existing } = await supabase.from('characters').select('created_by').eq('id', req.params.id).single();
        if (!existing) return res.status(404).json({ error: 'Character not found' });
        if (existing.created_by !== req.session.userId && req.session.userRole !== 'owner') return res.status(403).json({ error: 'Not your character' });
        const { name, avatar_url, description, system_prompt, package_id, model_name, gender, visibility } = req.body;
        if (package_id && req.session.userRole === 'user') { const { data: pkg } = await supabase.from('ai_packages').select('is_premium').eq('id', package_id).single(); if (pkg?.is_premium) return res.status(403).json({ error: 'Package premium hanya untuk user Premium.' }); }
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (avatar_url !== undefined) updates.avatar_url = avatar_url;
        if (description !== undefined) updates.description = description;
        if (system_prompt !== undefined) updates.system_prompt = system_prompt;
        if (package_id !== undefined) updates.package_id = package_id;
        if (model_name !== undefined) updates.model_name = model_name;
        if (gender !== undefined) updates.gender = gender;
        if (visibility !== undefined) updates.visibility = visibility;
        await supabase.from('characters').update(updates).eq('id', req.params.id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/user/characters/:id', requireAuth, async (req, res) => {
    try {
        const { data: existing } = await supabase.from('characters').select('created_by').eq('id', req.params.id).single();
        if (!existing) return res.status(404).json({ error: 'Character not found' });
        if (existing.created_by !== req.session.userId && req.session.userRole !== 'owner') return res.status(403).json({ error: 'Not your character' });
        const { data: chats } = await supabase.from('chats').select('id').eq('character_id', req.params.id);
        if (chats) { for (const chat of chats) { await supabase.from('messages').delete().eq('chat_id', chat.id); } await supabase.from('chats').delete().eq('character_id', req.params.id); }
        await supabase.from('characters').delete().eq('id', req.params.id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/user/packages', requireAuth, async (req, res) => {
    try { let query = supabase.from('ai_packages').select('*').order('name'); if (req.session.userRole === 'user') query = query.eq('is_premium', false); const { data } = await query; res.json({ packages: data || [] }); }
    catch (error) { res.status(500).json({ error: 'Failed to get packages' }); }
});

// ============================================
// CHAT ROUTES
// ============================================
app.get('/api/chats', requireAuth, async (req, res) => {
    try { const { data: chats } = await supabase.from('chats').select('*, characters (name, avatar_url, status)').eq('user_id', req.session.userId).order('updated_at', { ascending: false }); const chatsWithLast = await Promise.all((chats||[]).map(async (chat) => { const { data: msgs } = await supabase.from('messages').select('content, created_at').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(1); return { ...chat, last_message: msgs?.[0] || null }; })); res.json({ chats: chatsWithLast }); }
    catch (error) { res.status(500).json({ error: 'Failed to get chats' }); }
});
app.post('/api/chats', requireAuth, async (req, res) => { try { const { character_id } = req.body; const { data: chat } = await supabase.from('chats').insert({ user_id: req.session.userId, character_id, title: 'New Chat', mood: 'neutral', relationship_level: 0 }).select().single(); res.json({ chat }); } catch (error) { res.status(500).json({ error: 'Failed to create chat' }); } });
app.get('/api/chats/:chatId/messages', requireAuth, async (req, res) => { try { const { data: messages } = await supabase.from('messages').select('*').eq('chat_id', req.params.chatId).order('created_at', { ascending: true }); res.json({ messages }); } catch (error) { res.status(500).json({ error: 'Failed to get messages' }); } });
app.delete('/api/chats/:chatId', requireAuth, async (req, res) => { try { await supabase.from('messages').delete().eq('chat_id', req.params.chatId); await supabase.from('chats').delete().eq('id', req.params.chatId).eq('user_id', req.session.userId); res.json({ message: 'Chat deleted' }); } catch (error) { res.status(500).json({ error: 'Failed to delete chat' }); } });
app.delete('/api/chats/:id/history', requireAuth, async (req, res) => { await supabase.from('messages').delete().eq('chat_id', req.params.id); await supabase.from('chats').update({ relationship_level: 0, updated_at: new Date() }).eq('id', req.params.id).eq('user_id', req.session.userId); res.json({ success: true, message: 'History cleared' }); });

// ============================================
// SEND MESSAGE
// ============================================
app.post('/api/chats/:chatId/messages', requireAuth, async (req, res) => {
    try {
        const { content } = req.body; const chatId = req.params.chatId; if (!content || content.trim() === '') return res.status(400).json({ error: 'Message content is required' });
        const today = new Date().toISOString().split('T')[0]; const { data: user } = await supabase.from('users').select('*').eq('id', req.session.userId).single();
        const limit = getLimit(user.role); let currentCount = user.daily_message_count;
        if (user.last_message_date !== today) { await supabase.from('users').update({ daily_message_count: 0, last_message_date: today }).eq('id', req.session.userId); currentCount = 0; }
        if (currentCount >= limit) return res.status(429).json({ error: 'Daily limit reached', limit, current: currentCount });
        const { data: chat } = await supabase.from('chats').select('*, characters(*)').eq('id', chatId).eq('user_id', req.session.userId).single();
        if (!chat) return res.status(404).json({ error: 'Chat not found' });
        const { data: userMessage } = await supabase.from('messages').insert({ chat_id: chatId, user_id: req.session.userId, role: 'user', content }).select().single();
        await supabase.from('users').update({ daily_message_count: currentCount + 1, last_message_date: today }).eq('id', req.session.userId);
        const { data: history } = await supabase.from('messages').select('role, content').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(11);
        const ctx = (history || []).reverse().slice(0, -1);
        const charGender = chat.characters.gender || 'female'; const userGender = user.gender || req.session.userGender || 'male';
        const moodPrompt = buildMoodPrompt(chat.mood || 'neutral', chat.relationship_level || 0, chat.characters.name, req.session.username, charGender, userGender, user.role);
        const systemPrompt = `${chat.characters.system_prompt || 'You are a helpful assistant.'}\n\n${moodPrompt}\n\nCharacter name: ${chat.characters.name}\nUser's name: ${req.session.username}`;
        const { response: aiText, source } = await callAI(supabase, systemPrompt, ctx, content, chat.characters.endpoint_url, chat.characters.package_id, chat.characters.model_name);
        const aiResponse = aiText;
        const { data: aiMsg } = await supabase.from('messages').insert({ chat_id: chatId, user_id: req.session.userId, role: 'assistant', content: aiResponse }).select().single();
        const newRel = Math.min(100, (chat.relationship_level || 0) + 1);
        await supabase.from('chats').update({ relationship_level: newRel, updated_at: new Date() }).eq('id', chatId);
        const { count: mc } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('chat_id', chatId);
        if (mc <= 2) { const title = content.substring(0, 50) + (content.length > 50 ? '...' : ''); await supabase.from('chats').update({ title }).eq('id', chatId); }
        res.json({ userMessage: { role: 'user', content }, aiMessage: aiMsg, aiSource: source, relationshipLevel: newRel, remaining: Math.max(0, limit - (currentCount + 1)) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/chats/:chatId/mood', requireAuth, async (req, res) => {
    try { const { mood } = req.body; const validMoods = ['happy', 'neutral', 'annoyed', 'clingy', 'sleepy', 'caring', 'adult']; if (!validMoods.includes(mood)) return res.status(400).json({ error: 'Invalid mood' }); if (mood === 'adult' && req.session.userRole !== 'premium' && req.session.userRole !== 'owner') return res.status(403).json({ error: 'Adult mode requires Premium/Owner' }); await supabase.from('chats').update({ mood }).eq('id', req.params.chatId).eq('user_id', req.session.userId); res.json({ success: true, mood }); }
    catch (error) { res.status(500).json({ error: 'Failed to update mood' }); }
});

app.get('/api/user/stats', requireAuth, async (req, res) => {
    try { const today = new Date().toISOString().split('T')[0]; const { data: user } = await supabase.from('users').select('daily_message_count, last_message_date, role').eq('id', req.session.userId).single(); const limit = getLimit(user.role); const used = user.last_message_date === today ? user.daily_message_count : 0; res.json({ role: user.role, dailyLimit: limit, used, remaining: Math.max(0, limit - used) }); }
    catch (error) { res.status(500).json({ error: 'Failed to get stats' }); }
});

// ============================================
// OWNER ROUTES
// ============================================
app.get('/api/owner/stats', requireRole('owner'), async (req, res) => {
    const [u,c,m,ch] = await Promise.all([supabase.from('users').select('*',{count:'exact',head:true}),supabase.from('chats').select('*',{count:'exact',head:true}),supabase.from('messages').select('*',{count:'exact',head:true}),supabase.from('characters').select('*',{count:'exact',head:true})]);
    res.json({ users:u.count||0, chats:c.count||0, messages:m.count||0, characters:ch.count||0 });
});
app.get('/api/owner/users', requireRole('owner'), async (req, res) => { const { data } = await supabase.from('users').select('*').order('created_at',{ascending:false}); res.json({ users:(data||[]).map(({password_hash,...u})=>u) }); });
app.put('/api/owner/users/:userId', requireRole('owner'), async (req, res) => { const updates = {}; ['role','premium_expired_at','is_banned','daily_message_count','last_message_date','gender','verified','max_ai_characters'].forEach(k=>{ if(req.body[k]!==undefined) updates[k]=req.body[k]; }); await supabase.from('users').update(updates).eq('id',req.params.userId); res.json({ success:true }); });
app.delete('/api/owner/users/:userId', requireRole('owner'), async (req, res) => {
    try { if (req.params.userId === req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' }); await supabase.from('email_verifications').delete().eq('user_id', req.params.userId); await supabase.from('messages').delete().eq('user_id', req.params.userId); await supabase.from('chats').delete().eq('user_id', req.params.userId); await supabase.from('characters').delete().eq('created_by', req.params.userId); await supabase.from('logs').delete().eq('user_id', req.params.userId); const { error } = await supabase.from('users').delete().eq('id', req.params.userId); if (error) throw error; res.json({ success: true, message: 'User deleted' }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/owner/characters', requireRole('owner'), async (req, res) => {
    const { data: characters } = await supabase.from('characters').select('*, ai_packages(name, is_premium)').order('created_at', { ascending: false });
    if (characters) { const userIds = [...new Set(characters.filter(c => c.created_by).map(c => c.created_by))]; if (userIds.length > 0) { const { data: users } = await supabase.from('users').select('id, username').in('id', userIds); const userMap = {}; if (users) users.forEach(u => { userMap[u.id] = u.username; }); characters.forEach(c => { c.creator_username = c.created_by ? (userMap[c.created_by] || null) : null; }); } }
    res.json({ characters: characters || [] });
});
app.post('/api/owner/characters', requireRole('owner'), async (req, res) => { const { data } = await supabase.from('characters').insert({...req.body,created_by:req.session.userId}).select().single(); res.json({ character:data }); });
app.put('/api/owner/characters/:charId', requireRole('owner'), async (req, res) => { await supabase.from('characters').update(req.body).eq('id',req.params.charId); res.json({ success:true }); });
app.delete('/api/owner/characters/:charId', requireRole('owner'), async (req, res) => { const { data: chats } = await supabase.from('chats').select('id').eq('character_id', req.params.charId); if (chats) { for (const chat of chats) { await supabase.from('messages').delete().eq('chat_id', chat.id); } } await supabase.from('chats').delete().eq('character_id', req.params.charId); await supabase.from('characters').delete().eq('id', req.params.charId); res.json({ success:true }); });
app.get('/api/owner/packages', requireRole('owner'), async (req, res) => { const { data } = await supabase.from('ai_packages').select('*').order('name'); res.json({ packages: data || [] }); });
app.post('/api/owner/packages', requireRole('owner'), async (req, res) => { const { data } = await supabase.from('ai_packages').insert(req.body).select().single(); res.json({ package: data }); });
app.put('/api/owner/packages/:id', requireRole('owner'), async (req, res) => { await supabase.from('ai_packages').update(req.body).eq('id', req.params.id); res.json({ success: true }); });
app.delete('/api/owner/packages/:id', requireRole('owner'), async (req, res) => { await supabase.from('ai_packages').delete().eq('id', req.params.id); res.json({ success: true }); });
app.get('/api/owner/logs', requireRole('owner'), async (req, res) => { const { data } = await supabase.from('logs').select('*').order('created_at',{ascending:false}).limit(100); res.json({ logs:data }); });

// ============================================
// SERVER START
// ============================================
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log('============================================');
        console.log('✨ c.ai By MikuHost - Server Ready');
        console.log(`📱 http://localhost:${PORT}`);
        console.log(`📧 Email OTP Verification: ON`);
        console.log(`🔑 Login: username OR email`);
        console.log(`🔒 Public settings: filtered`);
        console.log(`👤 User-Generated AI: ON`);
        console.log(`📦 Package System: ON`);
        console.log(`🎵 Music Player: ON`);
        console.log(`🤖 ChatEverywhere + Gemini + Neosantara + Ryuu + Custom`);
        console.log('============================================');
    });
}

module.exports = app;