```markdown
# 🤖 c.ai By MikuHost

**AI Chat with modern glassmorphism UI** — Premium AI companion experience with multiple characters, mood system, gender detection, relationship building, email verification, user-generated AI, and built-in Spotify music player.

---

## 📸 Preview

![c.ai Banner](https://cdn.aceimg.com/27a9dbe8f.jpg)
![login page] https://cdn.aceimg.com/2e8c94ea9.jpg
![Dashboard page] https://cdn.aceimg.com/e9d0d71ff.jpg
![chat page] https://cdn.aceimg.com/2f7bd0505.jpg
---

## 📁 Project Structure

```
```
project/
├── index.html          # Login/Register page with OTP verification
├── chat.html           # Main chat interface with AI creation & music player
├── owner.html          # Owner dashboard (manage users, AI, packages, settings)
├── qris.html           # QRIS donation page
├── server.js           # Backend Express server
├── package.json        # Node.js dependencies
├── vercel.json         # Vercel deployment config
├── config.json         # Supabase configuration
└── README.md           # This file

```
```
---

## ✨ Features

### AI Chat
- 🤖 **AI Characters** — Multiple AI personalities, system + user-generated
- 👤 **User-Generated AI** — Create, edit, delete your own AI characters (limit: 5 free / 15 premium)
- 🔒 **Visibility Control** — Users can set AI to Private or Public
- 📦 **AI Packages** — Owner creates Free/Premium packages with custom API endpoints & models
- 🎭 **Mood System** — 7 moods: Happy, Neutral, Clingy, Annoyed, Sleepy, Caring, Adult 🔞
- 👫 **Gender Detection** — AI adjusts behavior based on user gender (Male/Female)
- 💕 **Relationship Level** — Progress bar 0-100 based on chat interactions
- 🔞 **Adult Mode** — Premium/Owner only, blocked for same-gender pairs
- 🔄 **Context Memory** — Last 10 messages for conversation continuity
- 🔌 **Dynamic API URLs** — All provider URLs configurable from database (no hardcode)

### Music Player
- 🎵 **Spotify Search** — Built-in search via NexRay API
- ▶️ **Compact Player** — In sidebar, non-intrusive
- 🎨 **Album Art Display** — Thumbnails from Spotify
- 🔍 **Search with Button** — Separate search button, no Enter conflict

### Security
- 📧 **Email OTP Verification** — Secure registration via Resend API
- 🔒 **Session Management** — Auto-redirect on expiry/banned
- 🛡️ **Public Settings Filtered** — API keys never exposed to public endpoints
- 🚫 **Premium Package Lock** — Free users can't use premium packages

### Owner Dashboard
- 📊 **Stats Overview** — Total users, chats, messages, AI characters
- 👥 **User Management** — Ban/unban, premium, verify, delete users, AI limit control
- 🤖 **AI Manager** — Edit/delete all AI characters (system + user-created)
- 📦 **Package Manager** — Create/edit/delete packages with premium toggle, URL, API key, model
- ⚙️ **Settings** — QRIS image, Resend API key, WhatsApp number
- 📝 **Activity Logs** — Track user actions

### UI/UX
- 🎨 **Glassmorphism Design** — Blurred backgrounds, neon purple/pink glow
- 🌙 **Dark Mode** — Immersive anime/cyberpunk aesthetic
- 📱 **Mobile Responsive** — Full mobile support with hamburger menu
- 💬 **Modern Chat Bubbles** — Gradient sent messages, glass received
- ⏳ **Animated Typing Indicator** — Bouncing dots animation
- ❌ **Custom Confirm Modal** — Replaces browser alert/confirm dialogs
- 🎯 **Opacity Controls** — Edit/delete buttons at 70% opacity

---

## 📋 Prerequisites

- **Node.js** v16 or higher
- **Supabase** account (free tier)
- **Resend** account (for email OTP, 100 free emails/day)
- **Vercel** account (for deployment, optional)

---

## 🛠️ Installation

### 1. Clone or download

```bash
git clone https://github.com/miku208/cai-chat.git
cd cai-chat
```

2. Install dependencies

```bash
npm install
```

3. Setup Supabase

Go to supabase.com → Create Project → SQL Editor → Run:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    gender TEXT DEFAULT 'unknown',
    verified BOOLEAN DEFAULT false,
    daily_message_count INTEGER DEFAULT 0,
    last_message_date DATE DEFAULT CURRENT_DATE,
    is_banned BOOLEAN DEFAULT false,
    premium_expired_at TIMESTAMPTZ,
    max_ai_characters INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Characters table
CREATE TABLE IF NOT EXISTS characters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT,
    description TEXT,
    system_prompt TEXT,
    endpoint_url TEXT,
    model_name TEXT DEFAULT 'gpt-4',
    package_id UUID,
    gender TEXT DEFAULT 'female',
    status TEXT DEFAULT 'online',
    visibility TEXT DEFAULT 'private',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Chat',
    mood TEXT DEFAULT 'neutral',
    relationship_level INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Packages table
CREATE TABLE IF NOT EXISTS ai_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    api_key TEXT,
    model_name TEXT DEFAULT 'gpt-4',
    is_premium BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    qris_url TEXT,
    resend_api_key TEXT,
    sender_email TEXT,
    owner_whatsapp TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email verifications
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default data
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO ai_packages (name, url, is_premium) VALUES 
    ('ChatEverywhere (GPT-4)', 'https://chateverywhere.app/api/chat/', false),
    ('Google Gemini Flash', 'gemini', false)
ON CONFLICT DO NOTHING;
```

