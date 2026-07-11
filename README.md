# HAMRO AFNAI — Smart Study Hub v5.0

> **Fixed Release** — Critical bug patched: Missing `<script>` tag in `user.html` that caused JavaScript to render as plain text, breaking the entire app.

---

## 🚨 CRITICAL FIX IN THIS RELEASE

### Bug: Missing `<script>` Opening Tag in `user.html`

**Severity:** 🔴 Critical — App completely non-functional  
**File:** `user.html`  
**Line:** End of file, before `</body>`

#### What Was Broken
A block of inline JavaScript (swipe gestures, bottom nav helpers, app initialization) was missing its opening `<script>` tag. The browser rendered ~1.8KB of JavaScript code as visible plain text on the page instead of executing it.

#### Impact
| Feature | Status Before Fix |
|---------|------------------|
| Quiz loading (Online Study, Psycho Mode, Local File) | ❌ Completely broken |
| Mobile swipe-to-open sidebar | ❌ Broken |
| Bottom navigation active states | ❌ Broken |
| "More" menu modal | ❌ Broken |
| App initialization (PWA, Auth, Network) | ❌ Broken |
| Admin button injection | ❌ Broken |
| Daily Challenge | ❌ Broken |
| All keyboard shortcuts | ⚠️ Partially broken |

#### The Fix
```html
<!-- BEFORE (BROKEN) -->
<div class="swipe-hint">SWIPE →</div>
/* ── Swipe-to-open sidebar ── */    ← Rendered as text!
let _swipeStart = null;
...
</script>

<!-- AFTER (FIXED) -->
<div class="swipe-hint">SWIPE →</div>
<script>                               ← ✅ Added missing tag
/* ── Swipe-to-open sidebar ── */
let _swipeStart = null;
...
</script>
```

---

## 📁 Project Structure

```
hamro-afnai/
├── index.html          # 🔐 Gateway: Login, Signup, Trial, Payment
├── user.html           # 📚 Study App: Quiz engine, bookmarks, progress
├── admin.html          # 🛡️ Admin Panel: Users, payments, settings
├── app.js              # 🧠 Core application logic (loaded by user.html)
├── chapters-data.js    # 📖 Question bank metadata & Google Drive file IDs
├── sw.js               # ⚙️ Service Worker: Offline caching
├── manifest.json       # 📱 PWA manifest
└── README.md           # 📘 This file
```

---

## 🚀 How to Deploy

