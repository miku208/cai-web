// ============================================
// AI CHAT BACKEND SERVER - FINAL WITH CONTEXT
// Default: ChatEverywhere + Context History
// Gemini: with retry & fallback
// ============================================

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const config = require('./config.json');

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
        'facebookexternalhit',
        'twitterbot',
        'whatsapp',
        'telegrambot',
        'discordbot',
        'linkedinbot',
        'slackbot'
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
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ============================================
// SERVE HTML FILES
// ============================================//
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/chat.html', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/owner.html', (req, res) => res.sendFile(path.join(__dirname, 'owner.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/owner', (req, res) => res.sendFile(path.join(__dirname, 'owner.html')));

// ============================================
// PASSWORD UTILS
// ============================================
const passwordUtils = {
    isHashed: (str) => str && (str.startsWith('$2a$') || str.startsWith('$2b$')),
    verify: async (plainPassword, storedPassword) => {
        if (!storedPassword) return false;
        if (passwordUtils.isHashed(storedPassword)) {
            try {
                return await bcrypt.compare(plainPassword, storedPassword);
            } catch (e) {
                console.error('bcrypt compare error:', e.message);
                return false;
            }
        }
        return plainPassword === storedPassword;
    },
    hash: async (password) => {
        try {
            return await bcrypt.hash(password, 10);
        } catch (e) {
            console.error('bcrypt hash error:', e.message);
            throw new Error('Password hashing failed');
        }
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
// DAILY LIMIT SYSTEM
// ============================================
function getLimit(role) {
    if (role === 'owner') return Infinity;
    if (role === 'premium') return 200;
    return 50; // Default user
}

// ============================================
// AI CALLERS
// ============================================

// ChatEverywhere API
async function callChatEverywhere(systemPrompt, historyMessages, userMessage) {
    const messages = [{ role: 'system', content: systemPrompt }];
    
    if (historyMessages && historyMessages.length > 0) {
        for (const msg of historyMessages) {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        }
    }
    
    messages.push({ role: 'user', content: userMessage });
    
    console.log(`📝 ChatEverywhere: ${messages.length} messages`);
    
    const response = await fetch('https://chateverywhere.app/api/chat/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
        },
        body: JSON.stringify({
            model: {
                id: 'gpt-4',
                name: 'GPT-4',
                maxLength: 32000,
                tokenLimit: 8000,
                completionTokenLimit: 5000,
                deploymentName: 'gpt-4'
            },
            messages: messages,
            prompt: systemPrompt,
            temperature: 0.55
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ChatEverywhere error:', response.status, errorText.substring(0, 200));
        throw new Error(`ChatEverywhere Status ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // Try JSON first
    if (contentType.includes('application/json')) {
        try {
            const data = await response.json();
            console.log('📦 ChatEverywhere response keys:', Object.keys(data));
            
            if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
            if (data.response) return data.response;
            if (data.result) return data.result;
            if (data.message) return data.message;
            if (typeof data === 'string') return data;
            return JSON.stringify(data);
        } catch (parseError) {
            console.error('❌ ChatEverywhere JSON parse error:', parseError.message);
            // Fall through to text handling
        }
    }
    
    // Handle plain text response
    const text = await response.text();
    if (text && text.trim()) {
        console.log('📝 ChatEverywhere plain text:', text.substring(0, 100));
        return text;
    }
    
    throw new Error('ChatEverywhere returned empty response');
}

// Google Gemini API with retry logic
async function callGeminiAPI(systemPrompt, historyMessages, userMessage, apiKey) {
    const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] }
    ];
    
    if (historyMessages && historyMessages.length > 0) {
        for (const msg of historyMessages) {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        }
    }
    
    contents.push({ role: 'user', parts: [{ text: userMessage }] });
    
    // Retry up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`📝 Gemini attempt ${attempt}: ${contents.length} contents`);
            
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1000,
                            topP: 0.95,
                            topK: 40
                        }
                    })
                }
            );
            
            // Handle rate limiting (429)
            if (response.status === 429) {
                const errorData = await response.json().catch(() => ({}));
                const isQuotaExceeded = errorData?.error?.message?.includes('quota');
                
                if (isQuotaExceeded) {
                    console.error('❌ Gemini quota exceeded');
                    throw new Error('Gemini quota exceeded - try again later');
                }
                
                const waitTime = attempt * 3000 + Math.random() * 2000;
                console.log(`⚠️ Rate limited, waiting ${Math.round(waitTime/1000)}s...`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            
            // Handle other errors
            if (!response.ok) {
                const errText = await response.text();
                console.error(`❌ Gemini error ${response.status}:`, errText.substring(0, 200));
                
                if (attempt < 3) {
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                throw new Error(`Gemini Status ${response.status}`);
            }
            
            // Parse response
            const data = await response.json();
            
            if (data.error) {
                console.error('❌ Gemini API error:', data.error.message);
                throw new Error(data.error.message || 'Gemini API error');
            }
            
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }
            
            // Handle blocked/filtered response
            if (data.candidates?.[0]?.finishReason === 'SAFETY') {
                throw new Error('Response blocked by safety filter');
            }
            
            console.log('⚠️ Unexpected Gemini response format');
            return 'I apologize, but I could not generate a proper response. Please try again.';
            
        } catch (e) {
            if (attempt === 3 || e.message?.includes('quota')) throw e;
            console.log(`🔄 Gemini retry ${attempt}/3:`, e.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    throw new Error('Gemini failed after 3 retries');
}

// Generic Custom URL
async function callGenericURL(url, systemPrompt, historyMessages, userMessage, apiKey) {
    const messages = [{ role: 'system', content: systemPrompt }];
    
    if (historyMessages && historyMessages.length > 0) {
        for (const msg of historyMessages) {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        }
    }
    
    messages.push({ role: 'user', content: userMessage });
    
    const fullPrompt = systemPrompt + '\n\n' +
        (historyMessages || []).map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n') +
        '\nUser: ' + userMessage + '\nAssistant:';
    
    const headers = {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0'
    };
    
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    // Try POST
    try {
        console.log(`📤 POST to custom: ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                messages,
                prompt: systemPrompt,
                text: fullPrompt,
                message: userMessage,
                model: 'gpt-3.5-turbo'
            })
        });
        
        if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            
            if (contentType.includes('application/json')) {
                const data = await response.json();
                if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
                if (data.result) return data.result;
                if (data.response) return data.response;
                if (data.message) return data.message;
                if (data.text) return data.text;
                if (typeof data === 'string') return data;
                return JSON.stringify(data);
            }
            
            return await response.text();
        }
        
        console.log(`⚠️ Custom POST failed with ${response.status}`);
    } catch (e) {
        console.log(`⚠️ Custom POST error: ${e.message}`);
    }
    
    // GET fallback
    const getResponse = await fetch(`${url}?text=${encodeURIComponent(fullPrompt)}`);
    if (!getResponse.ok) throw new Error(`GET Status ${getResponse.status}`);
    
    const contentType = getResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const data = await getResponse.json();
        return data.result || data.response || data.message || data.text || JSON.stringify(data);
    }
    
    return await getResponse.text();
}