Copy Project URL & anon public key from Settings → API.

4. Configure config.json

```json
{
  "supabase_url": "https://your-project-id.supabase.co",
  "supabase_anon_key": "eyJhbGciOiJIUzI1NiIs...",
  "session_secret": "your-random-secret-string-here"
}
```

5. Run

```bash
npm start
# → http://localhost:3000
```

---

📧 Setup Email OTP (Resend)

1. Go to resend.com → Sign up
2. Domains → Add Email (e.g. yourname@gmail.com) → Verify
3. API Keys → Create → Copy key (re_xxx...)
4. Login as owner → Dashboard tab → Fill:
   · Resend API Key
   · Sender Email
5. For production: Add your domain in Resend → DNS verification → noreply@yourdomain.com

---

👑 Create Owner Account

1. Register at /
2. Supabase Table Editor → users → Change role to owner
3. Login → go to /owner

---

🚀 Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Environment Variables (Vercel Dashboard → Settings):

Key Value
SUPABASE_URL Your Supabase URL
SUPABASE_ANON_KEY Your Supabase anon key
SESSION_SECRET Random secret string

vercel.json:

```json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "server.js" }]
}
```

---

🔧 Adding AI Providers

Owner Dashboard → Packages → + Add Package

Field Description Example
Name Display name Ryuu Gemini
URL API endpoint (editable anytime) https://api.ryuu-dev.my.id/ai/gemini/chat
API Key Provider API key ryuu-apis-xxx
Model Default model gemini-2.5-flash
Premium Toggle (free users blocked) ✅/❌

Available Providers

Provider URL Value Free
ChatEverywhere (GPT-4) https://chateverywhere.app/api/chat/ ✅
Google Gemini gemini Need key
Neosantara neosantara or full URL Need key
Ryuu API https://api.ryuu-dev.my.id/ai/gemini/chat Need key
Custom URL Full endpoint URL —

Note: All provider URLs are now dynamic — change them anytime from Owner Dashboard without editing server.js.

---

👤 User AI Creation

Feature Free Premium Owner
Max AI Created 5 15 ∞
Visibility Control ✅ ✅ ✅
Use Free Packages ✅ ✅ ✅
Use Premium Packages ❌ ✅ ✅
Adult Mode ❌ ✅ ✅
Daily Messages 30 180 ∞

---

🎵 Music Player Setup

Music search uses NexRay Spotify API via proxy endpoint:

· Search: /api/music/search?q=...
· Stream: /api/music/stream?url=...
· Default playlist: /api/music

No additional API keys needed — works out of the box.

---

📊 Tech Stack

Layer Technology
Frontend HTML, CSS, Vanilla JS
Backend Node.js, Express
Database Supabase (PostgreSQL)
Auth Express-session + OTP
Email Resend API
AI ChatEverywhere, Gemini, Neosantara, Ryuu, Custom
Music NexRay Spotify API
Deploy Vercel

---

📝 License

MIT — Free for personal & commercial use.

---

💖 Support

This project is free. Help keep servers running via QRIS at /qris.

---

by MikuHost 🎀

