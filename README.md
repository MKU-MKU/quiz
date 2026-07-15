# HAMRO AFNAI — Smart Study Hub

Offline-first exam prep platform for Nepal Engineering (Level 5 / Level 7) and PSC/Loksewa, built as three static HTML pages + a shared backend on Google Apps Script + Google Sheets. No build step, no server framework — everything runs from static files plus one deployed Apps Script web app.

---

## 1. How it all fits together

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ index.html  │─────▶│  user.html   │      │  admin.html  │
│  (Gateway)  │      │ (Study App)  │      │(Admin Panel) │
└──────┬──────┘      └──────┬───────┘      └──────┬───────┘
       │                    │                      │
       │ localStorage       │ loads                │ own login
       │ 'hau_session'      │ app.js               │ 'hau_admin'
       │                    │ chapters-data.js      │
       │                    │                       │
       └────────────────────┴───────────┬───────────┘
                                         │  action=...
                                         ▼
                              ┌───────────────────────┐
                              │      CODE.GS            │
                              │ (Google Apps Script)    │
                              │  Users / Payments /     │
                              │  Settings Google Sheet  │
                              └───────────┬─────────────┘
                                          │
                                          ▼
                              Google Drive (question JSON files,
                              referenced by fileId in chapters-data.js)
```

**The three pages never share code — only two things connect them:**
1. The same deployed Apps Script URL (`GAS_URL` in `index.html`/`admin.html`, `APP_CONFIG.APPS_URL` in `app.js`) — all three must point at the identical `/exec` URL.
2. The `hau_session` localStorage key, written only by `index.html`, read by `app.js` on `user.html`. (`admin.html` does **not** use this key — it has its own independent login, described below.)

---

## 2. How it runs (no build step)

This is plain HTML/CSS/JS — you don't compile or bundle anything.

1. **Deploy the backend once:**
   - Open [script.google.com](https://script.google.com), paste `CODE.GS` into a new Apps Script project.
   - Change `ADMIN_PASSWORD` in `CODE.GS` away from the default.
   - Deploy → New deployment → Web app → Execute as "Me" → Who has access "Anyone".
   - Copy the resulting `.../exec` URL.
2. **Wire the frontend to it:** paste that URL into all three places:
   - `index.html` → `const GAS_URL = "..."`
   - `admin.html` → `const GAS_URL = "..."`
   - `app.js` → `APP_CONFIG.APPS_URL`
3. **Host the files:** any static host works (GitHub Pages, Netlify, Firebase Hosting, or just open `index.html` locally for testing — though the service worker/PWA install only works over HTTPS or `localhost`).
4. **First run:** the Apps Script auto-creates the `Users`, `Payments`, and `Settings` sheets on first request — no manual sheet setup needed.
5. **Content:** question sets live as JSON files on Google Drive (shared "Anyone with the link"); their file IDs are registered in `chapters-data.js` — see §4 below.

---

## 3. What each file is responsible for

| File | Role | Loads / depends on |
|---|---|---|
| **`index.html`** | Gateway: signup, login, 24h trial countdown, payment submission (QR + TXN ID + screenshot), routes to `user.html` or `admin.html`. Owns the `hau_session` schema. | Standalone — talks directly to `CODE.GS`. No other local JS files. |
| **`admin.html`** | Admin panel: list/search users, approve or reject payments, edit global settings (payment amount, QR image, contact info), view stats, change admin password. Has its **own** login gate (`hau_admin` key) independent of `index.html`. | Standalone — talks directly to `CODE.GS`. No other local JS files. |
| **`user.html`** | The actual study app shell: all HTML structure/CSS for every view (home, quiz, bookmarks, timetable, offline cache, etc.), plus a small inline `<script>` "patch layer" at the bottom (search links, swipe gesture, bottom-nav wiring, PWA install button). | Loads `chapters-data.js`, then `app.js`, then its own inline script. |
| **`app.js`** | All application logic: session gate, quiz engine (flashcard + exam), bookmarks/flags/wrong-bank, progress tracking, streaks, timetable + alarms, offline cache manager, data export/import, PWA registration. This is the file you'll touch for almost any feature change. | Reads globals from `chapters-data.js` (`ChapterData`, `CH_NAMES`, `DRIVE`). Talks to `CODE.GS` for `checkSession` and `getFile` (question downloads). |
| **`chapters-data.js`** | Pure data: levels → chapters → **books** → subtopics, and their Google Drive file IDs (4 levels deep — see §4). The only file you edit to add/rename/remove chapters, books, or question sets — see the big comment block at the top of the file itself for step-by-step instructions. | None — pure data map, no logic. |
| **`quiz.js`** | ⚠️ **Not used.** Not referenced by any HTML file, and incompatible with the current app (duplicate `QUIZ`/`REV` names, calls `DATA.*` methods that don't exist in `app.js`). Currently a deprecation-notice stub. Safe to delete. | — |
| **`CODE.GS`** | Backend: all `action=...` endpoints (`login`, `signup`, `checkSession`, `submitPayment`, `getSettings`, `getFile`, and the `admin*` actions), user/payment storage in Google Sheets, password hashing. | Google Sheets (`Users`, `Payments`, `Settings`), Google Drive (for `getFile` and payment screenshots). |
| **`manifest.json`** | PWA metadata (name, icons, theme color, start URL) — lets the app be "installed" to a home screen. | Referenced by `user.html`'s `<link rel="manifest">`. |
| **`sw.js`** | Service worker: caches the app shell for offline use (stale-while-revalidate), and Drive/API responses (network-first with offline fallback). It does **not** currently send or handle any timetable-alarm notifications — the Timetable feature itself works, but there's no push/local-notification wiring yet (see "Known gaps" in §7). | Registered by `PWA.init()` in `app.js`. |

### Quick "which file do I touch?" guide

| I want to... | Edit this file |
|---|---|
| Add/rename a chapter, book, level, or question-file link | `chapters-data.js` **only** |
| Change how a quiz session behaves (timer length, question limit, shuffle, retry logic, exam auto-submit, scoring, results screen) | `app.js` → section `9. QUIZ ENGINE` |
| Add a new quiz mode (e.g. "timed sprint", "matching game") | `app.js` → new module alongside `QUIZ`/`PSY`, plus matching HTML in `user.html` |
| Change bookmarks / flags / wrong-bank behavior | `app.js` → section `8. REVIEW LISTS` |
| Change trial length, payment flow, or login/signup validation | `CODE.GS` (`TRIAL_HOURS`, `handleSignup`, `handleLogin`) **and** `index.html` (form/validation) |
| Change what happens when a session expires or how offline access is judged | `app.js` → section `4. AUTH` **and** `index.html`'s matching logic (keep both in sync — see §5) |
| Change the dashboard, streaks, or progress stats | `app.js` → sections `10a`–`10c` |
| Change the timetable or its alarms | `app.js` → section `10d` |
| Change offline caching behavior | `app.js` → section `10e`, and `sw.js` for the underlying cache strategy |
| Change visual styling of the study app | `user.html` `<style>` block (CSS variables at the top control the whole theme) |
| Change visual styling of login/payment screens | `index.html` `<style>` block |
| Change admin panel behavior | `admin.html` (self-contained, doesn't touch `app.js`) |
| Add a brand-new top-level view (like a new sidebar tab) | HTML section in `user.html`, sidebar link in `user.html`, a new module in `app.js`, and a case in `UI._goRaw()`'s view-switch |

---

## 4. Adding question content (no code changes needed)

As of this update, content is organized **4 levels deep**:

```
Level (level5 / level7 / gk / old_question)
  └─ Chapter (e.g. "7": "Building Construction Technology")
       └─ Book (the author/source a question set came from, e.g. "Sunil Sah", "DPARSAD", "GATE")
            └─ Subtopic (the question range/label, e.g. "1-100") → Google Drive fileId
