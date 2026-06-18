/* ═══════════════════════════════════════════════════════════════
   CODE.GS — Google Apps Script backend for HAMRO AFNAI
   ───────────────────────────────────────────────────────────────
   WHAT THIS FILE DOES
   This is the ONLY server-side file. Deploy it as a Web App and
   paste the resulting URL into APP_CONFIG.APPS_URL in app.js.

   It exposes a single HTTP endpoint (doGet) that branches on
   ?action=... into two clearly separated groups, exactly as
   requested:

     1) AUTH API   — login, signup, admin approval/rejection,
                     admin login, list pending/active users.
     2) CONTENT API — getFile (fetches a Drive-hosted question
                     JSON file and returns its contents).

   These two groups don't share any code paths, so if you ever
   want to split them into two separate Apps Script projects/
   deployments later, you can copy each section out wholesale.

   ───────────────────────────────────────────────────────────────
   ONE-TIME SETUP
   1. Go to https://script.google.com → New Project.
   2. Delete the default code, paste this whole file in.
   3. Run `setup()` once from the editor (Run ▶) to create the
      "Users" sheet automatically in a new Google Sheet. Grant the
      permissions it asks for. Check the execution log for the
      Sheet URL it prints, so you can find it later.
   4. Deploy → New deployment → type: Web app.
        Execute as: Me
        Who has access: Anyone
      Copy the Web app URL.
   5. Paste that URL into app.js as APP_CONFIG.APPS_URL.
   6. Change ADMIN_USERNAME / ADMIN_PASSWORD below to your own
      values before you deploy for real — the placeholder values
      are NOT secure.
═══════════════════════════════════════════════════════════════ */

/* ── ADMIN CREDENTIALS ─────────────────────────────────────────
   CHANGE THESE before you deploy. Anyone who knows these can
   approve/reject every user in the system. */
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "ChangeMe123!";

/* ── SHEET CONFIG ── */
const SHEET_NAME = "Users";
const SHEET_HEADERS = ["username", "passHash", "name", "contact", "contactType", "status", "createdAt", "approvedAt", "role"];
// status: "pending" | "active" | "rejected"
// role:   "user" | "admin"

