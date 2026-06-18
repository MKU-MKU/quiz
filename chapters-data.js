/* ═══════════════════════════════════════════════════════════════
   CHAPTERS-DATA.JS
   ───────────────────────────────────────────────────────────────
   This file is the ONLY place you need to edit when you want to:
     • rename a level or chapter
     • add/remove a chapter
     • add/remove a question-file (Google Drive fileId) under a chapter

   It is intentionally separated from app.js (the app logic) and
   from Code.gs (the server). Nothing in here talks to the network —
   it's a plain data map that the rest of the app reads from.

   HOW TO ADD A NEW FILE:
   -----------------------
   1. Upload your question JSON to Google Drive.
   2. Right-click the file → "Share" → "Anyone with the link".
   3. Copy the long ID from the share link
      (the part between /d/ and /view in
       https://drive.google.com/file/d/THIS_PART/view)
   4. Paste it below under the right level → chapter → a label of
      your choice, e.g. "Sunil Sah 1-100": "PASTE_ID_HERE".

   HOW TO ADD A NEW CHAPTER:
   --------------------------
   1. Add an entry to CH_NAMES under the right level:
        "14":"New Chapter Name"
   2. Add a matching entry to DRIVE under the same level/number:
        "14": { "Some Label": "fileId" }
   If a chapter has no files yet, just use an empty object: "14":{}
   The UI will show it as "Coming soon" instead of breaking.

   HOW TO ADD A NEW LEVEL:
   -------------------------
   1. Add a new top-level key to CH_NAMES, e.g. level6: {...}
   2. Add the matching key to DRIVE, e.g. level6: {...}
   3. Add an <option> for it in index.html wherever levels are
      listed (search for "Select Level" in index.html).
═══════════════════════════════════════════════════════════════ */

const CH_NAMES = {
  level5: {
    "1": "Engineering Survey",
    "2": "Construction Materials",
    "3": "Mechanics of Material",
    "4": "Hydraulics",
    "5": "Soil Mechanics",
    "6": "Structural Design",
    "7": "Building Construction Tech.",
    "8": "Water Supply & Sanitation",
    "9": "Irrigation Engineering",
    "10": "Highway Engineering",
    "11": "Estimating & Costing",
    "12": "Construction Management",
    "13": "Airport Engineering"
  },
  level7: {
    "1": "Structural Engineering",
    "2": "Engineering Survey",
    "3": "Construction Materials",
    "4": "Concrete Technology",
    "5": "Geotechnical Engineering",
    "6": "Construction Management",
    "7": "Estimating & Costing",
    "8": "Engineering Drawing",
    "9": "Engineering Economics",
    "10": "Professional Practices"
  },
  gk: {
    "1": "Periodic Plans",
    "2": "Sustainable Development",
    "3": "International Affairs",
    "4": "Constitution",
    "5": "Governance",
    "6": "Civil Service",
    "7": "Public Services",
    "8": "Charter",
    "9": "Public Policy",
    "10": "Management",
    "11": "Planning & Accounting"
  },
  old_question: {
    "1": "Level 7 Sets",
    "2": "Level 5 Sets"
  }
};

const LEVEL_LABELS = {
  level5: "Level 5 — Civil Engineering",
  level7: "Level 7 — Diploma",
  gk: "General Knowledge",
  old_question: "Old Questions / Sets"
};