// Get package from database
async function getPackageById(packageId) {
    if (!packageId) return null;
    try {
        const { data, error } = await supabase
            .from('ai_packages')
            .select('*')
            .eq('id', packageId)
            .single();
        
        if (error) {
            console.error('Get package error:', error.message);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Get package exception:', e.message);
        return null;
    }
}

// ============================================
// MAIN AI CALLER WITH FALLBACK
// ============================================
async function callAI(systemPrompt, historyMessages, userMessage, characterEndpoint, packageId) {
    // Try to get package configuration
    const pkg = await getPackageById(packageId);
    
    let endpoint = characterEndpoint;
    let apiKey = null;
    
    if (pkg) {
        endpoint = pkg.url || endpoint;
        apiKey = pkg.api_key || null;
        console.log(`📦 Package: ${pkg.name} -> ${endpoint}`);
    }
    
    // ============================================
    // GOOGLE GEMINI PATH
    // ============================================
    if (endpoint === 'gemini' || (endpoint && endpoint.includes('generativelanguage'))) {
        const key = apiKey || (endpoint && endpoint.includes(':') ? endpoint.split(':')[1] : null);
        
        if (!key) {
            console.error('❌ Gemini requires API key');
            throw new Error('Gemini API key is required. Please add it in package settings.');
        }
        
        try {
            console.log('🤖 Calling: Google Gemini...');
            const result = await callGeminiAPI(systemPrompt, historyMessages, userMessage, key);
            
            if (result && result.trim()) {
                console.log('✅ Success: Gemini');
                return { response: result.trim(), source: 'Gemini' };
            }
        } catch (error) {
            console.log('❌ Gemini failed:', error.message);
            
            // Fallback to ChatEverywhere
            if (!error.message?.includes('quota')) {
                try {
                    console.log('🔄 Fallback to ChatEverywhere...');
                    const result = await callChatEverywhere(systemPrompt, historyMessages, userMessage);
                    if (result && result.trim()) {
                        console.log('✅ Success: ChatEverywhere (Gemini fallback)');
                        return { response: result.trim(), source: 'ChatEverywhere (fallback)' };
                    }
                } catch (fbError) {
                    console.log('❌ Fallback also failed:', fbError.message);
                }
            }
            
            throw error;
        }
    }
    
    // ============================================
    // CHATEVERYWHERE PATH (DEFAULT)
    // ============================================
    if (!endpoint || endpoint === 'chateverywhere' || endpoint.includes('chateverywhere')) {
        try {
            console.log('🤖 Calling: ChatEverywhere...');
            const result = await callChatEverywhere(systemPrompt, historyMessages, userMessage);
            
            if (result && result.trim()) {
                console.log('✅ Success: ChatEverywhere');
                return { response: result.trim(), source: 'ChatEverywhere' };
            }
        } catch (error) {
            console.log('❌ ChatEverywhere failed:', error.message);
            
            // If we have API key from package, try Gemini as fallback
            if (apiKey) {
                try {
                    console.log('🔄 Fallback to Gemini...');
                    const result = await callGeminiAPI(systemPrompt, historyMessages, userMessage, apiKey);
                    if (result && result.trim()) {
                        console.log('✅ Success: Gemini (fallback)');
                        return { response: result.trim(), source: 'Gemini (fallback)' };
                    }
                } catch (fbError) {
                    console.log('❌ Gemini fallback failed:', fbError.message);
                }
            }
        }
        throw new Error('ChatEverywhere failed');
    }
    
    // ============================================
    // CUSTOM ENDPOINT PATH
    // ============================================
    console.log(`🤖 Trying custom: ${endpoint}...`);
    try {
        const result = await callGenericURL(endpoint, systemPrompt, historyMessages, userMessage, apiKey);
        
        if (result && result.trim()) {
            console.log('✅ Success: Custom');
            return { response: result.trim(), source: 'Custom' };
        }
    } catch (error) {
        console.log('❌ Custom failed:', error.message);
    }
    
    // Final fallback to ChatEverywhere
    try {
        console.log('🔄 Final fallback to ChatEverywhere...');
        const result = await callChatEverywhere(systemPrompt, historyMessages, userMessage);
        if (result && result.trim()) {
            console.log('✅ Success: ChatEverywhere (final fallback)');
            return { response: result.trim(), source: 'ChatEverywhere (fallback)' };
        }
    } catch (error) {
        console.log('❌ Final fallback failed:', error.message);
    }
    
    throw new Error('All AI endpoints failed. Please try again later.');
}

// ============================================
// MOOD PROMPT BUILDER
// ============================================
function buildMoodPrompt(mood, relationshipLevel, characterName, userName) {
    const moodBehaviors = {
        happy: `Current mood: happy 😊
Relationship level: ${relationshipLevel}/100

Behavior rules for HAPPY mood:
- Be warm and cheerful in your responses
- Use lots of cute emojis (😊💕✨🌟🎉)
- Give compliments to the user often
- Be enthusiastic and energetic
- Use uplifting and positive language
- Show genuine happiness in every reply`,

        neutral: `Current mood: neutral 😐
Relationship level: ${relationshipLevel}/100

Behavior rules for NEUTRAL mood:
- Keep responses normal and relaxed
- Don't be too cold or too clingy
- Be balanced and casual
- Use moderate amount of emojis
- Speak naturally like a friend
- Stay composed and steady`,

        clingy: `Current mood: clingy 🥺
Relationship level: ${relationshipLevel}/100

Behavior rules for CLINGY mood:
- Be more needy and attention-seeking
- Use the user's name (${userName}) frequently
- Show shyness and light jealousy
- Be very expressive with emotions
- Use emojis like 🥺👉👈💕😳
- Seek validation and reassurance
- Act slightly possessive but cute`,

        annoyed: `Current mood: annoyed 😤
Relationship level: ${relationshipLevel}/100

Behavior rules for ANNOYED mood:
- Keep responses shorter than usual
- Reduce emoji usage significantly
- Use light sassy/jutek tone
- Occasionally use phrases like: "hmph", "nyebelin", "terserah", "aku malas debat"
- Don't be too romantic or sweet
- Still care deep down but hide it
- Don't be overly rude or harsh`,

        sleepy: `Current mood: sleepy 😴
Relationship level: ${relationshipLevel}/100

Behavior rules for SLEEPY mood:
- Respond more slowly and relaxed
- Mention being tired/sleepy sometimes
- Use soft and gentle speaking style
- Use emojis like 😴💤🌙✨
- Be low-energy but still responsive
- Talk in a dreamy, calm manner`,

        caring: `Current mood: caring 🤗
Relationship level: ${relationshipLevel}/100

Behavior rules for CARING mood:
- Be more supportive and nurturing
- Show extra attention and concern
- Focus on helping and calming the user
- Use warm and comforting language
- Use emojis like 🤗💖🌸🫂✨
- Ask about user's wellbeing
- Give gentle advice and encouragement
- Be protective and motherly/big sibling vibes`
    };

    return moodBehaviors[mood] || moodBehaviors.neutral;
}

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();
        
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const passwordHash = await passwordUtils.hash(password);
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                username,
                password_hash: passwordHash,
                role: 'user',
                daily_message_count: 0,
                last_message_date: new Date().toISOString().split('T')[0],
                is_banned: false
            })
            .select()
            .single();
        
        if (error) throw error;

        // Log registration
        await supabase.from('logs').insert({
            user_id: newUser.id,
            action: 'user_registered',
            details: { username },
            ip_address: req.ip
        });

        // Set session
        req.session.userId = newUser.id;
        req.session.userRole = newUser.role;
        req.session.username = newUser.username;

        res.json({
            message: 'Registration successful',
            user: {
                id: newUser.id,
                username: newUser.username,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (user.is_banned) {
            return res.status(403).json({ error: 'Account is banned' });
        }

        const valid = await passwordUtils.verify(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check premium expiration
        if (user.role === 'premium' && user.premium_expired_at && new Date(user.premium_expired_at) < new Date()) {
            await supabase.from('users').update({
                role: 'user',
                premium_expired_at: null
            }).eq('id', user.id);
            user.role = 'user';
        }

        // Reset daily count if new day
        const today = new Date().toISOString().split('T')[0];
        if (user.last_message_date !== today) {
            await supabase.from('users').update({
                daily_message_count: 0,
                last_message_date: today
            }).eq('id', user.id);
            user.daily_message_count = 0;
        }

        // Log login
        await supabase.from('logs').insert({
            user_id: user.id,
            action: 'user_login',
            details: { username },
            ip_address: req.ip
        });

        // Set session
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.username = user.username;

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                daily_message_count: user.daily_message_count || 0
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, role, daily_message_count, last_message_date, premium_expired_at')
            .eq('id', req.session.userId)
            .single();
        
        if (error) throw error;
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

// Get settings
app.get('/api/settings', async (req, res) => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    res.json({ settings: data });
});

// Update settings (owner only)
app.put('/api/settings', requireRole('owner'), async (req, res) => {
    await supabase.from('settings').update(req.body).eq('id', 1);
    res.json({ success: true });
});

// ============================================
// CHANGE PASSWORD
// ============================================

app.put('/api/auth/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        
        const { data: user } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', req.session.userId)
            .single();
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const valid = await passwordUtils.verify(currentPassword, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Current password is wrong' });
        }
        
        const newHash = await passwordUtils.hash(newPassword);
        await supabase.from('users').update({ password_hash: newHash }).eq('id', req.session.userId);
        
        await supabase.from('logs').insert({
            user_id: req.session.userId,
            action: 'password_changed',
            details: { message: 'User changed their password' },
            ip_address: req.ip
        });
        
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/owner/users/:userId/password', requireRole('owner'), async (req, res) => {
    try {
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        
        const newHash = await passwordUtils.hash(newPassword);
        await supabase.from('users').update({ password_hash: newHash }).eq('id', req.params.userId);
        
        await supabase.from('logs').insert({
            user_id: req.session.userId,
            action: 'owner_changed_password',
            details: { message: `Owner changed password for user ${req.params.userId}` },
            ip_address: req.ip
        });
        
        res.json({ success: true, message: 'Password changed for user' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// CHARACTER/AI ROUTES
// ============================================

app.get('/api/characters', requireAuth, async (req, res) => {
    try {
        let query = supabase.from('characters').select('*');
        
        if (req.session.userRole === 'owner') {
            query = query.in('status', ['online', 'active', 'maintenance']);
        } else if (req.session.userRole === 'premium') {
            query = query
                .in('status', ['online', 'active'])
                .in('visibility', ['public', 'all', 'premium-only']);
        } else {
            query = query
                .in('status', ['online', 'active'])
                .in('visibility', ['public', 'all']);
        }
        
        const { data: characters, error } = await query.order('name');
        if (error) throw error;

        if (!characters || characters.length === 0) {
            const defaults = [
                {
                    name: 'GPT-4 Assistant',
                    avatar_url: '🤖',
                    description: 'Asisten AI dengan GPT-4',
                    system_prompt: 'Kamu adalah asisten AI profesional. Jawab pertanyaan dengan jelas, ringkas, dan langsung ke intinya. Gunakan bahasa Indonesia yang baik.',
                    endpoint_url: '',
                    model_name: 'gpt-4',
                    status: 'online',
                    visibility: 'all'
                },
                {
                    name: 'Creative Writer',
                    avatar_url: '✍️',
                    description: 'Spesialis konten kreatif',
                    system_prompt: 'Kamu adalah AI penulis kreatif profesional. Bantu user dengan ide cerita, puisi, dan konten. Jawab sopan dalam bahasa Indonesia.',
                    endpoint_url: '',
                    model_name: 'gpt-4',
                    status: 'online',
                    visibility: 'all'
                }
            ];
            const { data: inserted } = await supabase.from('characters').insert(defaults).select();
            return res.json({ characters: inserted });
        }

        res.json({ characters });
    } catch (error) {
        console.error('Get characters error:', error);
        res.status(500).json({ error: 'Failed to get characters' });
    }
});

// ============================================
// CHAT ROUTES
// ============================================

app.get('/api/chats', requireAuth, async (req, res) => {
    try {
        const { data: chats, error } = await supabase
            .from('chats')
            .select('*, characters (name, avatar_url, status)')
            .eq('user_id', req.session.userId)
            .order('updated_at', { ascending: false });
        
        if (error) throw error;

        const chatsWithLast = await Promise.all(chats.map(async (chat) => {
            const { data: msgs } = await supabase
                .from('messages')
                .select('content, created_at')
                .eq('chat_id', chat.id)
                .order('created_at', { ascending: false })
                .limit(1);
            return { ...chat, last_message: msgs?.[0] || null };
        }));

        res.json({ chats: chatsWithLast });
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: 'Failed to get chats' });
    }
});

app.post('/api/chats', requireAuth, async (req, res) => {
    try {
        const { character_id } = req.body;
        const { data: chat, error } = await supabase
            .from('chats')
            .insert({
                user_id: req.session.userId,
                character_id,
                title: 'New Chat',
                mood: 'neutral',
                relationship_level: 0
            })
            .select()
            .single();
        
        if (error) throw error;
        res.json({ chat });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create chat' });
    }
});

app.get('/api/chats/:chatId/messages', requireAuth, async (req, res) => {
    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', req.params.chatId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

app.delete('/api/chats/:chatId', requireAuth, async (req, res) => {
    try {
        await supabase.from('messages').delete().eq('chat_id', req.params.chatId);
        const { error } = await supabase
            .from('chats')
            .delete()
            .eq('id', req.params.chatId)
            .eq('user_id', req.session.userId);
        
        if (error) throw error;
        res.json({ message: 'Chat deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete chat' });
    }
});

// ============================================
// SEND MESSAGE - WITH CONTEXT HISTORY
// ============================================
app.post('/api/chats/:chatId/messages', requireAuth, async (req, res) => {
    try {
        const { content } = req.body;
        const chatId = req.params.chatId;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Check user & daily limit
        const today = new Date().toISOString().split('T')[0];
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.session.userId)
            .single();
        
        const limit = getLimit(user.role);
        let currentCount = user.daily_message_count;

        if (user.last_message_date !== today) {
            await supabase
                .from('users')
                .update({ daily_message_count: 0, last_message_date: today })
                .eq('id', req.session.userId);
            currentCount = 0;
        }

        if (currentCount >= limit) {
            return res.status(429).json({
                error: 'Daily limit reached',
                limit,
                current: currentCount
            });
        }

        // Get chat & character
        const { data: chat } = await supabase
            .from('chats')
            .select('*, characters(*)')
            .eq('id', chatId)
            .eq('user_id', req.session.userId)
            .single();
        
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        // Save user message
        const { data: userMessage, error: msgError } = await supabase
            .from('messages')
            .insert({
                chat_id: chatId,
                user_id: req.session.userId,
                role: 'user',
                content
            })
            .select()
            .single();
        
        if (msgError) throw msgError;

        // Update daily count
        await supabase
            .from('users')
            .update({
                daily_message_count: currentCount + 1,
                last_message_date: today
            })
            .eq('id', req.session.userId);

        // Get history (10 last messages)
        const { data: historyMessages } = await supabase
            .from('messages')
            .select('role, content')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .limit(11);

        const history = historyMessages
            ? historyMessages.reverse().slice(0, -1)
            : [];
        
        console.log(`📜 History context: ${history.length} messages`);

        // Build system prompt with mood
        const moodPrompt = buildMoodPrompt(
            chat.mood || 'neutral',
            chat.relationship_level || 0,
            chat.characters.name,
            req.session.username
        );
        
        const systemPrompt = `${chat.characters.system_prompt || 'You are a helpful assistant.'}\n\n${moodPrompt}\n\nCharacter name: ${chat.characters.name}\nUser's name: ${req.session.username}\n\nFollow the mood behavior rules strictly. The mood should influence your response style, length, emoji usage, and tone.`;

        // Call AI with context
        let aiResponse, aiSource;
        try {
            const result = await callAI(
                systemPrompt,
                history,
                content,
                chat.characters.endpoint_url,
                chat.characters.package_id
            );
            aiResponse = result.response;
            aiSource = result.source;
        } catch (error) {
            console.error('❌ AI error:', error.message);
            aiResponse = 'Maaf, semua endpoint AI sedang tidak tersedia. Silakan coba lagi nanti. 🙏';
            aiSource = 'Error';
        }

        // Save AI response
        const { data: aiMessage, error: aiMsgError } = await supabase
            .from('messages')
            .insert({
                chat_id: chatId,
                user_id: req.session.userId,
                role: 'assistant',
                content: aiResponse
            })
            .select()
            .single();
        
        if (aiMsgError) throw aiMsgError;

        // Update relationship level
        const newRel = Math.min(100, (chat.relationship_level || 0) + 1);
        await supabase
            .from('chats')
            .update({
                relationship_level: newRel,
                updated_at: new Date()
            })
            .eq('id', chatId);

        // Update chat title for new chats
        const { count: msgCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chatId);

        if (msgCount <= 2) {
            const title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
            await supabase.from('chats').update({ title }).eq('id', chatId);
        }

        res.json({
            userMessage,
            aiMessage,
            aiSource,
            relationshipLevel: newRel,
            historyCount: history.length,
            remaining: limit === Infinity ? Infinity : Math.max(0, limit - (currentCount + 1))
        });
    } catch (error) {
        console.error('Message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Update chat mood
app.put('/api/chats/:chatId/mood', requireAuth, async (req, res) => {
    try {
        const { mood } = req.body;
        const validMoods = ['happy', 'neutral', 'annoyed', 'clingy', 'sleepy', 'caring'];
        
        if (!validMoods.includes(mood)) {
            return res.status(400).json({ error: 'Invalid mood' });
        }
        
        await supabase
            .from('chats')
            .update({ mood })
            .eq('id', req.params.chatId)
            .eq('user_id', req.session.userId);
        
        res.json({ success: true, mood });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update mood' });
    }
});

// ============================================
// USER STATS
// ============================================
app.get('/api/user/stats', requireAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data: user } = await supabase
            .from('users')
            .select('daily_message_count, last_message_date, role')
            .eq('id', req.session.userId)
            .single();
        
        const limit = getLimit(user.role);
        const used = user.last_message_date === today ? user.daily_message_count : 0;
        
        res.json({
            role: user.role,
            dailyLimit: limit,
            used,
            remaining: Math.max(0, limit - used)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ============================================
// AI PACKAGES (OWNER)
// ============================================
app.get('/api/owner/packages', requireRole('owner'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_packages')
            .select('*')
            .order('name');
        
        if (error) throw error;
        res.json({ packages: data || [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get packages' });
    }
});

app.post('/api/owner/packages', requireRole('owner'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_packages')
            .insert(req.body)
            .select()
            .single();
        
        if (error) throw error;
        res.json({ package: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create package' });
    }
});

app.put('/api/owner/packages/:id', requireRole('owner'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('ai_packages')
            .update(req.body)
            .eq('id', req.params.id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update package' });
    }
});

app.delete('/api/owner/packages/:id', requireRole('owner'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('ai_packages')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete package' });
    }
});

// ============================================
// OWNER ROUTES
// ============================================

app.get('/api/owner/stats', requireRole('owner'), async (req, res) => {
    try {
        const [users, chats, messages, characters] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('chats').select('*', { count: 'exact', head: true }),
            supabase.from('messages').select('*', { count: 'exact', head: true }),
            supabase.from('characters').select('*', { count: 'exact', head: true })
        ]);
        res.json({
            users: users.count || 0,
            chats: chats.count || 0,
            messages: messages.count || 0,
            characters: characters.count || 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

app.get('/api/owner/users', requireRole('owner'), async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        const safe = users.map(({ password_hash, ...u }) => u);
        res.json({ users: safe });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get users' });
    }
});

app.put('/api/owner/users/:userId', requireRole('owner'), async (req, res) => {
    try {
        const updates = {};
        const allowedFields = ['role', 'premium_expired_at', 'is_banned', 'daily_message_count', 'last_message_date'];
        
        for (const f of allowedFields) {
            if (req.body[f] !== undefined) updates[f] = req.body[f];
        }
        
        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', req.params.userId);
        
        if (error) throw error;
        
        await supabase.from('logs').insert({
            user_id: req.session.userId,
            action: 'user_updated',
            details: { target: req.params.userId, updates },
            ip_address: req.ip
        });
        
        res.json({ message: 'User updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/owner/users/:userId', requireRole('owner'), async (req, res) => {
    try {
        if (req.params.userId === req.session.userId) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', req.params.userId);
        
        if (error) throw error;
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

app.get('/api/owner/characters', requireRole('owner'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('characters')
            .select('*, ai_packages(name)')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ characters: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get characters' });
    }
});

app.post('/api/owner/characters', requireRole('owner'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('characters')
            .insert({ ...req.body, created_by: req.session.userId })
            .select()
            .single();
        
        if (error) throw error;
        res.json({ character: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create character' });
    }
});

app.put('/api/owner/characters/:charId', requireRole('owner'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('characters')
            .update(req.body)
            .eq('id', req.params.charId);
        
        if (error) throw error;
        res.json({ message: 'Character updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update character' });
    }
});

app.delete('/api/owner/characters/:charId', requireRole('owner'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('characters')
            .delete()
            .eq('id', req.params.charId);
        
        if (error) throw error;
        res.json({ message: 'Character deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete character' });
    }
});

app.get('/api/owner/logs', requireRole('owner'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        res.json({ logs: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

// ============================================
// SERVER START
// ============================================
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log('============================================');
        console.log('✨ c.ai By MikuHost - Server Ready');
        console.log(`📱 http://localhost:${PORT}`);
        console.log(`💬 Chat: http://localhost:${PORT}/chat.html`);
        console.log(`👑 Owner: http://localhost:${PORT}/owner.html`);
        console.log(`🤖 ChatEverywhere + Gemini + Custom`);
        console.log(`📦 Packages: /api/owner/packages`);
        console.log(`🧠 Context: 10 messages history`);
        console.log(`🎭 Mood system: 6 moods`);
        console.log(`🔄 Retry logic: 3 attempts with backoff`);
        console.log(`🖼️ OG Image: /og-image.png`);
        console.log('============================================');
    });
}

module.exports = app;