/* ═══════════════════════════════════════════════════════════════
   ENTRY POINT
═══════════════════════════════════════════════════════════════ */
function doGet(e) {
  const action = (e.parameter.action || "").trim();
  let result;
  try {
    switch (action) {
      // ── AUTH API ──
      case "login": result = authLogin(e.parameter); break;
      case "signup": result = authSignup(e.parameter); break;
      case "adminLogin": result = adminLogin(e.parameter); break;
      case "adminListPending": result = adminListUsers(e.parameter, "pending"); break;
      case "adminListUsers": result = adminListUsers(e.parameter, null); break;
      case "adminApprove": result = adminSetStatus(e.parameter, "active"); break;
      case "adminReject": result = adminSetStatus(e.parameter, "rejected"); break;
      case "adminRevoke": result = adminSetStatus(e.parameter, "pending"); break;
      case "adminDelete": result = adminDeleteUser(e.parameter); break;

      // ── CONTENT API ──
      case "getFile": result = getFileContents(e.parameter); break;

      default: result = { success: false, error: "Unknown action: " + action };
    }
  } catch (err) {
    result = { success: false, error: "Server error: " + err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════════════════════════════════════════
   ONE-TIME SETUP HELPER
═══════════════════════════════════════════════════════════════ */
function setup() {
  const sheet = getSheet_();
  Logger.log("Users sheet ready: " + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

function getSheet_() {
  let ss = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  let spreadsheet;
  if (ss) {
    try { spreadsheet = SpreadsheetApp.openById(ss); } catch (e) { spreadsheet = null; }
  }
  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create("HAMRO AFNAI - Users");
    PropertiesService.getScriptProperties().setProperty("SHEET_ID", spreadsheet.getId());
  }
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(SHEET_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ═══════════════════════════════════════════════════════════════
   AUTH API
═══════════════════════════════════════════════════════════════ */

/* Simple, dependency-free hash. Not cryptographically bulletproof,
   but this isn't a bank — it stops plaintext passwords sitting in
   the sheet, which is the realistic threat here. */
function hashPass_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(b => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, "0")).join("");
}

function findUserRow_(sheet, username) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      return { rowIndex: i + 1, row: data[i] };
    }
  }
  return null;
}

function rowToUser_(row) {
  return {
    username: row[0], name: row[2], contact: row[3], contactType: row[4],
    status: row[5], createdAt: row[6], approvedAt: row[7], role: row[8] || "user"
  };
}

function authSignup(p) {
  const username = (p.username || "").trim();
  const password = p.password || "";
  const name = (p.name || "").trim();
  const contact = (p.contact || "").trim(); // email or phone
  const contactType = p.contactType === "phone" ? "phone" : "email";

  if (!username || !password || !contact) {
    return { success: false, error: "Username, password, and contact are required." };
  }
  if (password.length < 4) {
    return { success: false, error: "Password must be at least 4 characters." };
  }
  const sheet = getSheet_();
  if (findUserRow_(sheet, username)) {
    return { success: false, error: "That username is already taken." };
  }
  const now = new Date().toISOString();
  sheet.appendRow([username, hashPass_(password), name || username, contact, contactType, "pending", now, "", "user"]);
  return {
    success: true,
    pending: true,
    message: "Account created. An admin needs to approve it before you can log in."
  };
}

function authLogin(p) {
  const username = (p.username || "").trim();
  const password = p.password || "";
  if (!username || !password) return { success: false, error: "Enter username and password." };

  const sheet = getSheet_();
  const found = findUserRow_(sheet, username);
  if (!found) return { success: false, error: "No account with that username. Sign up first." };

  const row = found.row;
  const storedHash = row[1];
  if (storedHash !== hashPass_(password)) {
    return { success: false, error: "Wrong password." };
  }
  const status = row[5];
  if (status === "pending") {
    return { success: false, error: "Your account is awaiting admin approval. Please check back later.", pending: true };
  }
  if (status === "rejected") {
    return { success: false, error: "This account was not approved. Contact the admin." };
  }
  return { success: true, user: rowToUser_(row) };
}

function adminLogin(p) {
  const username = (p.username || "").trim();
  const password = p.password || "";
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return { success: true, admin: true, user: { username, name: "Admin", role: "admin" } };
  }
  return { success: false, error: "Invalid admin credentials." };
}

function checkAdmin_(p) {
  return p.adminUser === ADMIN_USERNAME && p.adminPass === ADMIN_PASSWORD;
}

function adminListUsers(p, statusFilter) {
  if (!checkAdmin_(p)) return { success: false, error: "Admin authentication failed." };
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < data.length; i++) {
    const u = rowToUser_(data[i]);
    if (!statusFilter || u.status === statusFilter) users.push(u);
  }
  return { success: true, users };
}

function adminSetStatus(p, newStatus) {
  if (!checkAdmin_(p)) return { success: false, error: "Admin authentication failed." };
  const username = (p.username || "").trim();
  if (!username) return { success: false, error: "Missing username." };
  const sheet = getSheet_();
  const found = findUserRow_(sheet, username);
  if (!found) return { success: false, error: "User not found." };
  sheet.getRange(found.rowIndex, 6).setValue(newStatus); // status column
  if (newStatus === "active") {
    sheet.getRange(found.rowIndex, 8).setValue(new Date().toISOString()); // approvedAt
  }
  return { success: true, username, status: newStatus };
}

function adminDeleteUser(p) {
  if (!checkAdmin_(p)) return { success: false, error: "Admin authentication failed." };
  const username = (p.username || "").trim();
  const sheet = getSheet_();
  const found = findUserRow_(sheet, username);
  if (!found) return { success: false, error: "User not found." };
  sheet.deleteRow(found.rowIndex);
  return { success: true, deleted: username };
}

/* ═══════════════════════════════════════════════════════════════
   CONTENT API — serves question-bank files stored on Google Drive
═══════════════════════════════════════════════════════════════ */
function getFileContents(p) {
  const fileId = p.fileId;
  if (!fileId) return { success: false, error: "Missing fileId." };
  try {
    const file = DriveApp.getFileById(fileId);
    const text = file.getBlob().getDataAsString("UTF-8");
    // Return raw JSON parsed, so the client gets an array/object directly
    return JSON.parse(text);
  } catch (err) {
    return { success: false, error: "Could not read file: " + err.message };
  }
}
