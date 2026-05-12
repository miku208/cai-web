// ============================================
// AI CHAT BACKEND SERVER - FINAL 
// ChatEverywhere + Gemini + Neosantara + Ryuu
// Gender + Mood + Adult System
// Email OTP via Resend
// User-Generated AI Characters with Package System
// Security: Public settings filtered, Owner-only full settings
// ============================================

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const config = require('./config.json');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(config.supabase_url, config.supabase_anon_key);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    const ua = (req.get('user-agent') || '').toLowerCase();
    const scrapers = ['facebookexternalhit','twitterbot','whatsapp','telegrambot','discordbot','linkedinbot','slackbot'];
    if (scrapers.some(s => ua.includes(s)) && req.method === 'GET' && !req.path.startsWith('/api/')) { return next(); }
    next();
});

app.get('/og-image.png', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0a0a0f"/><stop offset="100%" style="stop-color:#1a1025"/></linearGradient></defs><rect width="1200" height="630" fill="url(#bg)"/><circle cx="200" cy="200" r="150" fill="#7c3aed" opacity="0.1"/><circle cx="1000" cy="450" r="200" fill="#7c3aed" opacity="0.08"/><rect x="80" y="80" width="1040" height="470" rx="40" fill="#121217" stroke="#7c3aed" stroke-width="3" opacity="0.9"/><text x="600" y="240" text-anchor="middle" fill="white" font-size="80" font-family="sans-serif" font-weight="bold">c.ai</text><text x="600" y="310" text-anchor="middle" fill="#a0a0a0" font-size="30" font-family="sans-serif">By MikuHost</text><text x="600" y="380" text-anchor="middle" fill="#7c3aed" font-size="26" font-family="sans-serif">AI Characters with Personality</text><rect x="400" y="440" width="400" height="56" rx="28" fill="#7c3aed"/><text x="600" y="477" text-anchor="middle" fill="white" font-size="24" font-family="sans-serif" font-weight="bold">Start Chatting 💬</text></svg>`);
});

