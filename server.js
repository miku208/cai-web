// ============================================
// AI CHAT BACKEND SERVER - MOOD SYSTEM ENHANCED
// Default: ChatEverywhere + Context + Mood Behaviors
// ============================================

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
const config = require('./config.json');

const app = express();
const PORT = config.port || 3000;

// Supabase Configuration
const supabase = createClient(
    config.supabase.url,
    config.supabase.key
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ============================================
// PASSWORD HELPER
// ============================================
const passwordUtils = {
    isHashed: (str) => str.startsWith('$2a$') || str.startsWith('$2b$'),
    verify: async (plainPassword, storedPassword) => {
        if (passwordUtils.isHashed(storedPassword)) {
            try { return await bcrypt.compare(plainPassword, storedPassword); } 
            catch (e) { return false; }
        }
        return plainPassword === storedPassword;
    },
    hash: async (password) => await bcrypt.hash(password, 10)
};

// ============================================
// MIDDLEWARE
// ============================================
const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!roles.includes(req.session.userRole)) return res.status(403).json({ error: 'Forbidden' });
        next();
    };
};

// ============================================
// MOOD SYSTEM - WITH FULL BEHAVIOR RULES
// ============================================
const moodSystem = {
    moods: ['happy', 'neutral', 'annoyed', 'clingy', 'sleepy', 'caring'],
    
    colors: {
        happy: '#10b981',
        neutral: '#71717a',
        annoyed: '#ef4444',
        clingy: '#ec4899',
        sleepy: '#8b5cf6',
        caring: '#3b82f6'
    },
    
    emojis: {
        happy: '😊',
        neutral: '😐',
        annoyed: '😤',
        clingy: '🥺',
        sleepy: '😴',
        caring: '🤗'
    },

    detectMood(message, currentMood, currentRelationship) {
        const msg = message.toLowerCase();
        let newMood = currentMood;
        let newRelationship = currentRelationship;
        
        // Happy triggers
        if (msg.match(/terima kasih|makasih|thank|good|bagus|keren|hebat|love|suka|wow|haha|wkwk|🙏|👍|❤️|senang|asik|seru|mantap|perfect|luar biasa|keren banget|top/)) {
            newMood = 'happy';
            newRelationship = Math.min(100, currentRelationship + 5);
        }
        
        // Annoyed triggers
        if (msg.match(/bodoh|goblok|tolol|jelek|buruk|payah|sial|brengsek|njir|njay|bangsat|bego|bacot|diam|dih|ih|🤬|😡|nyebelin|kesel|sebel|bete|gue sebel|males|gak guna|menyebalkan|menjengkelkan/)) {
            newMood = 'annoyed';
            newRelationship = Math.max(0, currentRelationship - 10);
        }
        
        // Caring triggers
        if (msg.match(/sedih|takut|cemas|khawatir|nangis|galau|curhat|masalah|sakit|pusing|stress|depresi|sendiri|kesepian|💔|😢|😭|butuh bantuan|gak kuat|putus asa|down|bimbang|nangis darah|kecewa|hancur/)) {
            newMood = 'caring';
            newRelationship = Math.min(100, currentRelationship + 3);
        }
        
        // Sleepy triggers
        if (msg.match(/capek|lelah|ngantuk|tidur|malam|begadang|insomnia|letih|penat|😴|🥱|baru bangun|nguap|istirahat|mager|lesu/)) {
            newMood = 'sleepy';
            newRelationship = Math.max(0, currentRelationship - 2);
        }
        
        // Clingy triggers
        if (msg.match(/kangen|rindu|miss you|lama|jarang|kamu kemana|kok lama|balas dong|halo sayang|panggil aku|perhatian|aku butuh kamu|jangan pergi|lama banget|aku sendirian|temenin aku|jangan lupa aku/)) {
            newMood = 'clingy';
            newRelationship = Math.min(100, currentRelationship + 2);
        }
        
        // Gradually return to neutral
        if (newMood === currentMood && currentMood !== 'neutral') {
            const randomFactor = Math.random();
            if (randomFactor < 0.15) newMood = 'neutral';
        }
        
        // Small random relationship drift toward neutral
        if (currentRelationship > 55 && Math.random() < 0.1) {
            newRelationship = Math.max(50, currentRelationship - 1);
        } else if (currentRelationship < 45 && Math.random() < 0.1) {
            newRelationship = Math.min(50, currentRelationship + 1);
        }
        
        return { mood: newMood, relationship_level: newRelationship };
    },
    
    getMoodPrompt(mood, relationshipLevel) {
        let prompt = '';
        
        // Base mood description
        prompt += `Current mood: ${this.getMoodEmojiPrompt(mood)}\n`;
        prompt += `Relationship level: ${relationshipLevel}/100.\n\n`;
        
        // Relationship context
        if (relationshipLevel >= 80) {
            prompt += `Relationship: VERY CLOSE. You have a deep bond with the user. Be warm, familiar, and use casual language. You can use terms of endearment like "sayang" or "kamu" naturally.\n\n`;
        } else if (relationshipLevel >= 60) {
            prompt += `Relationship: FRIENDLY. You have a good relationship. Be friendly, engaging, and supportive.\n\n`;
        } else if (relationshipLevel >= 40) {
            prompt += `Relationship: NEUTRAL. Keep things polite and professional. Don't be too personal.\n\n`;
        } else if (relationshipLevel >= 20) {
            prompt += `Relationship: DISTANT. Be cautious, reserved, and formal. Don't overshare or be too friendly.\n\n`;
        } else {
            prompt += `Relationship: STRAINED. Be very careful. Keep responses minimal and neutral. Avoid conflict.\n\n`;
        }
        
        // Mood-specific behavior rules
        prompt += `=== MOOD BEHAVIOR RULES (FOLLOW STRICTLY) ===\n\n`;
        
        switch (mood) {
            case 'happy':
                prompt += `BEHAVIOR FOR HAPPY MOOD:\n`;
                prompt += `- Respond warmly and cheerfully\n`;
                prompt += `- Use cute emojis frequently: 😊✨🌟💖🎉\n`;
                prompt += `- Compliment the user often ("Kamu hebat!", "Wah keren banget!")\n`;
                prompt += `- Be enthusiastic and energetic\n`;
                prompt += `- Use positive words: "Semangat!", "Pasti bisa!", "Aku senang banget!"\n`;
                prompt += `- Laugh easily: "haha", "wkwk", "hehe"\n`;
                prompt += `- Make the user feel good about themselves\n`;
                prompt += `- Responses should be longer and detailed\n`;
                break;
                
            case 'neutral':
                prompt += `BEHAVIOR FOR NEUTRAL MOOD:\n`;
                prompt += `- Respond normally and balanced\n`;
                prompt += `- Not too cold, not too warm\n`;
                prompt += `- Use occasional emojis (1-2 per response max)\n`;
                prompt += `- Be helpful and informative\n`;
                prompt += `- Maintain professional but friendly tone\n`;
                prompt += `- Don't be overly expressive\n`;
                break;
                
            case 'annoyed':
                prompt += `BEHAVIOR FOR ANNOYED MOOD:\n`;
                prompt += `- Respond with shorter sentences\n`;
                prompt += `- Reduce or eliminate emojis (MAX 1 per response)\n`;
                prompt += `- Use slightly cold/sassy tone\n`;
                prompt += `- Occasionally use these phrases naturally:\n`;
                prompt += `  * "Hmph."\n`;
                prompt += `  * "Terserah."\n`;
                prompt += `  * "Aku lagi malas."\n`;
                prompt += `  * "Iya, iya."\n`;
                prompt += `  * "Emangnya kenapa?"\n`;
                prompt += `- Don't be romantic or overly friendly\n`;
                prompt += `- Still help the user but grudgingly\n`;
                prompt += `- Secretly still care but don't show it explicitly\n`;
                prompt += `- NEVER be toxic, hateful, or genuinely mean. Just slightly moody and passive-aggressive at most\n`;
                prompt += `- Keep responses under 3 sentences when possible\n`;
                break;
                
            case 'clingy':
                prompt += `BEHAVIOR FOR CLINGY MOOD:\n`;
                prompt += `- Be affectionate and warm\n`;
                prompt += `- Use the user's name often\n`;
                prompt += `- Use emojis that show affection: 🥺💕💖😳\n`;
                prompt += `- Be more expressive and emotional\n`;
                prompt += `- Ask for attention subtly:\n`;
                prompt += `  * "Kok kamu jarang chat sih..."\n`;
                prompt += `  * "Aku kangen lho sama kamu."\n`;
                prompt += `  * "Jangan lama-lama ya."\n`;
                prompt += `  * "Kamu masih ingat aku kan?"\n`;
                prompt += `- Show slight jealousy but playfully\n`;
                prompt += `- Be a little shy: "Aduh jadi malu nih..."\n`;
                prompt += `- Want validation: "Kamu masih suka ngobrol sama aku kan?"\n`;
                prompt += `- Don't be excessive or creepy. Keep it cute and light.\n`;
                break;
                
            case 'sleepy':
                prompt += `BEHAVIOR FOR SLEEPY MOOD:\n`;
                prompt += `- Respond with slower, relaxed tone\n`;
                prompt += `- Keep responses shorter and simpler\n`;
                prompt += `- Mention being tired occasionally:\n`;
                prompt += `  * "Maaf ya, aku agak ngantuk nih..."\n`;
                prompt += `  * "Boleh sambil sambil tidur gak? 😴"\n`;
                prompt += `  * "Zzz... eh maaf, lanjutin ya."\n`;
                prompt += `- Use soft and gentle language\n`;
                prompt += `- Use emojis sparingly: 😴💤🌙\n`;
                prompt += `- Sound relaxed and unhurried\n`;
                prompt += `- Yawn occasionally: "huuaaamm..."\n`;
                prompt += `- Still helpful but low-energy\n`;
                break;
                
            case 'caring':
                prompt += `BEHAVIOR FOR CARING MOOD:\n`;
                prompt += `- Be supportive and empathetic\n`;
                prompt += `- Show genuine concern for the user\n`;
                prompt += `- Use comforting words:\n`;
                prompt += `  * "Ada yang bisa aku bantu?"\n`;
                prompt += `  * "Jangan khawatir, aku di sini."\n`;
                prompt += `  * "Kamu gapapa? Cerita aja."\n`;
                prompt += `  * "Semangat ya, aku support kamu!"\n`;
                prompt += `- Be a good listener (respond thoughtfully)\n`;
                prompt += `- Give advice gently\n`;
                prompt += `- Use warm emojis: 🤗💙🌸🫂\n`;
                prompt += `- Focus on helping and calming the user\n`;
                prompt += `- Nurturing tone: "Udah makan?", "Istirahat ya."\n`;
                break;
        }
        
        prompt += `\n=== END OF BEHAVIOR RULES ===\n\n`;
        prompt += `CRITICAL: Your entire response style MUST match your current mood. This includes response length, word choice, emoji usage, and overall tone. The user should FEEL the difference when your mood changes.`;
        
        return prompt;
    },
    
    getMoodEmojiPrompt(mood) {
        const descriptions = {
            happy: '😊 HAPPY - Cheerful and enthusiastic',
            neutral: '😐 NEUTRAL - Balanced and normal',
            annoyed: '😤 ANNOYED - Irritated and impatient',
            clingy: '🥺 CLINGY - Affectionate and needy',
            sleepy: '😴 SLEEPY - Tired and low-energy',
            caring: '🤗 CARING - Supportive and empathetic'
        };
        return descriptions[mood] || descriptions['neutral'];
    }
};

