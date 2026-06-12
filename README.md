# 🌸 Cyra — AI-Powered Period Tracker

> Your cycle, your way.

A full-stack AI-powered period tracking web app built in 8 days as a structured learning challenge. Cyra combines React, Supabase, Google Gemini AI, and EmailJS into a production-ready application with CI/CD deployment on Vercel.

🔗 **Live Demo:** [period-tracker-wheat.vercel.app](https://period-tracker-wheat.vercel.app)

---

## ✨ Features

### Core Tracking
- 📅 **Calendar View** — log period days with start/end range selection
- 🔮 **Cycle Prediction** — predicts next period and fertile window based on logged history
- 🌿 **Fertile Window** — highlights estimated ovulation days on calendar
- 💯 **Health Score** — dynamic 0–100 score based on logging consistency, mood patterns, and cycle regularity

### Logging & Insights
- 😊 **Mood Logging** — log daily mood with emoji indicators on calendar
- 💊 **Symptom Tracking** — log 8 common symptoms per day with frequency charts
- 🌊 **Flow Intensity** — track Light / Medium / Heavy flow per period day
- 📝 **Daily Notes** — add free-text notes to any calendar date
- 🔍 **Pattern Detection** — auto-detects mood trends, symptom patterns, and cycle length changes

### AI & Communication
- 🤖 **AI Assistant** — Gemini 2.5 Flash powered chat for cycle and health questions
- 📧 **Period Alert Emails** — email notification 1 day before predicted period via Supabase Edge Functions
- 🔐 **OTP Sign Up** — passwordless account creation via 6-digit email OTP (EmailJS)

### Auth & Security
- 🔑 **Email/Password Auth** — full sign in / sign up via Supabase Auth
- 🔒 **Forgot Password** — password reset via Supabase email
- ✨ **OTP Sign Up** — no-password account creation with 6-digit email code
- 🛡️ **Row Level Security** — Supabase RLS ensures users only access their own data

### UI & UX
- 🌙 **Dark / Light Mode** — theme toggle with localStorage persistence
- 💾 **Cloud Sync** — all data saved to Supabase and synced across devices
- 📤 **CSV Export** — download all tracked data as a spreadsheet
- 📱 **Mobile-First Design** — responsive layout optimized for phone screens

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Recharts | Cycle length, duration, and flow charts |
| CSS-in-JS | Inline + injected styles, no external CSS library |
| Google Fonts (DM Sans + DM Serif Display) | Typography |

### Backend & Services
| Technology | Purpose |
|---|---|
| Supabase Auth | Email/password login, password reset, session management |
| Supabase PostgreSQL | Cloud database with Row Level Security |
| Supabase Edge Functions | Period alert email trigger (Deno runtime) |
| Google Gemini 2.5 Flash API | AI assistant for cycle and health questions |
| EmailJS | Sending 6-digit OTP codes for passwordless sign up |

### DevOps
| Technology | Purpose |
|---|---|
| GitHub Actions | CI/CD pipeline — runs tests and deploys on every push |
| Vercel | Production hosting with automatic preview deployments |
| React Testing Library + Jest | Unit and integration tests |

---

## 🗄️ Database Schema

```sql
CREATE TABLE cyra_data (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id),
  periods    JSONB DEFAULT '[]',
  notes      JSONB DEFAULT '{}',
  moods      JSONB DEFAULT '{}',
  flows      JSONB DEFAULT '{}',
  symptoms   JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cyra_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON cyra_data
  FOR ALL USING (auth.uid() = user_id);
```

---

## 🏗️ Project Structure

```
period-tracker/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions CI/CD pipeline
├── public/
│   └── index.html
├── src/
│   ├── App.js                 # Main app — all components
│   ├── App.test.js            # Jest + React Testing Library tests
│   ├── supabase.js            # Supabase client configuration
│   ├── index.js               # React entry point
│   └── index.css              # Global styles
├── .env                       # Environment variables (gitignored)
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/Janvi99852003/period-tracker.git
cd period-tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root:

```env
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL schema above in the SQL Editor
3. Enable Email provider in Authentication → Sign In / Providers
4. Update `src/supabase.js` with your project URL and anon key

### 5. Set up EmailJS

1. Create account at [emailjs.com](https://emailjs.com)
2. Connect Gmail as an email service
3. Create a template with `{{otp_code}}` variable
4. Update the constants at the top of `src/App.js`

### 6. Run locally

```bash
npm start
```

### 7. Run tests

```bash
npm test -- --watchAll=false
```

---

## 🔄 CI/CD Pipeline

Every push to `main` triggers:

```
Push to main → Test & Build → Deploy to Vercel
```

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `REACT_APP_GEMINI_API_KEY` | Google Gemini API key |

---

## 🧪 Tests

10 tests covering renders, auth screens, OTP flow, and Gemini mock:

```bash
npm test -- --watchAll=false
```

---

## 🗓 Built In 8 Days

| Day | Feature |
|---|---|
| Day 1 | React setup, calendar UI, period logging |
| Day 2 | Mood & symptom logging, daily notes, flow intensity |
| Day 3 | Cycle predictions, fertile window, health score |
| Day 4 | Recharts visualizations, CSV export, pattern detection |
| Day 5 | Splash screen, dark/light theme, README |
| Day 6 | Supabase auth + cloud database, Row Level Security |
| Day 7 | Gemini AI assistant, EmailJS OTP, period alert emails |
| Day 8 | Vercel deployment, GitHub Actions CI/CD, production polish |

---

## 👩‍💻 Author

**Janvi Jaiswal**
- 📧 janvi.23bce10174@vitbhopal.ac.in
- 🎓 B.Tech CSE, VIT Bhopal University
- 💼 [GitHub](https://github.com/Janvi99852003)

---

## 📄 License

MIT — free to use and modify.