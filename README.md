# 💸 SpendSync

A fun, interactive budget tracker that runs **entirely in your browser** and stores all data in your device's **localStorage** — no server, no accounts, nothing to restart, and nothing ever disappears. Host it free on GitHub Pages and add it to your iPhone home screen like an app.

## ✨ Features

- **Dashboard** — monthly budget you can change any time, with live usage ring
- **Daily / weekly / monthly tracking** — spend vs allowance for each period
- **Charts** — category doughnut chart + daily trend bar chart (Chart.js)
- **Add / edit / delete expenses** — name, amount (RM), 15 categories, notes, and any date (past or future)
- **Category breakdown** with animated bars
- **Saving pots 🏺** — savings goals with progress bars; add, fund, edit, delete
- **Monthly summary** — stats per month + download as **CSV** or a formatted **report**
- **Fun & interactive** — confetti bursts, sound effects (toggleable), live clock, glassmorphism UI, Unsplash background
- **No backend** — data is saved in your browser's localStorage, so it stays on your device forever

## 🗂 How storage works

Everything is saved under one localStorage key (`spendsync_data_v2`) on the device you use. That means:

- Your data **persists** across reloads, restarts, and redeploys.
- Data is **per device/browser** — there is no cross-device sync (that's the trade-off for never losing data).
- Clearing the site's data in your browser settings **erases your budget** — so use the Summary tab to download backups.

## 🚀 Run locally

No install needed — just open `index.html` in a browser. Or serve the folder:

```bash
npx serve .
```

## 🌍 Host free on GitHub Pages (never sleeps, never loses data)

1. Push this folder to a GitHub repo (this repo is already set up: `.nojekyll` + files at the root).
2. Go to the repo **Settings → Pages**.
3. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. Your app is live at `https://<username>.github.io/<repo>/` after ~1 min.

Because there's no server, there's nothing to wake up, restart, or pay for — and your data never gets wiped.

## 📱 Add to your iPhone home screen

1. Open the app in **Safari** (Chrome won't let you add to home screen).
2. Tap the **Share** button → **Add to Home Screen**.
3. Name it *SpendSync* → **Add**.
4. It opens full-screen like an app, and the icon stays on your home screen.

> Keep in mind: data is stored in the browser, so use the same browser/device for the same budget. On the iPhone shortcut, that's Safari — it persists there.

## 🧾 Downloading backups

Go to the **Summary** tab, pick a month, then tap:
- **CSV** — raw data for Excel/Sheets
- **Report** — a formatted text summary with stats + transactions

## 🛠 Tech

- Vanilla HTML/CSS/JS (no frameworks, no build step)
- Chart.js + canvas-confetti (CDN)
- Google Fonts + Unsplash background image
- localStorage for persistence