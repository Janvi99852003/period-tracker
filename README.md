# 🌸 Cyra — Period Tracker

> Your cycle, your way.

A full-stack AI-powered period tracking web app built with React, Supabase, Gemini AI, and EmailJS.

🔗 **Live Demo:** [cyra-app.vercel.app](https://cyra-app.vercel.app)

---

## ✨ Features

- 📅 **Calendar view** — log and visualize period days, predicted days, and fertile window
- 🤖 **AI Assistant** — ask health questions powered by Google Gemini 2.5 Flash
- 📊 **Charts & Analytics** — cycle length trends, period duration, flow intensity
- 🔍 **Pattern Detection** — automatically detects mood, symptom, and cycle trends
- 💯 **Health Score** — dynamic score based on logging consistency, mood, and regularity
- 🔐 **Auth** — email/password login + OTP sign-up via EmailJS (no password needed)
- 🔑 **Forgot Password** — password reset via Supabase email
- 📧 **Period Alerts** — email notifications 1 day before predicted period
- 🌙 **Dark / Light mode** — theme toggle with localStorage persistence
- 📤 **CSV Export** — download all tracked data
- ☁️ **Cloud sync** — data stored in Supabase Firestore per user

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Recharts |
| Auth + DB | Supabase (Auth + Firestore) |
| AI | Google Gemini 2.5 Flash API |
| Email OTP | EmailJS |
| Styling | CSS-in-JS (inline + injected styles) |
| CI/CD | GitHub Actions |
| Hosting | Vercel |

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/cyra-app.git
cd cyra-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root:

```env
REACT_APP_GEMINI_API_KEY=your_gemini_api_key
```

### 4. Set up Supabase

- Create a project at [supabase.com](https://supabase.com)
- Run this SQL in the SQL editor:

```sql
CREATE TABLE cyra_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  periods JSONB DEFAULT '[]',
  notes JSONB DEFAULT '{}',
  moods JSONB DEFAULT '{}',
  flows JSONB DEFAULT '{}',
  symptoms JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cyra_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON cyra_data
  FOR ALL USING (auth.uid() = user_id);
```

- Update `src/supabase.js` with your project URL and anon key

### 5. Run locally

```bash
npm start
```

### 6. Run tests

```bash
npm test -- --watchAll=false
```

---

## 📦 Deployment

This project uses **GitHub Actions** for CI/CD and deploys automatically to **Vercel** on every push to `main`.

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Your Vercel API token |
| `VERCEL_ORG_ID` | Your Vercel org ID |
| `VERCEL_PROJECT_ID` | Your Vercel project ID |
| `REACT_APP_GEMINI_API_KEY` | Google Gemini API key |

---

## 📁 Project Structure

```
src/
├── App.js          # Main app + all components
├── App.test.js     # Jest + React Testing Library tests
├── supabase.js     # Supabase client config
└── index.js        # React entry point
```

---

## 🗓 Built In 8 Days

| Day | Feature |
|---|---|
| Day 1 | React setup, calendar UI, period logging |
| Day 2 | Mood & symptom logging, notes modal |
| Day 3 | Predictions, fertile window, health score |
| Day 4 | Charts (Recharts), CSV export |
| Day 5 | Pattern detection, splash screen, README |
| Day 6 | Supabase auth + cloud database |
| Day 7 | Gemini AI assistant, EmailJS OTP |
| Day 8 | CI/CD pipeline, Vercel deployment, polish |

---

## 📄 License

MIT — free to use and modify.

---

Built by [Janvi Jaiswal](https://github.com/Janvi99852003) · VIT Bhopal