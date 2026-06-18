# HAMRO AFNAI — Setup & What Changed

## Files in this delivery
| File | Purpose |
|---|---|
| `index.html` | App shell — UI, styles, login/signup screen. No logic, no chapter data. |
| `app.js` | All app logic (auth, quiz engine, admin panel, dashboard, timetable, etc). |
| `chapters-data.js` | **Edit this** to add/rename levels, chapters, or Google Drive file IDs. Pure data, no logic. |
| `Code.gs` | Google Apps Script backend — paste into script.google.com. Handles login/signup/admin **and** serves question files, kept in clearly separate sections. |
| `manifest.json` | Makes the app installable as a real full-screen app (PWA). |
| `sw.js` | Service worker — offline shell caching + install reliability. |

Put the first five web files in the same folder/host (they reference each other by relative path). `Code.gs` goes into Google Apps Script, not your web host.

---

## One-time deploy steps

1. **Apps Script backend**
   - Go to script.google.com → New project → paste in `Code.gs`.
   - Run the `setup()` function once (▶ button). Approve the permission prompts. Check the execution log — it prints the URL of a new Google Sheet called "HAMRO AFNAI - Users" where accounts will live.
   - **Change `ADMIN_USERNAME` / `ADMIN_PASSWORD`** near the top of `Code.gs` to your own values (currently placeholders: `admin` / `ChangeMe123!`).
   - Deploy → New deployment → type **Web app** → Execute as **Me** → Who has access **Anyone** → Deploy. Copy the Web app URL.

2. **Wire the frontend to your backend**
   - Open `app.js`, find `APP_CONFIG.APPS_URL` near the top, paste your Web app URL there.

3. **Host the five web files** (GitHub Pages, Netlify, Firebase Hosting, your own server — anything that serves static files over HTTPS works; HTTPS is required for service workers/installability).

4. **Add real icons** (optional but recommended): drop `icon-192.png` and `icon-512.png` next to `manifest.json`, or edit the paths in `manifest.json` to point at whatever icon files you use.

---

## How login/signup/admin now works

- **Signup**: users pick a username/password, give a name + email-or-phone, and land in **pending** status. They cannot log in yet.
- **Admin approval**: open the app → tap the 🛡️ admin button (visible on the login screen and the top bar) → sign in with the admin credentials from `Code.gs` → approve, reject, revoke, or delete any account from the panel that opens.
- **Login**: once approved, the user signs in normally. After the *first* successful online login on a device, the session is cached locally — exactly like Facebook/WhatsApp, the user is never forced back to the login screen just because the network drops. Going offline does not require a fresh login; it only blocks **signup** and **admin actions**, since those need the server.

## Bugs fixed from the original files
- Removed the duplicated/conflicting script block that caused `Identifier 'APPS' has already been declared` and broke the entire app on load.
- Fixed `AUTH.login()` so it actually checks `S.online` instead of always trying the network first (the original had dead `if(true)` branching).
- Fixed `DATA.imp()`'s duplicate/abandoned `FileReader` (it created two readers, only used one).
- Replaced the Blob-URL service worker (unreliable installability) with a real `sw.js` file, and added a real `manifest.json` — both needed for proper "Add to Home Screen" full-screen behavior.
- Added guards so Exam mode can't be submitted twice, malformed questions (missing options/correct answer) are filtered out instead of silently breaking `isOk()`, and chapters with no files yet show "coming soon" instead of a dead-end empty dropdown.
- Added keyboard shortcuts (←/→ to navigate flashcards, 1–5 to answer, Esc to quit) and a fullscreen toggle button for a more native, app-like feel.
- Separated **chapter/file data** (`chapters-data.js`), **app logic** (`app.js`), and **server** (`Code.gs`, itself split into an Auth section and a Content section) so each can be edited independently — adding a new question file is now a one-line edit in `chapters-data.js` instead of hunting through application code.