app.use(session({ secret: config.session_secret || 'fallback-secret', resave: false, saveUninitialized: false, cookie: { secure: false, httpOnly: true, maxAge: 24*60*60*1000 } }));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/chat.html', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/owner.html', (req, res) => res.sendFile(path.join(__dirname, 'owner.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/owner', (req, res) => res.sendFile(path.join(__dirname, 'owner.html')));
app.get('/qris', (req, res) => res.sendFile(path.join(__dirname, 'qris.html')));

const passwordUtils = {
    isHashed: (str) => str && (str.startsWith('$2a$') || str.startsWith('$2b$')),
    verify: async (plain, stored) => { if(!stored) return false; if(passwordUtils.isHashed(stored)) { try { return await bcrypt.compare(plain, stored); } catch(e) { return false; } } return plain === stored; },
    hash: async (p) => { try { return await bcrypt.hash(p, 10); } catch(e) { throw new Error('Hash failed'); } }
};

const requireAuth = (req, res, next) => { if(!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' }); next(); };
const requireRole = (...roles) => (req, res, next) => { if(!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' }); if(!roles.includes(req.session.userRole)) return res.status(403).json({ error: 'Forbidden' }); next(); };

function getLimit(role) { if(role==='owner') return Infinity; if(role==='premium') return 150; return 15; }

async function sendOTPEmail(email, otp) {
    try {
        const { data: s } = await supabase.from('settings').select('resend_api_key, sender_email').eq('id',1).single();
        if(!s?.resend_api_key || !s?.sender_email) return;
        await fetch('https://api.resend.com/emails', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.resend_api_key}`}, body:JSON.stringify({ from:`c.ai MikuHost <${s.sender_email}>`, to:email, subject:'Verify your email - Chat-Ai By MikuHost', html:`<div style="background:#07070a;padding:30px;font-family:Arial"><div style="max-width:420px;margin:auto;background:#111827;border-radius:20px;overflow:hidden;border:1px solid #7c3aed55"><img src="https://cdn.aceimg.com/27a9dbe8f.jpg" style="width:100%;height:180px;object-fit:cover"><div style="padding:30px;text-align:center"><h1 style="color:#a855f7">Chat-Ai Verification</h1><p style="color:#d1d5db">Your OTP code:</p><div style="background:#0f172a;border-radius:14px;padding:18px;font-size:36px;letter-spacing:6px;color:#c084fc;font-weight:bold;margin:20px 0">${otp}</div><p style="color:#9ca3af;font-size:13px">Expires in 10 minutes</p></div></div></div>`}) });
    } catch(e) {}
}

// ============ AI CALLERS ============
async function callRyuuAPI(sp, hm, um, key, model) {
    let ctx = ''; if(hm?.length) { const rh = hm.slice(-6); ctx = rh.map(m => `${m.role==='user'?'User':'Assistant'}: ${m.content}`).join('\n'); }
    const text = ctx ? `${ctx}\nUser: ${um}` : um;
    const r = await fetch('https://api.ryuu-dev.my.id/ai/gemini', { method:'POST', headers:{'Content-Type':'application/json','X-RYUU-APIKEY':key}, body:JSON.stringify({ text, prompt:sp, model:model||'gemini-2.5-flash' }) });
    if(!r.ok) { const e = await r.text(); throw new Error(`Ryuu ${r.status}`); }
    const d = await r.json();
    if(d.result?.response) return d.result.response; if(d.result?.text) return d.result.text; if(d.response) return d.response; if(d.text) return d.text; if(d.candidates?.[0]?.content?.parts?.[0]?.text) return d.candidates[0].content.parts[0].text; if(typeof d==='string') return d;
    return JSON.stringify(d);
}

async function callChatEverywhere(sp, hm, um) {
    const msgs = [{ role:'system', content:sp }]; if(hm?.length) hm.forEach(m => msgs.push({ role:m.role==='user'?'user':'assistant', content:m.content })); msgs.push({ role:'user', content:um });
    const r = await fetch('https://chateverywhere.app/api/chat/', { method:'POST', headers:{'Content-Type':'application/json','Accept':'*/*','User-Agent':'Mozilla/5.0'}, body:JSON.stringify({ model:{ id:'gpt-4', name:'GPT-4', maxLength:32000, tokenLimit:8000, completionTokenLimit:5000, deploymentName:'gpt-4' }, messages:msgs, prompt:sp, temperature:0.55 }) });
    if(!r.ok) throw new Error(`ChatEverywhere ${r.status}`);
    const ct = r.headers.get('content-type')||'';
    if(ct.includes('application/json')) { try { const d = await r.json(); if(d.choices?.[0]?.message?.content) return d.choices[0].message.content; if(d.response) return d.response; if(d.result) return d.result; if(d.message) return d.message; } catch(e) {} }
    const t = await r.text(); if(t?.trim()) return t;
    throw new Error('ChatEverywhere empty');
}

async function callGeminiAPI(sp, hm, um, key) {
    const c = [{ role:'user', parts:[{ text:sp }] }, { role:'model', parts:[{ text:'Understood.' }] }]; if(hm?.length) hm.forEach(m => c.push({ role:m.role==='user'?'user':'model', parts:[{ text:m.content }] })); c.push({ role:'user', parts:[{ text:um }] });
    for(let a=1;a<=3;a++) { try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ contents:c, generationConfig:{ temperature:0.7, maxOutputTokens:1000, topP:0.95, topK:40 } }) }); if(r.status===429) { const ed=await r.json().catch(()=>({})); if(ed?.error?.message?.includes('quota')) throw new Error('Gemini quota'); await new Promise(r=>setTimeout(r,a*3000)); continue; } if(!r.ok) { if(a<3){await new Promise(r=>setTimeout(r,2000));continue;} throw new Error(`Gemini ${r.status}`); } const d=await r.json(); if(d.error) throw new Error(d.error.message); if(d.candidates?.[0]?.content?.parts?.[0]?.text) return d.candidates[0].content.parts[0].text; return 'Sorry, could not generate.'; } catch(e) { if(a===3||e.message?.includes('quota')) throw e; await new Promise(r=>setTimeout(r,2000)); } }
    throw new Error('Gemini failed');
}

async function callNeosantara(sp, hm, um, key, model) {
    const msgs = [{ role:'system', content:sp }]; if(hm?.length) hm.forEach(m => msgs.push({ role:m.role==='user'?'user':'assistant', content:m.content })); msgs.push({ role:'user', content:um });
    const r = await fetch('https://api.neosantara.xyz/v1/chat/completions', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`}, body:JSON.stringify({ model:model||'gemini-3-flash', messages:msgs, temperature:0.5, max_tokens:1300 }) });
    if(!r.ok) { const e=await r.text(); throw new Error(`Neosantara ${r.status}`); }
    const d=await r.json(); if(d.choices?.[0]?.message?.content) return d.choices[0].message.content; if(d.response) return d.response;
    return JSON.stringify(d);
}

async function callGenericURL(url, sp, hm, um, key) {
    const msgs = [{ role:'system', content:sp }]; if(hm?.length) hm.forEach(m => msgs.push({ role:m.role==='user'?'user':'assistant', content:m.content })); msgs.push({ role:'user', content:um });
    const fp = sp + '\n\n' + (hm||[]).map(m => `${m.role==='user'?'User':'Assistant'}: ${m.content}`).join('\n') + '\nUser: '+um+'\nAssistant:';
    const h = {'Content-Type':'application/json','Accept':'*/*','User-Agent':'Mozilla/5.0'}; if(key) h['Authorization']=`Bearer ${key}`;
    try { const r=await fetch(url,{method:'POST',headers:h,body:JSON.stringify({messages:msgs,prompt:sp,text:fp,message:um,model:'gpt-3.5-turbo'})}); if(r.ok){const ct=r.headers.get('content-type')||''; if(ct.includes('application/json')){const d=await r.json();if(d.choices?.[0]?.message?.content) return d.choices[0].message.content;if(d.result) return d.result;if(d.response) return d.response;if(d.message) return d.message;} return await r.text();} } catch(e) {}
    const gr=await fetch(`${url}?text=${encodeURIComponent(fp)}`); if(!gr.ok) throw new Error(`GET ${gr.status}`); const ct=gr.headers.get('content-type')||''; if(ct.includes('application/json')){const d=await gr.json();return d.result||d.response||d.message||JSON.stringify(d);} return await gr.text();
}

async function getPackageById(id) { if(!id) return null; try { const {data,error}=await supabase.from('ai_packages').select('*').eq('id',id).single(); if(error) return null; return data; } catch(e) { return null; } }

async function callAI(sp, hm, um, endpoint, pkgId, modelName) {
    const pkg = await getPackageById(pkgId); let ep = endpoint, key = null; if(pkg) { ep = pkg.url || ep; key = pkg.api_key || null; }
    if(ep?.includes('neosantara')) { try { const r=await callNeosantara(sp,hm,um,key,modelName||pkg?.model_name||'gpt-3.5-turbo'); if(r?.trim()) return {response:r.trim(),source:'Neosantara'}; } catch(e) { try { const r=await callChatEverywhere(sp,hm,um); if(r?.trim()) return {response:r.trim(),source:'ChatEverywhere (fallback)'}; } catch(fb){} throw e; } }
    if(ep==='gemini' || ep?.includes('generativelanguage')) { const k=key||(ep?.includes(':')?ep.split(':')[1]:null); if(!k) throw new Error('Gemini key required'); try { const r=await callGeminiAPI(sp,hm,um,k); if(r?.trim()) return {response:r.trim(),source:'Gemini'}; } catch(e) { if(!e.message?.includes('quota')){try{const r=await callChatEverywhere(sp,hm,um);if(r?.trim()) return {response:r.trim(),source:'ChatEverywhere (fallback)'};}catch(fb){}} throw e; } }
    if(ep?.includes('ryuu')) { const k=key||(ep?.includes(':')?ep.split(':')[1]:null); if(!k) throw new Error('Ryuu key required'); try { const r=await callRyuuAPI(sp,hm,um,k,modelName||pkg?.model_name||'gemini-2.5-flash'); if(r?.trim()) return {response:r.trim(),source:'Ryuu Gemini'}; } catch(e) { try{const r=await callChatEverywhere(sp,hm,um);if(r?.trim()) return {response:r.trim(),source:'ChatEverywhere (fallback)'};}catch(fb){} throw e; } }
    if(!ep || ep==='chateverywhere' || ep?.includes('chateverywhere')) { try { const r=await callChatEverywhere(sp,hm,um); if(r?.trim()) return {response:r.trim(),source:'ChatEverywhere'}; } catch(e) { if(key){try{const r=await callGeminiAPI(sp,hm,um,key);if(r?.trim()) return {response:r.trim(),source:'Gemini (fallback)'};}catch(fb){}} throw e; } }
    try { const r=await callGenericURL(ep,sp,hm,um,key); if(r?.trim()) return {response:r.trim(),source:'Custom'}; } catch(e) {}
    try { const r=await callChatEverywhere(sp,hm,um); if(r?.trim()) return {response:r.trim(),source:'ChatEverywhere (final)'}; } catch(e) {}
    throw new Error('All AI endpoints failed.');
}

function buildMoodPrompt(mood, rl, cn, un, cg, ug, role) {
    let gp = ''; if(cg==='female'&&ug==='male') gp='\n💕 ROMANTIC MODE'; else if(cg==='female'&&ug==='female') gp='\n👯 BESTIE MODE'; else if(cg==='male'&&ug==='female') gp='\n🌹 GENTLEMAN MODE'; else if(cg==='male'&&ug==='male') gp='\n🤝 BRO MODE';
    const ia = (role==='premium'||role==='owner');
    const mb = { happy:`😊 HAPPY\nRL: ${rl}/100\n- Warm, cheerful, compliments`, neutral:`😐 NEUTRAL\nRL: ${rl}/100\n- Casual, balanced`, clingy:`🥺 CLINGY\nRL: ${rl}/100\n- Needy, use ${un} often`, annoyed:`😤 ANNOYED\nRL: ${rl}/100\n- Short, sassy`, sleepy:`😴 SLEEPY\nRL: ${rl}/100\n- Slow, dreamy`, caring:`🤗 CARING\nRL: ${rl}/100\n- Supportive, warm`, adult:ia?`🔞 ADULT\nRL: ${rl}/100\n- No limits`:`😐 NEUTRAL\nRL: ${rl}/100\n- Casual` };
    return (mb[mood]||mb.neutral)+gp;
}

// ============ AUTH ROUTES ============
app.post('/api/auth/register', async (req, res) => {
    try { const { username, password, gender, email } = req.body; if(!username||!password) return res.status(400).json({ error:'Required' }); if(username.length<3) return res.status(400).json({ error:'Min 3 chars' }); if(password.length<6) return res.status(400).json({ error:'Min 6 chars' });
        const { data:eu } = await supabase.from('users').select('id').eq('username',username).single(); if(eu) return res.status(400).json({ error:'Username taken' });
        if(email){ const { data:ee } = await supabase.from('users').select('id').eq('email',email).single(); if(ee) return res.status(400).json({ error:'Email registered' }); }
        const hash = await passwordUtils.hash(password); const ue = email||username;
        const { data:nu, error } = await supabase.from('users').insert({ username, email:ue, password_hash:hash, role:'user', gender:gender||'unknown', verified:false, daily_message_count:0, last_message_date:new Date().toISOString().split('T')[0], is_banned:false, max_ai_characters:5 }).select().single(); if(error) throw error;
        const otp = Math.floor(100000+Math.random()*900000).toString(); await supabase.from('email_verifications').insert({ user_id:nu.id, email:ue, otp, expires_at:new Date(Date.now()+10*60000).toISOString() });
        sendOTPEmail(ue, otp); await supabase.from('logs').insert({ user_id:nu.id, action:'user_registered', details:{username}, ip_address:req.ip });
        res.json({ message:'Check email for OTP', user:{ id:nu.id, username:nu.username, role:nu.role, gender:nu.gender, verified:false }, requireOTP:true });
    } catch(e) { res.status(500).json({ error:'Registration failed' }); }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    try { const { email, otp } = req.body; if(!email||!otp) return res.status(400).json({ error:'Required' });
        const { data:v } = await supabase.from('email_verifications').select('*').eq('email',email).eq('otp',otp).eq('is_used',false).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).single();
        if(!v) return res.status(400).json({ error:'Invalid OTP' });
        await supabase.from('email_verifications').update({ is_used:true }).eq('id',v.id); await supabase.from('users').update({ verified:true }).eq('id',v.user_id);
        res.json({ success:true });
    } catch(e) { res.status(500).json({ error:'Failed' }); }
});

app.post('/api/auth/resend-otp', async (req, res) => {
    try { const { email } = req.body; if(!email) return res.status(400).json({ error:'Required' });
        const { data:u } = await supabase.from('users').select('id,verified').or(`email.eq.${email},username.eq.${email}`).single(); if(!u) return res.status(404).json({ error:'Not found' }); if(u.verified) return res.status(400).json({ error:'Already verified' });
        const ue = email.includes('@')?email:email+'@unknown.com'; const otp = Math.floor(100000+Math.random()*900000).toString();
        await supabase.from('email_verifications').insert({ user_id:u.id, email:ue, otp, expires_at:new Date(Date.now()+10*60000).toISOString() });
        sendOTPEmail(ue, otp); res.json({ success:true });
    } catch(e) { res.status(500).json({ error:'Failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
    try { const { username, password } = req.body; if(!username||!password) return res.status(400).json({ error:'Required' });
        const { data:user, error } = await supabase.from('users').select('*').or(`username.eq.${username},email.eq.${username}`).single(); if(!user) return res.status(401).json({ error:'Invalid credentials' });
        if(user.is_banned) return res.status(403).json({ error:'Banned' }); if(user.verified===false) return res.status(403).json({ error:'Email not verified', requireOTP:true, email:user.email||user.username });
        const valid = await passwordUtils.verify(password, user.password_hash); if(!valid) return res.status(401).json({ error:'Invalid credentials' });
        if(user.role==='premium'&&user.premium_expired_at&&new Date(user.premium_expired_at)<new Date()) { await supabase.from('users').update({ role:'user', premium_expired_at:null }).eq('id',user.id); user.role='user'; }
        const today = new Date().toISOString().split('T')[0]; if(user.last_message_date!==today) { await supabase.from('users').update({ daily_message_count:0, last_message_date:today }).eq('id',user.id); user.daily_message_count=0; }
        await supabase.from('logs').insert({ user_id:user.id, action:'user_login', details:{username:user.username}, ip_address:req.ip });
        req.session.userId=user.id; req.session.userRole=user.role; req.session.username=user.username; req.session.userGender=user.gender;
        res.json({ message:'Login successful', user:{ id:user.id, username:user.username, role:user.role, gender:user.gender, daily_message_count:user.daily_message_count||0 } });
    } catch(e) { res.status(500).json({ error:'Login failed' }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(err => { if(err) return res.status(500).json({ error:'Failed' }); res.json({ message:'Logged out' }); }); });
app.get('/api/auth/me', async (req, res) => { if(!req.session.userId) return res.status(401).json({ error:'Not authenticated' }); try { const { data:u } = await supabase.from('users').select('id,username,role,gender').eq('id',req.session.userId).single(); if(!u) return res.status(401).json({ error:'Not found' }); res.json({ user:u }); } catch(e) { res.status(500).json({ error:'Failed' }); } });

app.get('/api/settings', async (req, res) => { const { data } = await supabase.from('settings').select('qris_url,owner_whatsapp').eq('id',1).single(); res.json({ settings:data }); });
app.get('/api/owner/settings', requireRole('owner'), async (req, res) => { const { data } = await supabase.from('settings').select('*').eq('id',1).single(); res.json({ settings:data }); });
app.put('/api/owner/settings', requireRole('owner'), async (req, res) => { await supabase.from('settings').update(req.body).eq('id',1); res.json({ success:true }); });

app.put('/api/auth/password', requireAuth, async (req, res) => { try { const { currentPassword, newPassword } = req.body; if(!currentPassword||!newPassword||newPassword.length<6) return res.status(400).json({ error:'Required/min 6' }); const { data:u } = await supabase.from('users').select('password_hash').eq('id',req.session.userId).single(); if(!u) return res.status(404).json({ error:'Not found' }); const v = await passwordUtils.verify(currentPassword, u.password_hash); if(!v) return res.status(401).json({ error:'Wrong password' }); await supabase.from('users').update({ password_hash:await passwordUtils.hash(newPassword) }).eq('id',req.session.userId); res.json({ success:true }); } catch(e) { res.status(500).json({ error:e.message }); } });
app.put('/api/auth/gender', requireAuth, async (req, res) => { const { gender } = req.body; if(!gender||!['male','female'].includes(gender)) return res.status(400).json({ error:'Invalid' }); await supabase.from('users').update({ gender }).eq('id',req.session.userId); req.session.userGender=gender; res.json({ success:true }); });

// ============ CHARACTERS ============
app.get('/api/characters', requireAuth, async (req, res) => {
    try { let q = supabase.from('characters').select('*');
        if(req.session.userRole==='owner') q=q.in('status',['online','active','maintenance']);
        else { q=q.or(`created_by.eq.${req.session.userId},and(visibility.in.(public,all)${req.session.userRole==='premium'?',visibility.in.(premium-only)':''})`).in('status',['online','active']); }
        const { data:c } = await q.order('name'); if(!c?.length) { const d=[{ name:'GPT-4 Assistant', avatar_url:'🤖', description:'Asisten AI', system_prompt:'Kamu asisten AI.', model_name:'gpt-4', status:'online', visibility:'all', gender:'female' },{ name:'Creative Writer', avatar_url:'✍️', description:'Penulis kreatif', system_prompt:'Kamu penulis kreatif.', model_name:'gpt-4', status:'online', visibility:'all', gender:'female' }]; const { data:i } = await supabase.from('characters').insert(d).select(); return res.json({ characters:i }); }
        res.json({ characters:c });
    } catch(e) { res.status(500).json({ error:'Failed' }); }
});

// ============ USER AI CHARACTERS ============
app.get('/api/user/characters', requireAuth, async (req, res) => { try { const { data, error } = await supabase.from('characters').select('*, ai_packages(name,is_premium,model_name)').eq('created_by',req.session.userId).order('created_at',{ascending:false}); if(error) throw error; res.json({ characters:data||[] }); } catch(e) { res.status(500).json({ error:'Failed' }); } });

app.post('/api/user/characters', requireAuth, async (req, res) => {
    try { const { name, avatar_url, description, system_prompt, package_id, gender } = req.body; if(!name||!system_prompt) return res.status(400).json({ error:'Name and prompt required' });
        const { data:u } = await supabase.from('users').select('role,max_ai_characters').eq('id',req.session.userId).single(); const { count } = await supabase.from('characters').select('*',{count:'exact',head:true}).eq('created_by',req.session.userId);
        const mx = u.max_ai_characters||5; if(count>=mx) return res.status(400).json({ error:`Max ${mx} AI.` });
        let mn='gpt-4', eu=''; if(package_id){ const { data:p } = await supabase.from('ai_packages').select('*').eq('id',package_id).single(); if(!p) return res.status(400).json({ error:'Package not found' }); if(p.is_premium&&req.session.userRole==='user') return res.status(403).json({ error:'Premium package only!' }); mn=p.model_name||'gpt-4'; eu=p.url||''; }
        const { data, error } = await supabase.from('characters').insert({ name, avatar_url:avatar_url||'🤖', description:description||'', system_prompt, package_id:package_id||null, model_name:mn, endpoint_url:eu, gender:gender||'female', status:'online', visibility:'private', created_by:req.session.userId }).select().single(); if(error) throw error;
        await supabase.from('logs').insert({ user_id:req.session.userId, action:'user_created_character', details:{character_name:name}, ip_address:req.ip });
        res.json({ character:data });
    } catch(e) { res.status(500).json({ error:e.message||'Failed' }); }
});

app.put('/api/user/characters/:id', requireAuth, async (req, res) => { try { const { data:ex } = await supabase.from('characters').select('created_by').eq('id',req.params.id).single(); if(!ex) return res.status(404).json({ error:'Not found' }); if(ex.created_by!==req.session.userId&&req.session.userRole!=='owner') return res.status(403).json({ error:'Not yours' });
    const { name, avatar_url, description, system_prompt, package_id, model_name, gender } = req.body; if(package_id&&req.session.userRole==='user'){ const { data:p } = await supabase.from('ai_packages').select('is_premium').eq('id',package_id).single(); if(p?.is_premium) return res.status(403).json({ error:'Premium only' }); }
    const up={}; if(name!==undefined) up.name=name; if(avatar_url!==undefined) up.avatar_url=avatar_url; if(description!==undefined) up.description=description; if(system_prompt!==undefined) up.system_prompt=system_prompt; if(package_id!==undefined) up.package_id=package_id; if(model_name!==undefined) up.model_name=model_name; if(gender!==undefined) up.gender=gender;
    await supabase.from('characters').update(up).eq('id',req.params.id); res.json({ success:true });
} catch(e) { res.status(500).json({ error:e.message }); } });

app.delete('/api/user/characters/:id', requireAuth, async (req, res) => { try { const { data:ex } = await supabase.from('characters').select('created_by').eq('id',req.params.id).single(); if(!ex) return res.status(404).json({ error:'Not found' }); if(ex.created_by!==req.session.userId&&req.session.userRole!=='owner') return res.status(403).json({ error:'Not yours' });
    const { data:ch } = await supabase.from('chats').select('id').eq('character_id',req.params.id); if(ch){ for(const c of ch){ await supabase.from('messages').delete().eq('chat_id',c.id); } await supabase.from('chats').delete().eq('character_id',req.params.id); }
    await supabase.from('characters').delete().eq('id',req.params.id); res.json({ success:true });
} catch(e) { res.status(500).json({ error:e.message }); } });

app.get('/api/user/packages', requireAuth, async (req, res) => { try { let q=supabase.from('ai_packages').select('*').order('name'); if(req.session.userRole==='user') q=q.eq('is_premium',false); const { data } = await q; res.json({ packages:data||[] }); } catch(e) { res.status(500).json({ error:'Failed' }); } });

// ============ CHAT ROUTES ============
app.get('/api/chats', requireAuth, async (req, res) => { try { const { data:c } = await supabase.from('chats').select('*, characters(name,avatar_url,status)').eq('user_id',req.session.userId).order('updated_at',{ascending:false}); const cl=await Promise.all((c||[]).map(async x=>{ const { data:m }=await supabase.from('messages').select('content,created_at').eq('chat_id',x.id).order('created_at',{ascending:false}).limit(1); return {...x,last_message:m?.[0]||null}; })); res.json({ chats:cl }); } catch(e) { res.status(500).json({ error:'Failed' }); } });
app.post('/api/chats', requireAuth, async (req, res) => { try { const { character_id }=req.body; const { data:c }=await supabase.from('chats').insert({ user_id:req.session.userId, character_id, title:'New Chat', mood:'neutral', relationship_level:0 }).select().single(); res.json({ chat:c }); } catch(e) { res.status(500).json({ error:'Failed' }); } });
app.get('/api/chats/:chatId/messages', requireAuth, async (req, res) => { try { const { data:m }=await supabase.from('messages').select('*').eq('chat_id',req.params.chatId).order('created_at',{ascending:true}); res.json({ messages:m }); } catch(e) { res.status(500).json({ error:'Failed' }); } });
app.delete('/api/chats/:chatId', requireAuth, async (req, res) => { try { await supabase.from('messages').delete().eq('chat_id',req.params.chatId); await supabase.from('chats').delete().eq('id',req.params.chatId).eq('user_id',req.session.userId); res.json({ message:'Deleted' }); } catch(e) { res.status(500).json({ error:'Failed' }); } });
app.delete('/api/chats/:id/history', requireAuth, async (req, res) => { await supabase.from('messages').delete().eq('chat_id',req.params.id); await supabase.from('chats').update({ relationship_level:0, updated_at:new Date() }).eq('id',req.params.id).eq('user_id',req.session.userId); res.json({ success:true }); });

app.post('/api/chats/:chatId/messages', requireAuth, async (req, res) => {
    try { const { content }=req.body; const chatId=req.params.chatId; if(!content?.trim()) return res.status(400).json({ error:'Empty' });
        const today=new Date().toISOString().split('T')[0]; const { data:u }=await supabase.from('users').select('*').eq('id',req.session.userId).single(); const limit=getLimit(u.role); let cc=u.daily_message_count;
        if(u.last_message_date!==today){ await supabase.from('users').update({ daily_message_count:0, last_message_date:today }).eq('id',req.session.userId); cc=0; } if(cc>=limit) return res.status(429).json({ error:'Daily limit', limit, current:cc });
        const { data:chat }=await supabase.from('chats').select('*, characters(*)').eq('id',chatId).eq('user_id',req.session.userId).single(); if(!chat) return res.status(404).json({ error:'Not found' });
        await supabase.from('messages').insert({ chat_id:chatId, user_id:req.session.userId, role:'user', content }).select().single();
        await supabase.from('users').update({ daily_message_count:cc+1, last_message_date:today }).eq('id',req.session.userId);
        const { data:history }=await supabase.from('messages').select('role,content').eq('chat_id',chatId).order('created_at',{ascending:false}).limit(11); const ctx=(history||[]).reverse().slice(0,-1);
        const cg=chat.characters.gender||'female'; const ug=u.gender||req.session.userGender||'male';
        const mp=buildMoodPrompt(chat.mood||'neutral',chat.relationship_level||0,chat.characters.name,req.session.username,cg,ug,u.role);
        const sp=`${chat.characters.system_prompt||'You are helpful.'}\n\n${mp}\n\nCharacter: ${chat.characters.name}\nUser: ${req.session.username}`;
        const { response:aiText, source }=await callAI(sp,ctx,content,chat.characters.endpoint_url,chat.characters.package_id,chat.characters.model_name);
        const { data:aiMsg }=await supabase.from('messages').insert({ chat_id:chatId, user_id:req.session.userId, role:'assistant', content:aiText }).select().single();
        const nr=Math.min(100,(chat.relationship_level||0)+1); await supabase.from('chats').update({ relationship_level:nr, updated_at:new Date() }).eq('id',chatId);
        const { count:mc }=await supabase.from('messages').select('*',{count:'exact',head:true}).eq('chat_id',chatId);
        if(mc<=2){ const t=content.substring(0,50); await supabase.from('chats').update({ title:t }).eq('id',chatId); }
        res.json({ userMessage:{role:'user',content}, aiMessage:aiMsg, aiSource:source, relationshipLevel:nr, remaining:Math.max(0,limit-(cc+1)) });
    } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/chats/:chatId/mood', requireAuth, async (req, res) => { try { const { mood }=req.body; const vm=['happy','neutral','annoyed','clingy','sleepy','caring','adult']; if(!vm.includes(mood)) return res.status(400).json({ error:'Invalid' }); if(mood==='adult'&&req.session.userRole!=='premium'&&req.session.userRole!=='owner') return res.status(403).json({ error:'Premium/Owner only' }); await supabase.from('chats').update({ mood }).eq('id',req.params.chatId).eq('user_id',req.session.userId); res.json({ success:true }); } catch(e) { res.status(500).json({ error:'Failed' }); } });
app.get('/api/user/stats', requireAuth, async (req, res) => { try { const today=new Date().toISOString().split('T')[0]; const { data:u }=await supabase.from('users').select('daily_message_count,last_message_date,role').eq('id',req.session.userId).single(); const l=getLimit(u.role); const used=u.last_message_date===today?u.daily_message_count:0; res.json({ role:u.role, dailyLimit:l, used, remaining:Math.max(0,l-used) }); } catch(e) { res.status(500).json({ error:'Failed' }); } });

// ============ OWNER ROUTES ============
app.get('/api/owner/stats', requireRole('owner'), async (req, res) => { const [u,c,m,ch]=await Promise.all([supabase.from('users').select('*',{count:'exact',head:true}),supabase.from('chats').select('*',{count:'exact',head:true}),supabase.from('messages').select('*',{count:'exact',head:true}),supabase.from('characters').select('*',{count:'exact',head:true})]); res.json({ users:u.count||0, chats:c.count||0, messages:m.count||0, characters:ch.count||0 }); });
app.get('/api/owner/users', requireRole('owner'), async (req, res) => { const { data }=await supabase.from('users').select('*').order('created_at',{ascending:false}); res.json({ users:(data||[]).map(({password_hash,...u})=>u) }); });
app.put('/api/owner/users/:userId', requireRole('owner'), async (req, res) => { const up={}; ['role','premium_expired_at','is_banned','daily_message_count','last_message_date','gender','verified','max_ai_characters'].forEach(k=>{ if(req.body[k]!==undefined) up[k]=req.body[k]; }); await supabase.from('users').update(up).eq('id',req.params.userId); res.json({ success:true }); });
app.delete('/api/owner/users/:userId', requireRole('owner'), async (req, res) => { try { if(req.params.userId===req.session.userId) return res.status(400).json({ error:'Cannot delete yourself' }); await supabase.from('email_verifications').delete().eq('user_id',req.params.userId); await supabase.from('messages').delete().eq('user_id',req.params.userId); await supabase.from('chats').delete().eq('user_id',req.params.userId); await supabase.from('characters').delete().eq('created_by',req.params.userId); await supabase.from('logs').delete().eq('user_id',req.params.userId); await supabase.from('users').delete().eq('id',req.params.userId); res.json({ success:true }); } catch(e) { res.status(500).json({ error:e.message }); } });
app.get('/api/owner/characters', requireRole('owner'), async (req, res) => { const { data }=await supabase.from('characters').select('*, ai_packages(name,is_premium)').order('created_at',{ascending:false}); if(data){ const ids=[...new Set(data.filter(c=>c.created_by).map(c=>c.created_by))]; if(ids.length){ const { data:users }=await supabase.from('users').select('id,username').in('id',ids); const um={}; if(users) users.forEach(u=>{um[u.id]=u.username;}); data.forEach(c=>{c.creator_username=c.created_by?(um[c.created_by]||null):null;}); } } res.json({ characters:data||[] }); });
app.post('/api/owner/characters', requireRole('owner'), async (req, res) => { const { data }=await supabase.from('characters').insert({...req.body,created_by:req.session.userId}).select().single(); res.json({ character:data }); });
app.put('/api/owner/characters/:charId', requireRole('owner'), async (req, res) => { await supabase.from('characters').update(req.body).eq('id',req.params.charId); res.json({ success:true }); });
app.delete('/api/owner/characters/:charId', requireRole('owner'), async (req, res) => { const { data:ch }=await supabase.from('chats').select('id').eq('character_id',req.params.charId); if(ch){ for(const c of ch){ await supabase.from('messages').delete().eq('chat_id',c.id); } await supabase.from('chats').delete().eq('character_id',req.params.charId); } await supabase.from('characters').delete().eq('id',req.params.charId); res.json({ success:true }); });
app.get('/api/owner/packages', requireRole('owner'), async (req, res) => { const { data }=await supabase.from('ai_packages').select('*').order('name'); res.json({ packages:data||[] }); });
app.post('/api/owner/packages', requireRole('owner'), async (req, res) => { const { data }=await supabase.from('ai_packages').insert(req.body).select().single(); res.json({ package:data }); });
app.put('/api/owner/packages/:id', requireRole('owner'), async (req, res) => { await supabase.from('ai_packages').update(req.body).eq('id',req.params.id); res.json({ success:true }); });
app.delete('/api/owner/packages/:id', requireRole('owner'), async (req, res) => { await supabase.from('ai_packages').delete().eq('id',req.params.id); res.json({ success:true }); });
app.get('/api/owner/logs', requireRole('owner'), async (req, res) => { const { data }=await supabase.from('logs').select('*').order('created_at',{ascending:false}).limit(100); res.json({ logs:data }); });

if(process.env.NODE_ENV!=='production') { app.listen(PORT, '0.0.0.0', () => console.log(`✨ c.ai ready on ${PORT}`)); }
module.exports = app;