### 1. Backend (Google Apps Script)
1. Go to [script.google.com](https://script.google.com)
2. Create new project → paste your `CODE.GS` (backend logic)
3. Set `ADMIN_PASSWORD` to something secure
4. Deploy → New deployment → Web app → Execute as **Me** → Access **Anyone**
5. Copy the `.../exec` URL

### 2. Wire Frontend to Backend
Paste the same URL in **all three** locations:
- `index.html` → `const GAS_URL = "YOUR_URL"`
- `admin.html` → `const GAS_URL = "YOUR_URL"`
- `app.js` → `APP_CONFIG.APPS_URL = "YOUR_URL"`

### 3. Host Static Files
Upload all files to any static host:
- GitHub Pages
- Netlify
- Firebase Hosting
- Vercel
- Or serve locally with `npx serve` (HTTPS/localhost required for PWA)

### 4. First Run
The Apps Script auto-creates `Users`, `Payments`, and `Settings` sheets on first request. No manual sheet setup needed.

---

## ✨ Complete Feature List

### 🔐 Gateway (`index.html`)

| Feature | Description |
|---------|-------------|
| **Unified Login** | Single form routes to Admin OR User dashboard |
| **Signup with Trial** | 24-hour free trial auto-activated on registration |
| **Payment Flow** | QR code scan → TXN ID submission → Admin verification |
| **Session Resume** | Auto-restores login state, handles offline gracefully |
| **Trial Timer** | Live countdown (HH:MM:SS) with auto-expiry |
| **Network Detection** | Shows online/offline status, backend connectivity ping |
| **Admin Shortcut** | Detects admin role → redirects to `admin.html` |

### 📚 Study App (`user.html` + `app.js`)

#### Quiz Modes
| Mode | Description |
|------|-------------|
| **☁️ Online Study** | Stream questions from Google Drive, auto-cache for offline |
| **📂 Local File** | Upload JSON question banks, works 100% offline |
| **⚡ Psycho Mode** | Multi-chapter gauntlet: mix levels, randomize, target weak spots |
| **🌟 Daily Challenge** | 30 random questions every day, streak tracking |
| **🏋 Flashcard** | One question at a time, instant feedback, explanations |
| **📝 Exam Mode** | Timed (90s/q), all questions visible, submit when ready |
| **🔁 Retry Wrong** | Post-quiz: retry only incorrect answers |

#### Quiz Features
| Feature | Description |
|---------|-------------|
| **Question Limit Picker** | When >20 questions, choose 10/20/30/50/All |
| **Shuffle Toggle** | Per-mode shuffle control (questions + options) |
| **Bookmark (⭐)** | Save questions for later review |
| **Flag (🚩)** | Mark questions for follow-up |
| **Wrong Bank (❌)** | Auto-collects all incorrect answers |
| **Search Integration** | Google Search, ChatGPT, Wikipedia, YouTube links per question |
| **Keyboard Shortcuts** | 1-5/A-E to answer, ←→ to navigate, Esc to quit, Ctrl+F to search |
| **Progress Bar** | Visual progress with color-coded tiles (green=correct, red=wrong, yellow=skipped) |
| **Timer** | Flashcard (elapsed time) / Exam (countdown) |
| **Confetti** | Celebration animation on ≥70% score |
| **Explanation Panel** | Shows answer explanation after responding |

#### Dashboard (`view-home`)
| Feature | Description |
|---------|-------------|
| **Dynamic Greeting** | Time-based (🌙 midnight / 🌅 morning / ☀️ afternoon / 🌆 evening) |
| **Live Clock** | Real-time clock + date display |
| **Study Timer** | Tracks today's and total study time |
| **Stats Cards** | Total answered, Correct, Wrong, Accuracy % |
| **Quick Access Tiles** | One-tap to Online, Psycho, Wrong Bank, Bookmarks, Timetable, Progress |
| **Daily Challenge** | Streak tracker with 7-day visual bar |
| **Recent Sessions** | Last 6 quiz sessions with scores |
| **Next Session Widget** | Shows current/next timetable session |
| **Score Prediction** | Predicts exam score based on quiz history (3+ quizzes needed) |

#### Review Pages
| Feature | Description |
|---------|-------------|
| **⭐ Bookmarks** | Saved questions with tag filtering |
| **🚩 Flagged** | Flagged questions with tag filtering |
| **❌ Wrong Bank** | All wrong answers with retry options |
| **Tag System** | Add/remove custom tags on any question |
| **Bulk Actions** | Flash/Exam mode from any list, clear all |

#### Progress (`view-progress`)
| Feature | Description |
|---------|-------------|
| **Overall Stats** | Answered, Correct, Wrong, Accuracy |
| **Chapter Breakdown** | Per-chapter accuracy with progress bars |
| **Weak Topics Alert** | Highlights chapters <60% accuracy |
| **Score Prediction** | ML-style prediction based on historical performance |
| **Data Export** | Download full backup (JSON) |
| **Data Import** | Restore from backup |
| **Clear Cache** | Remove stale question cache |
| **Reset All** | Factory reset (double confirmation) |

#### Timetable (`view-timetable`)
| Feature | Description |
|---------|-------------|
| **Weekly Schedule** | Grid view of all 7 days |
| **Today's Sessions** | List view with "now" highlighting |
| **Add Session** | Name, day, start/end time, recurring weekly |
| **Current/Next Widget** | Shows what's happening now or next |
| **Export/Import** | JSON backup of timetable |
| **Browser Notifications** | Session start alerts (with vibration) |
| **Service Worker Alarms** | Persistent notifications even when app closed |

#### Offline Cache (`view-offline`)
| Feature | Description |
|---------|-------------|
| **Cache All** | Download every question set for offline use |
| **Progress Bar** | Visual download progress |
| **Per-Level Status** | Shows cached vs total per level |
| **Clear Cache** | Remove all cached data |
| **Fix Errors** | Purge stale/error cache entries |
| **Smart Fallback** | Auto-serves cached data when offline |

### 🛡️ Admin Panel (`admin.html`)

| Feature | Description |
|---------|-------------|
| **Independent Login** | Separate `hau_admin` session (defense in depth) |
| **Dashboard Stats** | Total users, Trial, Active, Expired, Pending, Payments, Verified, Rejected |
| **👤 Users Management** | List/search/filter, edit profile, change status, set access tier |
| **💳 Payments** | Verify/reject payments, bulk actions, view screenshots |
| **📋 Activity Logs** | Track all admin actions with timestamps |
| **⚙️ Settings** | Payment amount, QR code URL, contact phone, trial hours, default tier |
| **CSV Export** | Users and Payments data export |
| **Password Change** | Secure admin password update |
| **Auto-refresh** | Data refreshes every 60 seconds when tab active |
| **Keyboard Shortcuts** | Ctrl+R refresh, Ctrl+1-5 navigation |

### 📱 PWA Features

| Feature | Description |
|---------|-------------|
| **Install Prompt** | "Add to Home Screen" banner (Android) |
| **iOS Install Guide** | Step-by-step Safari install modal |
| **Service Worker** | Offline app shell + API fallback |
| **Update Toast** | "New version available — Tap to update" |
| **Fullscreen Mode** | Toggle browser fullscreen |
| **Theme Toggle** | Dark/Light mode with persistence |

### 🌐 Network & Offline

| Feature | Description |
|---------|-------------|
| **Forced Offline Mode** | Manual toggle to block all network requests |
| **Auto Offline Detection** | Detects network loss, switches to cache |
| **Offline Banner** | Visual indicator when serving from cache |
| **Smart Retry** | Auto-retry failed requests with backoff |
| **Cache Validation** | Detects and purges corrupted cache entries |

---

## 🔧 Session Schema

Stored in `localStorage` as `hau_session`:

```json
{
  "type": "user" | "admin",
  "username": "string",
  "name": "string",
  "email": "string",
  "mobile": "string",
  "token": "session_token",
  "access": {
    "level": "permanent" | "trial" | "pending" | "expired",
    "trialExpiresAt": "ISO_date",
    "permanent": false
  },
  "settings": {},
  "lastVerified": 1234567890
}
```

---

## 🎨 Design System

- **Primary:** Amber (`#F5A623`) — actions, highlights, brand
- **Success:** Green (`#22C55E`) — correct, verified, active
- **Danger:** Rose (`#F43F5E`) — wrong, rejected, delete
- **Info:** Sky (`#38BDF8`) — links, cached, trial
- **Purple:** Violet (`#8B5CF6`) — admin, premium
- **Dark Theme:** Deep navy (`#080B14` → `#243055`)
- **Light Theme:** Soft blue-white (`#F4F6FB` → `#DDE4F5`)
- **Typography:** Space Grotesk (headings), Inter (body), JetBrains Mono (data)

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "JavaScript visible as text" | ✅ Fixed in this release — ensure you use `user.html` from this package |
| "No questions loading" | Check `chapters-data.js` has valid Google Drive file IDs |
| "Payment not verifying" | Check admin panel → Payments → verify manually |
| "Offline not working" | Go to Offline Cache tab while online, click "Cache All Data" |
| "Streak not tracking" | Complete any quiz (Flashcard or Exam mode) |
| "Admin panel won't open" | Admin has separate login at `admin.html` — not via gateway |
| "App not installable" | Must be served over HTTPS (not `file://`) |

---

## 📜 License

MIT — Free for personal and educational use.

Built for Nepal Engineering (Level 5 / Level 7) and PSC/Loksewa exam preparation.