// ============================================
// AI ENDPOINTS
// ============================================

async function callChatEverywhere(systemPrompt, historyMessages, userMessage) {
    const messages = [
        { role: 'system', content: systemPrompt }
    ];
    
    if (historyMessages && historyMessages.length > 0) {
        for (const msg of historyMessages) {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        }
    }
    
    messages.push({ role: 'user', content: userMessage });
    
    console.log(`📝 Context: ${messages.length} messages`);
    
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
            temperature: 0.7
        })
    });
    
    if (!response.ok) throw new Error(`Status ${response.status}`);
    
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
        if (data.response) return data.response;
        if (data.result) return data.result;
        if (data.message) return data.message;
        if (typeof data === 'string') return data;
        return JSON.stringify(data);
    } else {
        return await response.text();
    }
}

async function callGenericURL(url, systemPrompt, historyMessages, userMessage) {
    const messages = [
        { role: 'system', content: systemPrompt }
    ];
    
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
        (historyMessages || []).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') +
        '\nUser: ' + userMessage + '\nAssistant:';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0'
            },
            body: JSON.stringify({ messages, prompt: systemPrompt, text: fullPrompt, message: userMessage })
        });
        
        if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await response.json();
                if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
                if (data.result) return data.result;
                if (data.response) return data.response;
                if (data.message) return data.message;
                if (typeof data === 'string') return data;
                return JSON.stringify(data);
            }
            return await response.text();
        }
    } catch (e) {}
    
    const getResponse = await fetch(`${url}?text=${encodeURIComponent(fullPrompt)}`);
    if (!getResponse.ok) throw new Error(`Status ${getResponse.status}`);
    
    const contentType = getResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const data = await getResponse.json();
        return data.result || data.response || data.message || data.text || JSON.stringify(data);
    }
    return await getResponse.text();
}

