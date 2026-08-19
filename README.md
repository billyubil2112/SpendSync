# 💸 SpendSync

A fun, interactive budget tracker for the web — track spending, visualise it with charts, chase saving goals, and download monthly reports. Built to live on a free host so all your devices stay in sync (great as an iPhone Home Screen shortcut).

## ✨ Features

- **Dashboard** — monthly budget you can change any time, with live usage ring
- **Daily / weekly / monthly tracking** — spend vs allowance for each period
- **Charts** — category doughnut chart + daily trend bar chart (Chart.js)
- **Add / edit / delete expenses** — name, amount (RM), 15 categories, notes, and any date (past or future)
- **Category breakdown** with animated bars
- **Saving pots 🏺** — savings goals with progress bars; add, fund, edit, delete
- **Monthly summary** — stats per month + download as **CSV** or a formatted **report**
- **Fun & interactive** — confetti bursts, sound effects (toggleable), live clock, glassmorphism UI, Unsplash background
- **Autosync** — all data lives on the server, so every device sees the same numbers

## 🚀 Run locally

```bash
npm install
npm start
```

Open http://localhost:3000

Data is stored in `data.json` (created automatically).

## ☁️ Deploy online (free, with autosync)

### Option A — Render (easiest)

1. Push this folder to a GitHub repo.
2. Go to [render.com](https://render.com) → **New** → **Web Service**.
3. Connect your repo. Render auto-detects Node.
   - Build command: `npm install`
   - Start command: `npm start`
   - Plan: Free
4. Deploy, then open the `https://your-app.onrender.com` link. Done!

> ⚠️ Free plans sleep after ~15 min idle and take ~30–60s to wake on first load. The app shows a "waking up" screen with a Retry button, so just wait a moment.

### Option B — Railway

Same steps: new project → deploy from GitHub → Node app. Railway doesn't sleep on free tier.

## 📱 Add to your iPhone home screen

1. Open the app in **Safari** (Chrome won't let you add to home screen).
2. Tap the **Share** button → **Add to Home Screen**.
3. Name it *SpendSync* → **Add**.
4. It now opens full-screen like an app with no browser chrome. 💯

## 🧾 Downloading summaries

Go to the **Summary** tab, pick a month with the arrows, then tap:
- **CSV** — raw data for Excel/Sheets
- **Report** — a formatted text summary with stats + transactions

## 🛠 Tech

- Node.js + Express (backend + JSON file storage)
- Vanilla HTML/CSS/JS frontend
- Chart.js + canvas-confetti (CDN)
- Google Fonts + Unsplash background image

## 🔒 Note

There is no login/PIN. Anyone with your app URL can see the data, so keep the link private (or add a PIN later).