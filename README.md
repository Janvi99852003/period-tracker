# 🌸 Cyra — Period & Cycle Tracker

> **Your cycle, your way.** A smart, private period tracking app built with React.

[![CI/CD](https://github.com/YOUR_USERNAME/period-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/period-tracker/actions)
[![Live Demo](https://img.shields.io/badge/demo-live-ec4899)](https://YOUR_APP.vercel.app)

---

## 🔗 Live Demo
**[cyra.vercel.app](https://YOUR_APP.vercel.app)** — try it in your browser, no account needed.

---

## ✨ Features

### 📅 Period Tracking
- Two-click period logging on an interactive calendar
- Visual period, prediction, and fertile window markers
- Navigate across months with smooth calendar navigation

### 🔮 Cycle Prediction Algorithm
- Averages gaps between past cycles to predict the next period
- Calculates ovulation and fertile window automatically
- Shows a live countdown: *"Next period in 12 days"*

### 💯 Health Score Engine
- Scores your cycle health 0–100 across 4 factors: logging consistency, cycle regularity, mood pattern, and symptom load
- Animated SVG ring with colour coding (green / yellow / red)
- Personalised tip based on what's dragging your score down

### 🔍 Pattern Detection
- Automatically detects trends like *"Your cycle is getting shorter"*
- Finds recurring symptoms on specific cycle days (*"Cramps often on Day 2"*)
- Detects pre-period mood patterns (*"You tend to feel Irritable before your period"*)
- Identifies heaviest flow days and consistent period durations

### 😊 Daily Health Log
- Mood tracker with 5 emoji moods
- 8 symptom tags (Cramps, Bloating, Headache, Fatigue, and more)
- Flow intensity: Light / Medium / Heavy
- Personal notes on any date

### 📊 Data Visualisation
- Cycle length line chart over time (Recharts)
- Period duration bar chart
- Flow intensity distribution chart
- Symptom frequency bar chart with ranking

### 🔒 Privacy & Security
- 4-digit PIN lock screen with numeric keypad
- All data stored locally — never leaves the device
- One-click data export as CSV
- Clear all data option

### 🔔 Smart Reminders
- Period due soon banner (3 days before)
- Fertile window alert
- Logging reminder if inactive for 3+ days

### ⚙️ Settings
- Dark / Light mode toggle (persisted across sessions)
- PIN management (set, change, remove)
- CSV data export
- Clear all data

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (hooks only, no class components) |
| Charts | Recharts |
| Styling | CSS-in-JS (inline `<style>` with theme tokens) |
| Storage | localStorage (client-side persistence) |
| Icons | Lucide React |
| Testing | Jest + React Testing Library |
| CI/CD | GitHub Actions |
| Hosting | Vercel (auto-deploy on push to main) |

---

## 🏗 Architecture Decisions

**Why localStorage over a backend?**
For a period tracker, keeping sensitive health data on the user's device by default is a deliberate privacy choice. A Firebase backend is planned for Day 6 to support multi-device sync for users who opt in.

**Why a custom prediction algorithm over a library?**
The weighted-average cycle prediction is simple enough to implement cleanly in ~15 lines and is fully explainable. Third-party health libraries add dependency risk without meaningful accuracy gains for this use case.

**Why Recharts over D3?**
Recharts provides declarative, React-idiomatic chart components that integrate cleanly with React state. D3 would require imperative DOM manipulation that fights against React's rendering model.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/period-tracker.git
cd period-tracker
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Tests

```bash
npm test -- --watchAll=false
```

### Building for Production

```bash
npm run build
```

---

## ⚙️ CI/CD Pipeline

Every push to `main` triggers a GitHub Actions workflow:

```
Push to main
    │
    ▼
[Test & Build]
  • npm install
  • npm test
  • npm run build
    │
    ▼ (only if tests pass)
[Deploy]
  • Auto-deploy to Vercel
  • Live URL updates in ~60 seconds
```

Pull requests run tests only — never deploy to production.

---

## 📁 Project Structure

```
period-tracker/
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions pipeline
├── src/
│   ├── App.js              # Main app (single-file architecture)
│   ├── App.test.js         # Jest + RTL tests
│   └── index.js            # React entry point
├── public/
│   └── index.html          # HTML shell
└── package.json
```

---

## 🗺 Roadmap

- [x] Calendar UI with period logging
- [x] Cycle prediction algorithm
- [x] Symptoms, mood, and flow tracking
- [x] Recharts data visualisation
- [x] Health Score engine
- [x] Pattern detection
- [x] PIN lock and privacy controls
- [x] Dark / light mode
- [x] CSV export
- [x] CI/CD pipeline
- [ ] Firebase authentication
- [ ] Firestore cloud sync
- [ ] Gemini AI health assistant
- [ ] Push notifications

---

## 👩‍💻 Author

Built by **[JANVI JAISWAL]** · [LinkedIn](https://www.linkedin.com/in/janvi-jaiswal-72415b307/) · [GitHub](https://github.com/Janvi99852003)

---

<p align="center">Made with 🌸 and React</p>