```

Online Study in `user.html` shows this as four cascading dropdowns: **Level → Chapter → Book → Subtopic**.

To add a new question set:
1. Upload your question JSON to Google Drive → Share → "Anyone with the link".
2. Copy the file ID from the share link.
3. Open `chapters-data.js`, find the right `level` → chapter number → book name in the `DRIVE` object, and add `"Your Subtopic Label": "fileId"` under it.
   - Adding a brand-new book to an existing chapter? Add a new key at the book level, e.g. `"New Author": { "1-100": "fileId" }`.
   - If a book only has one file total, use `"All"` as the subtopic label (this is how single-file books like `GATE` and `DPARSAD` in the `gk` level are set up).
4. New chapter or level? Follow the instructions in `chapters-data.js`'s own header comment.

Expected question JSON shape (flexible — `normQ()` in `app.js` accepts several variants):
```json
[
  {
    "q": "Question text",
    "options": ["A", "B", "C", "D"],
    "correct": 0,
    "explanation": "Why A is correct"
  }
]
```

**Note on the `ChapterData` helper API** (used throughout `app.js`):
- `ChapterData.chapters(lv)` — chapter list for a level (unchanged)
- `ChapterData.books(lv, ch)` — book list for a chapter (**new**)
- `ChapterData.files(lv, ch, book)` — subtopic→fileId map for one book (now takes a `book` argument)
- `ChapterData.fileCount(lv, ch)` — usable file count across *all* books in a chapter; pass a 3rd `book` argument to count just that book
- `ChapterData.chapterFileRefs(lv, ch)` — flat `{lv,ch,book,subtopic,name,fid,key}` list for one chapter, across all its books (**new** — used by Psycho Mode)
- `ChapterData.allFileRefs()` — same flat shape across the *entire* dataset (used by Daily Challenge and Offline Cache) — unchanged in shape, so nothing downstream needed to change

---

## 5. Things to keep in sync across files (important!)

- **`GAS_URL` / `APP_CONFIG.APPS_URL`** — must be identical in `index.html`, `admin.html`, `app.js`.
- **`hau_session` shape** — `index.html` writes `{ type, username, name, email, mobile, token, access:{level, trialExpiresAt, permanent}, settings, lastVerified }`. `app.js`'s `AUTH` module reads/writes this exact shape. If you change one, change the other.
- **Access-level rules** (`permanent` / `trial` / `expired` / `pending`) — computed independently in `index.html`'s `handleUserAuth()` and `app.js`'s `AUTH._buildSession()`. They're written to mirror each other; if you change what counts as valid access in one, update the other the same way. **Known gap:** both currently collapse the backend's `expired` and `payment_pending` statuses into the same `access.level = 'expired'` — see §7.
- **Offline cache keys** — `ON.onBook()` (Online Study), `PSY.start()` (Psycho Mode), and `CACHE`/`QUIZ.daily()` (via `ChapterData.allFileRefs()`) must all build the identical key string for the same file, or a set cached from one screen won't show as cached on another. The format is `` `${level}_${chapter}_${book}_${subtopic}` `` — generated in one place (`ChapterData.chapterFileRefs()`/`allFileRefs()`) and read consistently everywhere else, so this shouldn't need manual attention unless you're hand-writing a new call site.
- **Global settings (payment amount/QR/contact/instructions)** — saved via `admin.html` → `adminUpdateSettingsBatch` → the `Settings` sheet, and read by `index.html` via `getSettings`. `index.html`'s `loadPaymentUI()` re-fetches live settings every time it's online (see fix in §6) — don't reintroduce a "skip fetch if already cached" shortcut here, or admin changes will stop propagating to browsers that already have a stale cached copy.

---

## 6. Changelog (this pass)

- **Fixed:** `app.js` had a leftover `window.SB = SB;` line referencing a module that was already removed, throwing an uncaught `ReferenceError` on every page load and silently skipping the `window.*` exposure of every module declared after it (`ON`, `LOC`, `PSY`, `REV`, `QUIZ`, `PWA`, `PROG`, `HOME`, `STREAK`, `TT`, `CACHE`, `DATA`, `APP`). Functionality was unaffected (everything else is reached via bare identifiers, not `window.*`), but it polluted the console and left those aliases missing. Removed the line and updated the stale section-index comment at the top of the file.
- **Fixed:** `index.html`'s `loadPaymentUI()` only fetched live settings from the backend when the local cache was completely empty (`Object.keys(s).length===0`). Once any browser had cached a settings snapshot even once, it would never re-fetch — so changes made in `admin.html` (from any device, including the same one) silently stopped reaching users who'd already been through the trial/payment screen before. Now it always fetches fresh settings while online and only falls back to the cached copy when offline.
- **Fixed:** `ChapterData.fileCount()` used to count *keys*, not truthy file IDs — so chapters whose only entries were empty-string placeholders (e.g. the `old_question` PSC sets, or `gk`'s `DPARSAD` books) showed up as having content instead of "(coming soon)". It now only counts entries with a real file ID.
- **Added:** a **Book** layer between Chapter and Subtopic (`Level → Chapter → Book → Subtopic`), matching what was already implicit in the data (every old label like `"Sunil Sah 1-100"` was really `Book="Sunil Sah", Subtopic="1-100"` mashed into one string). `chapters-data.js` was restructured accordingly (auto-migrated from the old flat labels — verified zero file IDs lost), `ON` (Online Study) gained a 4th cascading dropdown, and `PSY` (Psycho Mode) was updated to use the new `ChapterData.chapterFileRefs()` helper instead of assuming a flat file map. Daily Challenge and Offline Cache needed no changes — they already consumed the generic `ChapterData.allFileRefs()` shape.
  - **Migration note:** cache keys now include the book name (`${level}_${chapter}_${book}_${subtopic}` instead of `${level}_${chapter}_${label}`). Anyone who already downloaded an offline pack under the old key format will see it as "not cached" once and need to re-download it — no data is lost, it's just a one-time re-sync.

---

## 7. Known gaps / things to revisit

- **Payment-pending vs. never-paid look identical to the user.** The backend distinguishes `expired` (trial ran out, no payment yet) from `payment_pending` (already submitted, awaiting admin review) — both set `needsPayment: true`. Both `index.html` and `app.js` currently collapse this into a single `access.level = 'expired'`, so a user who already submitted payment but logs in again from a new device (or after clearing storage) before admin review is complete sees the "please pay" screen again instead of a "your payment is under review" screen. The backend already has a `getPaymentStatus` action built for exactly this disambiguation, but nothing in the frontend calls it yet. Fixing this means adding a distinct `access.level` (e.g. `'pending_review'`) in both files and routing it to the existing `form-status` screen instead of `form-payment`.
- **No timetable alarm/notification wiring.** The Timetable feature (add/view weekly study sessions) works fully, but there's no push notification or local alarm firing at the scheduled time — `sw.js` has no `message`/notification handling, and `app.js` has no `Notification`/alarm-scheduling code. This would need to be built from scratch if it's wanted (likely via the Notifications API + a scheduled check in the service worker or a `setTimeout`-based approach while the tab is open).

---

## 8. Full feature list

See the chat message alongside this file — every user-facing feature is listed there, grouped by category, for a one-by-one keep/modify/remove review.