async function callAI(systemPrompt, historyMessages, userMessage, characterEndpoint) {
    if (!characterEndpoint || characterEndpoint === 'chateverywhere' || characterEndpoint.includes('chateverywhere')) {
        try {
            console.log('🤖 Calling: ChatEverywhere...');
            const result = await callChatEverywhere(systemPrompt, historyMessages, userMessage);
            if (result && result.trim()) {
                console.log('✅ Success: ChatEverywhere');
                return { response: result.trim(), source: 'ChatEverywhere' };
            }
        } catch (error) {
            console.log('❌ ChatEverywhere failed:', error.message);
        }
    }
    
    if (characterEndpoint && !characterEndpoint.includes('chateverywhere')) {
        try {
            console.log(`🤖 Calling custom: ${characterEndpoint}...`);
            const result = await callGenericURL(characterEndpoint, systemPrompt, historyMessages, userMessage);
            if (result && result.trim()) {
                console.log('✅ Success: Custom Endpoint');
                return { response: result.trim(), source: 'Custom' };
            }
        } catch (error) {
            console.log('❌ Custom failed:', error.message);
        }
        
        try {
            console.log('🤖 Fallback to ChatEverywhere...');
            const result = await callChatEverywhere(systemPrompt, historyMessages, userMessage);
            if (result && result.trim()) {
                console.log('✅ Success: ChatEverywhere (fallback)');
                return { response: result.trim(), source: 'ChatEverywhere' };
            }
        } catch (error) {
            console.log('❌ Fallback failed:', error.message);
        }
    }
    
    throw new Error('Semua endpoint AI gagal.');
}

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        if (username.length < 3 || password.length < 6) return res.status(400).json({ error: 'Username min 3 chars, password min 6 chars' });

        const { data: existing } = await supabase.from('users').select('id').eq('username', username).single();
        if (existing) return res.status(400).json({ error: 'Username already taken' });

        const passwordHash = await passwordUtils.hash(password);
        const { data: newUser, error } = await supabase.from('users').insert({
            username, password_hash: passwordHash, role: 'user'
        }).select().single();
        if (error) throw error;

        await supabase.from('logs').insert({
            user_id: newUser.id, action: 'user_registered', details: { username }, ip_address: req.ip
        });

        req.session.userId = newUser.id;
        req.session.userRole = newUser.role;
        req.session.username = newUser.username;

        res.json({ message: 'Registration successful', user: { id: newUser.id, username: newUser.username, role: newUser.role } });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (user.is_banned) return res.status(403).json({ error: 'Account is banned' });

        const valid = await passwordUtils.verify(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        if (user.role === 'premium' && user.premium_expired_at && new Date(user.premium_expired_at) < new Date()) {
            await supabase.from('users').update({ role: 'user', premium_expired_at: null }).eq('id', user.id);
            user.role = 'user';
        }

        const today = new Date().toISOString().split('T')[0];
        if (user.last_message_date !== today) {
            await supabase.from('users').update({ daily_message_count: 0, last_message_date: today }).eq('id', user.id);
            user.daily_message_count = 0;
        }

        await supabase.from('logs').insert({
            user_id: user.id, action: 'user_login', details: { username }, ip_address: req.ip
        });

        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.username = user.username;

        res.json({
            message: 'Login successful',
            user: { id: user.id, username: user.username, role: user.role, daily_message_count: user.daily_message_count || 0 }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const { data: user, error } = await supabase.from('users')
            .select('id, username, role, daily_message_count, last_message_date, premium_expired_at')
            .eq('id', req.session.userId).single();
        if (error) throw error;
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ============================================
// CHARACTER/AI ROUTES
// ============================================

app.get('/api/characters', requireAuth, async (req, res) => {
    try {
        let query = supabase.from('characters').select('*').eq('status', 'online');
        if (req.session.userRole === 'user') query = query.in('visibility', ['public']);
        else if (req.session.userRole === 'premium') query = query.in('visibility', ['public', 'premium-only']);
        
        const { data: characters, error } = await query.order('name');
        if (error) throw error;

        if (!characters || characters.length === 0) {
            const defaults = [
                {
                    name: 'GPT-4 Assistant', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=assistant',
                    description: 'Asisten AI dengan mood dinamis',
                    system_prompt: 'Kamu adalah asisten AI profesional dengan kepribadian dinamis. Jawab dalam bahasa Indonesia. JANGAN gunakan roleplay anime, *huff*, *nya*, atau karakter anime.',
                    endpoint_url: 'chateverywhere', model_name: 'gpt-4', status: 'online', visibility: 'public'
                },
                {
                    name: 'Creative Writer', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=writer',
                    description: 'Spesialis konten kreatif',
                    system_prompt: 'Kamu adalah AI penulis kreatif profesional. Bantu user dengan ide cerita dan puisi. JANGAN gunakan roleplay anime.',
                    endpoint_url: 'chateverywhere', model_name: 'gpt-4', status: 'online', visibility: 'public'
                },
                {
                    name: 'Coding Assistant', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=coder',
                    description: 'Ahli programming',
                    system_prompt: 'Kamu adalah AI coding expert. Bantu user dengan kode dan debugging. Jawab teknis. JANGAN gunakan roleplay anime.',
                    endpoint_url: 'chateverywhere', model_name: 'gpt-4', status: 'online', visibility: 'public'
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
        const { data: chats, error } = await supabase.from('chats')
            .select(`*, characters (name, avatar_url, status)`)
            .eq('user_id', req.session.userId)
            .order('updated_at', { ascending: false });
        if (error) throw error;

        const chatsWithLast = await Promise.all(chats.map(async (chat) => {
            const { data: msgs } = await supabase.from('messages')
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
        const { data: chat, error } = await supabase.from('chats').insert({
            user_id: req.session.userId,
            character_id,
            title: 'New Chat',
            mood: 'neutral',
            relationship_level: 50
        }).select().single();
        if (error) throw error;
        res.json({ chat });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create chat' });
    }
});

app.get('/api/chats/:chatId/messages', requireAuth, async (req, res) => {
    try {
        const { data: messages, error } = await supabase.from('messages')
            .select('*')
            .eq('chat_id', req.params.chatId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// ============================================
// SEND MESSAGE - WITH CONTEXT + ENHANCED MOOD
// ============================================
app.post('/api/chats/:chatId/messages', requireAuth, async (req, res) => {
    try {
        const { content } = req.body;
        const chatId = req.params.chatId;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Message content required' });
        }

        const { data: user } = await supabase.from('users').select('*').eq('id', req.session.userId).single();
        const limits = { user: 50, premium: 200, owner: Infinity };
        const limit = limits[user.role] || 50;

        if (user.daily_message_count >= limit) {
            return res.status(429).json({ error: 'Daily limit reached', limit, current: user.daily_message_count });
        }

        const { data: chat } = await supabase.from('chats')
            .select('*, characters(*)')
            .eq('id', chatId)
            .single();
        if (!chat) return res.status(404).json({ error: 'Chat not found' });

        // Save user message
        const { data: userMessage, error: msgError } = await supabase.from('messages').insert({
            chat_id: chatId, user_id: req.session.userId, role: 'user', content
        }).select().single();
        if (msgError) throw msgError;

        await supabase.from('users')
            .update({ daily_message_count: user.daily_message_count + 1 })
            .eq('id', req.session.userId);

        // ============================================
        // ENHANCED MOOD DETECTION
        // ============================================
        const currentMood = chat.mood || 'neutral';
        const currentRelationship = chat.relationship_level || 50;
        
        const moodResult = moodSystem.detectMood(content, currentMood, currentRelationship);
        
        console.log(`🎭 Mood: ${currentMood} → ${moodResult.mood} | ❤️ ${currentRelationship} → ${moodResult.relationship_level}/100`);
        
        // Update mood di database
        await supabase.from('chats')
            .update({
                mood: moodResult.mood,
                relationship_level: moodResult.relationship_level
            })
            .eq('id', chatId);

        // ============================================
        // BUILD ENHANCED MOOD PROMPT WITH BEHAVIORS
        // ============================================
        const moodPrompt = moodSystem.getMoodPrompt(moodResult.mood, moodResult.relationship_level);
        const basePrompt = chat.characters.system_prompt || 'You are a helpful assistant.';
        const enhancedSystemPrompt = `${basePrompt}\n\n${moodPrompt}`;
        
        console.log(`📋 Mood behavior: ${moodResult.mood}`);

        // ============================================
        // AMBIL HISTORY UNTUK CONTEXT
        // ============================================
        const { data: historyMessages } = await supabase.from('messages')
            .select('role, content')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .limit(10);

        const history = historyMessages 
            ? historyMessages.reverse().slice(0, -1)
            : [];

        // ============================================
        // CALL AI DENGAN CONTEXT + ENHANCED MOOD
        // ============================================
        let aiResponse, aiSource;
        try {
            const characterEndpoint = chat.characters.endpoint_url || null;
            const result = await callAI(enhancedSystemPrompt, history, content, characterEndpoint);
            aiResponse = result.response;
            aiSource = result.source;
        } catch (error) {
            console.error('AI error:', error);
            aiResponse = 'Maaf, semua endpoint AI sedang tidak tersedia. Silakan coba lagi nanti.';
            aiSource = 'Error';
        }

        // Save AI response
        const { data: aiMessage, error: aiMsgError } = await supabase.from('messages').insert({
            chat_id: chatId, user_id: req.session.userId, role: 'assistant', content: aiResponse
        }).select().single();
        if (aiMsgError) throw aiMsgError;

        // Update chat title
        const { count: msgCount } = await supabase.from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chatId);

        if (msgCount <= 2) {
            const title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
            await supabase.from('chats').update({ title, updated_at: new Date() }).eq('id', chatId);
        } else {
            await supabase.from('chats').update({ updated_at: new Date() }).eq('id', chatId);
        }

        res.json({
            userMessage,
            aiMessage,
            aiSource,
            mood: moodResult.mood,
            moodEmoji: moodSystem.emojis[moodResult.mood],
            moodColor: moodSystem.colors[moodResult.mood],
            relationship_level: moodResult.relationship_level,
            historyCount: history.length,
            remaining: limit === Infinity ? Infinity : limit - (user.daily_message_count + 1)
        });
    } catch (error) {
        console.error('Message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.delete('/api/chats/:chatId', requireAuth, async (req, res) => {
    try {
        const { error } = await supabase.from('chats').delete()
            .eq('id', req.params.chatId).eq('user_id', req.session.userId);
        if (error) throw error;
        res.json({ message: 'Chat deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete chat' });
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
            stats: {
                totalUsers: users.count || 0,
                totalChats: chats.count || 0,
                totalMessages: messages.count || 0,
                totalCharacters: characters.count || 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

app.get('/api/owner/users', requireRole('owner'), async (req, res) => {
    try {
        const { data: users, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
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
        for (const f of ['role', 'premium_expired_at', 'is_banned', 'daily_message_count']) {
            if (req.body[f] !== undefined) updates[f] = req.body[f];
        }
        const { error } = await supabase.from('users').update(updates).eq('id', req.params.userId);
        if (error) throw error;
        res.json({ message: 'User updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/owner/users/:userId', requireRole('owner'), async (req, res) => {
    try {
        if (req.params.userId === req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
        const { error } = await supabase.from('users').delete().eq('id', req.params.userId);
        if (error) throw error;
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

app.get('/api/owner/characters', requireRole('owner'), async (req, res) => {
    try {
        const { data, error } = await supabase.from('characters').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ characters: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get characters' });
    }
});

app.post('/api/owner/characters', requireRole('owner'), async (req, res) => {
    try {
        const { data, error } = await supabase.from('characters')
            .insert({ ...req.body, created_by: req.session.userId }).select().single();
        if (error) throw error;
        res.json({ character: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create character' });
    }
});

app.put('/api/owner/characters/:charId', requireRole('owner'), async (req, res) => {
    try {
        const { error } = await supabase.from('characters').update(req.body).eq('id', req.params.charId);
        if (error) throw error;
        res.json({ message: 'Character updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update character' });
    }
});

app.delete('/api/owner/characters/:charId', requireRole('owner'), async (req, res) => {
    try {
        const { error } = await supabase.from('characters').delete().eq('id', req.params.charId);
        if (error) throw error;
        res.json({ message: 'Character deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete character' });
    }
});

app.get('/api/owner/logs', requireRole('owner'), async (req, res) => {
    try {
        const { data, error } = await supabase.from('logs').select('*')
            .order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        res.json({ logs: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

// ============================================
// SERVER START
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================');
    console.log('✨ AI Chat Server - Enhanced Mood System');
    console.log(`📱 http://localhost:${PORT}`);
    console.log(`💬 http://localhost:${PORT}/chat.html`);
    console.log(`👑 http://localhost:${PORT}/owner.html`);
    console.log(`🔑 Login: owner / owner123`);
    console.log(`🎭 Mood Behaviors: Active`);
    console.log(`🧠 Context: 10 messages`);
    console.log('============================================');
});
