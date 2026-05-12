```markdown
# 🤖 c.ai By MikuHost

**AI Chat with WhatsApp-style interface** — Modern AI chat application with multiple AI characters, mood system, gender detection, relationship building, email verification, and user-generated AI characters.

---

## 📁 Project Structure

```

project/
├── index.html          # Login/Register page with OTP verification
├── chat.html           # Main chat interface (with user AI creation)
├── owner.html          # Owner dashboard (manage users, AI, packages, settings)
├── qris.html           # QRIS donation page
├── server.js           # Backend Express server
├── package.json        # Node.js dependencies
├── vercel.json         # Vercel deployment config
├── config.json         # Supabase configuration
└── README.md           # This file

```

---

## 🚀 Features

- 🤖 **AI Characters** — Multiple AI personalities with custom prompts
- 👤 **User-Generated AI** — Users can create, edit, and delete their own AI characters
- 📦 **AI Packages** — Owner can create packages (Free/Premium) with custom API endpoints & models
- 🎭 **Mood System** — 7 moods: Happy, Neutral, Clingy, Annoyed, Sleepy, Caring, Adult
- 👫 **Gender Detection** — AI auto-adjusts behavior based on user gender
- 💕 **Relationship Level** — Build relationship 0-100 with AI
- 🔞 **Adult Mode** — Premium/Owner only, same-gender blocked
- 📧 **Email OTP Verification** — Secure registration with Resend API
- 👑 **Owner Dashboard** — Manage users, AI characters, packages, settings, view logs
- 🔌 **Multiple AI Providers** — ChatEverywhere (default), Google Gemini, Neosantara, Ryuu API, Custom URL
- 🎨 **Glassmorphism UI** — Modern dark mode design
- 📱 **Mobile Responsive** — Works on all devices
- 🔄 **Context History** — 10 messages history for conversation continuity
- ❤️ **Support QRIS** — Donation support for server costs
- 🔒 **Security** — Public settings filtered (no API keys exposed), owner-only sensitive data

---

## 📋 Prerequisites

- **Node.js** v16 or higher
- **Supabase** account (free tier)
- **Resend** account (for email OTP, free 100 emails/day)
- **Vercel** account (for deployment, optional)

---

## 🛠️ Installation

### 1. Clone or download this project

```bash
git clone https://github.com/miku208/cai.git
cd cai
```

2. Install dependencies

```bash
npm install
```

3. Setup Supabase

1. Go to supabase.com and create a new project
2. Go to SQL Editor and run:

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
    visibility TEXT DEFAULT 'all',
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

-- Email verifications table
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

-- Insert default settings
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Insert default AI packages
INSERT INTO ai_packages (name, url, is_premium) VALUES 
    ('ChatEverywhere (GPT-4)', 'chateverywhere', false),
    ('Google Gemini Flash', 'gemini', false)
ON CONFLICT DO NOTHING;
```

1. Go to Project Settings → API
2. Copy Project URL and anon public key

4. Configure the project

Edit config.json:

```json
{
  "supabase_url": "https://your-project-id.supabase.co",
  "supabase_anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "session_secret": "your-random-secret-string-here"
}
```

5. Run the server

```bash
npm start
```

Server will run at http://localhost:3000

---

📧 Setup Email OTP (Resend)

1. Create Resend Account

1. Go to resend.com
2. Sign up with your email

2. Verify Your Email (for testing)

1. In Resend dashboard, go to Domains
2. Click Add Email under the "Email" section
3. Enter your personal email (e.g., yourname@gmail.com)
4. Check your inbox and click the verification link

3. Get API Key

1. Go to API Keys in Resend dashboard
2. Click Create API Key
3. Copy the key (starts with re_)

4. Enter Settings in Owner Dashboard

1. Login to your app as owner
2. Go to Dashboard tab
3. Fill in:
   · Resend API Key: re_xxx... (your API key)
   · Sender Email: yourname@gmail.com (your verified email)
4. Click Save

5. For Production (send to anyone)

1. In Resend, go to Domains → Add Domain
2. Enter your domain (e.g., yourdomain.com)
3. Follow DNS instructions (add TXT records)
4. After verified, you can send from noreply@yourdomain.com

---

👑 Create Owner Account

1. Register a new user through the app (/)
2. Go to Supabase Table Editor → users
3. Find your user and change role to owner
4. Login again to access owner dashboard at /owner

---

🚀 Deploy to Vercel

1. Install Vercel CLI

```bash
npm i -g vercel
```

2. Deploy

```bash
vercel --prod
```

Follow the prompts:

· Existing project or create new
· Root directory: . (current folder)
· Build command: leave empty
· Output directory: leave empty

3. Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

Key Value
SUPABASE_URL Your Supabase project URL
SUPABASE_ANON_KEY Your Supabase anon key
SESSION_SECRET Random secret string

4. Vercel Config (vercel.json)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "server.js" }
  ]
}
```

---

🔧 Adding New AI Providers

Via Owner Dashboard

1. Go to 📦 Packages
2. Click + Add Package
3. Fill in:
   · Name: Provider name (e.g., Ryuu Gemini)
   · URL: Identifier (ryuu, neosantara, gemini, or full URL)
   · API Key: API key for the provider
   · Model Name: Default model (e.g., gemini-2.5-flash)
   · Premium: Toggle if only premium users can use
4. Click Save

Assign Package to AI Character

1. Go to 🤖 AI Manager
2. Edit or create AI character
3. Select the package from dropdown
4. System prompt + model auto-filled from package

---

👤 User-Generated AI Characters

Limits

Role Max AI Characters
User 5
Premium 15
Owner Unlimited

Package Access

Package Type User Premium Owner
Free ✅ ✅ ✅
Premium ❌ ✅ ✅

How Users Create AI

1. Login → /chat
2. Click + Buat AI in sidebar
3. Fill name, avatar, description, system prompt, gender
4. Select package (auto-fills model)
5. Click Simpan

Users can edit/delete their own AI from 🤖 AI Saya tab.

---

📊 User Roles

Role Daily Limit Adult Mode Visibility Max AI Created
User 50 messages ❌ Public + All 5
Premium 200 messages ✅ Public + All + Premium-only 15
Owner Unlimited ✅ All characters Unlimited

---

🎨 Tech Stack

· Frontend: HTML, CSS, Vanilla JavaScript
· Backend: Node.js, Express
· Database: Supabase (PostgreSQL)
· AI Providers: ChatEverywhere, Google Gemini, Neosantara, Ryuu API, Custom URL
· Email: Resend API
· Deployment: Vercel

---

📝 License

MIT License — Free for personal and commercial use.

---

💖 Support

This project is free forever. If you find it useful, consider supporting via QRIS on the donation page (/qris).

---

by MikuHost

```