const DRIVE = {
  level5: {
    "1": { "Sunil Sah 1-100": "1Mw8pJA6oB-MsY9ngBrYOAmHgEuPpiLkY", "Sunil Sah 201-300": "1YnL2MhIhENsmObC38cRcwyQDoGUmN_eW", "Sunil Sah 301-400": "1wpB3nlapZwJnMDxfitJnUIxU6qLlTcem" },
    "2": { "Sunil Sah 1-100": "1DCi7TZlsRLXbswMXZ_phkNSvpvR4qEYC", "Sunil Sah 101-200": "1l2_oKmLGjbMZJAY2EXniIcsXBjgox1LI" },
    "3": { "Sunil Sah 1-100": "1y2DMIDeT20WxTDYnwiKjSs_rv0PFEE66", "Sunil Sah 101-200": "1fFyeshFHkB4kjdXwTq5l6IRte4JPOV8s" },
    "4": { "Sunil Sah 1-100": "1W0Haw_2D00dCGnytzmtiDG40WXiW356m", "Sunil Sah 101-200": "1q0lScj2EGQYv7n16ZY2qbluOG_xWtgd_" },
    "5": { "Sunil Sah 1-100": "11DZsjZfw4WbmglOxGRErYh9VBNv1-yy7", "Sunil Sah 101-200": "1l6ZBNY7MlRItTKOsglSF9xDGEQ_hrVZI" },
    "6": { "Sunil Sah 1-100": "1ZTRwGwGkdg6DpZzVizUQEkF-Z1IQT3a2", "Sunil Sah 101-200": "1NJIDXdgssUhX0QcnmIIN0QLWQjuP-gjs" },
    "7": { "Sunil Sah 1-100": "1H8b2DIcDQQ4dCDRaJctM6mYOyMMa7Rh-", "Sunil Sah 101-200": "1jYggTJbHhYxZDvroz5XIk-1O-I-trv5A" },
    "8": { "Sunil Sah 1-100": "1oCYIwNj8h6SdiOP4bB5HNG3cyX6ZRygd", "Sunil Sah 101-200": "1lSJuN-fvaBRsyABUNPApWm09rZn_V0ko" },
    "9": { "Sunil Sah 1-100": "1SFVGZBZCmcsMlBRLuv3rKjOr-ocKuJTy", "Sunil Sah 101-200": "1CeQH3i49wF9dc0e6mIznjiSA3A9Qxf3u" },
    "10": { "Sunil Sah 1-100": "1oglXPjLqCifewdj8-0MDx-IO5oCVyJ0G", "Sunil Sah 101-200": "1DJWlgozHY4-Obn4FAzL4ITZZJIiyCcrD" },
    "11": { "Sunil Sah 1-100": "1KJkfd3iSWEEt_JStk3nSdIhIGM-DwixJ", "R.K Shrestha 1-50": "1ivzRvvI9ZqXyyin4ncwW-GQIzECHOEDF" },
    "12": { "Sunil Sah 1-100": "1atj3Pt2St3Ag_9Lp1IIKfyFfzyES4jCu", "Sunil Sah 101-200": "1EgH0tKtUJQVmsopLeh61lXTTDzMqbMy6" },
    "13": { "Sunil Sah 1-70": "1W_tOzVueuNMTJEj4Zuwxkk4TxaSyHMm1" }
  },
  level7: {
    "1": { "DPARSAD 1-70": "1JKTr9KDUJwTaDPxP95RAfGQ9A2Rq8bc1", "DPARSAD 71-140": "1YS2oqmeoqMXk45sew_9sKRC9L2Nrzqfd" },
    "2": { "DPARSAD 1-100": "1hrZUgxFdyLjRisUW8hqjk_91XPHW6fkk", "DPARSAD 101-175": "1bJfeJWKRSzdh8m52Gn6TQBHNDr_EI1L1" },
    "3": { "DPARSAD 1-100": "1v1LXYwzNF2TafCQKunBOrxl_UHn8W7NO", "DPARSAD 101-175": "1xXcFMVIymWnuTOJF-nh9SSJzuXNQYfWr" },
    "4": { "DPARSAD 1-75": "1ivhJrueZC3QLpFQeFYm0yJWffSGNe-Pe", "DPARSAD 76-150": "1lE_4WajJhn5Inr6fru65lVZFWL0DuKjL" },
    "5": { "DPARSAD": "1ipRrpTWBA7JIdwCuTY73ZZwY0CTM-LAP" },
    "6": { "DPARSAD 1-75": "1cQGpQHGzekcDnE2duOkYzx3NAoeuPv5h", "DPARSAD 76-150": "1T2tghXwm_6Dqy5FkQgs0wiRrhl0NQuGM" },
    "7": { "DPARSAD 1-50": "1NFxxLQyK9xMAgPgxGGlOJUTxYdWj2n91", "DPARSAD 51-100": "1PFaqOODmbzhnnfg73XF-76DxoVs3BXo-" },
    "8": { "DPARSAD 1-100": "1sYFk5E4Tt6FHt6quXOUXlrYBj5KsnwCk" },
    "9": { "DPARSAD 1-75": "1q1A_kumq-JieVTi-_bXE8k2SVMpfJoxF" },
    "10": { "DPARSAD 1-113": "1V5JicjEQWiQy-UprrRfM_YJgXOQNwWgX" }
  },
  gk: {
    "1": { "GATE": "1S39S--nt9QVepKlcszdpntB8rRgAEqfd" },
    "2": { "GATE": "1922CKz8p81DWUWhimygloqKDNDQXbXXF" },
    "3": { "GATE": "1Yh9k58ZRbABVg7H6CEcr1xUIBgzAkl80" },
    "4": { "GATE": "1cKROTH8wtJh5-JAR20i5CpQK7a-nvFx_" },
    "5": { "GATE": "1xO4bk4QCPzqCORupW07MtNj-60OFlqZE" },
    "6": { "GATE": "1JJxacB5GWl6tPJupqpwh98s5V7EngJLw" },
    "7": { "GATE": "1eCtXLZrCZaZvYefOfH4eUEFny0e30cXo" },
    "8": { "GATE": "1sFSSB4hnSPgqiFxAWD1vF4Gkgm8FyKz5" },
    "9": { "GATE": "1u3hA3p7wtUaDvzDioLVrFaq02WUuNCpt" },
    "10": { "GATE": "1G5BtPfzG_bnmDhIORtJM6N5cmCEiAt3A" },
    "11": { "DPARSAD": "1ZIbu4pcNLDw-N_kGEUtdNVtJqxNX0c_T", "GATE": "1Z-UfiYm3_OHviX0sHzNl8elsF-lzqlkK" }
  },
  old_question: {
    "1": {},
    "2": {}
  }
};

/* Quick helpers used by app.js — kept here since they're pure data lookups */
const ChapterData = {
  levels(){ return Object.keys(CH_NAMES); },
  levelLabel(lv){ return LEVEL_LABELS[lv] || lv; },
  chapters(lv){ return CH_NAMES[lv] || {}; },
  chapterName(lv, ch){ return (CH_NAMES[lv] || {})[ch] || `Chapter ${ch}`; },
  files(lv, ch){ return DRIVE[lv]?.[ch] || {}; },
  fileCount(lv, ch){ return Object.keys(ChapterData.files(lv, ch)).length; },
  totalFilesInLevel(lv){
    return Object.values(DRIVE[lv] || {}).reduce((sum, files) => sum + Object.keys(files).length, 0);
  },
  allFileRefs(){
    // Flat list of {lv, ch, name, fid, key} across the whole dataset — used by
    // Psycho Mode "select all", Daily Challenge, and Offline Cache download.
    const out = [];
    for (const [lv, chs] of Object.entries(DRIVE)) {
      for (const [ch, files] of Object.entries(chs)) {
        for (const [name, fid] of Object.entries(files)) {
          if (fid) out.push({ lv, ch, name, fid, key: `${lv}_${ch}_${name}` });
        }
      }
    }
    return out;
  }
};
