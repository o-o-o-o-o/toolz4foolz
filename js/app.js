import { CONFIG } from "../config.js";
import { fetchCSV, parseCSV } from "./csv.js";
import { getState, setState, subscribe } from "./store.js";
import { parseHash, initRouter } from "./router.js";
import {
  renderNav,
  renderTags,
  renderResults,
  renderStatus,
  renderLoading,
  renderError,
  renderBreadcrumb,
} from "./render.js";

// --- Column resolution ---

function getVisibleColumns(rows, sheet) {
  if (!rows.length) return [];
  const allKeys = Object.keys(rows[0]);
  if (!sheet) return allKeys;
  const cfg = Object.assign({}, CONFIG.columns, sheet.columns || {});
  const include = cfg.include
    ? cfg.include.map((c) => c.toLowerCase())
    : allKeys;
  const exclude = (cfg.exclude || []).map((c) => c.toLowerCase());
  return include.filter((c) => !exclude.includes(c) && allKeys.includes(c));
}

// --- Filtering ---

function filterRows(rows, query, activeTag) {
  return rows.filter((row) => {
    const matchesSearch =
      !query || row.name.toLowerCase().includes(query.toLowerCase());
    const matchesTag = !activeTag || row.tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });
}

// When a search query is present, searches across every loaded sheet
function filterAllSheets(data, sheets, query, activeTag) {
  const results = [];
  for (const sheet of sheets) {
    const rows = data.get(sheet.id);
    if (!rows) continue;
    for (const row of filterRows(rows, query, activeTag)) {
      results.push({ ...row, _sheet: sheet.label });
    }
  }
  return results;
}

// Memoized: recomputes only when state.data reference changes
let _tagCountsCache = { data: null, counts: null };

function getAllTagCounts(data) {
  if (_tagCountsCache.data === data) return _tagCountsCache.counts;
  const counts = new Map();
  for (const [id, rows] of data) {
    const c = {};
    for (const row of rows) {
      for (const tag of row.tags || []) {
        c[tag] = (c[tag] || 0) + 1;
      }
    }
    counts.set(id, c);
  }
  _tagCountsCache = { data, counts };
  return counts;
}

// --- Cache (localStorage, stale-while-revalidate) ---

const CACHE_PREFIX = "s2fs_";
const TS_PREFIX = "s2fs_ts_"; // when we last fetched (local)
const rawTextCache = new Map();

// --- Timestamp helpers ---

function readTimestamp(id) {
  const v = localStorage.getItem(TS_PREFIX + id);
  return v ? parseInt(v, 10) : null;
}

function formatDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${yyyy}-${mm}-${dd} ${h}:${min}${ampm}`;
}

function renderFooter() {
  const el = document.getElementById("footer");
  if (!el) return;

  // Find the sheet most recently fetched
  let latestId = null,
    latestTs = 0;
  for (const sheet of CONFIG.sheets) {
    const ts = readTimestamp(sheet.id);
    if (ts && ts > latestTs) {
      latestTs = ts;
      latestId = sheet.id;
    }
  }

  if (!latestId) {
    el.textContent = "";
    return;
  }

  const fetchTs = readTimestamp(latestId);

  el.innerHTML = "";
  const btn = document.createElement("button");
  btn.className = "footer-update";
  btn.textContent = `↻ Last Fetched: ${formatDate(fetchTs)}`;
  btn.addEventListener("click", () => onSheetSwitch(latestId));
  el.appendChild(btn);
}

function readCache(id) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(id, rows) {
  try {
    localStorage.setItem(CACHE_PREFIX + id, JSON.stringify(rows));
    try {
      localStorage.setItem(TS_PREFIX + id, String(Date.now()));
    } catch {}
  } catch {
    /* quota exceeded – ignore */
  }
}

// --- Data loading ---

async function loadSheet(id, silent = false) {
  const state = getState();
  if (state.data.has(id)) return;

  const sheet = CONFIG.sheets.find((s) => s.id === id);
  if (!sheet) return;

  // Serve from cache immediately, then revalidate in background
  const cached = readCache(id);
  if (cached) {
    const data = new Map(state.data);
    data.set(id, cached);
    setState({ data });
    refreshSheet(id); // silent background update
    return;
  }

  if (!silent) renderLoading();
  try {
    const text = await fetchCSV(sheet.csvUrl);
    rawTextCache.set(id, text);
    const rows = parseCSV(text);
    writeCache(id, rows);
    const data = new Map(state.data);
    data.set(id, rows);
    setState({ data });
  } catch (e) {
    if (!silent) renderError("Failed to load data. Check the CSV URL.");
  }
}

async function refreshSheet(id) {
  const sheet = CONFIG.sheets.find((s) => s.id === id);
  if (!sheet) return;
  try {
    const text = await fetchCSV(sheet.csvUrl);
    if (rawTextCache.get(id) === text) {
      renderFooter();
      return;
    } // unchanged
    rawTextCache.set(id, text);
    const rows = parseCSV(text);
    writeCache(id, rows);
    const state = getState();
    const data = new Map(state.data);
    data.set(id, rows);
    setState({ data });
  } catch (e) {
    // silent — don't disrupt the UI on a background poll failure
  }
}

// --- Event handlers ---

function onTagToggle(tag) {
  const state = getState();
  if (tag === null) {
    setState({ activeTags: new Set() });
  } else {
    const tags = new Set();
    if (!state.activeTags.has(tag)) tags.add(tag);
    setState({ activeTags: tags });
  }
  const td = document.getElementById("tag-disclosure");
  if (td) td.open = false;
}

function onSheetSwitch(id) {
  setState({ activeSheet: id, searchQuery: "", activeTags: new Set() });
  document.querySelectorAll("#breadcrumb details").forEach((d) => {
    d.open = false;
  });
  loadSheet(id);
}

// --- Render on state change ---
// Track previous values so each render function is only called when its inputs change
let prev = {};

function update(state) {
  const rows = state.data.get(state.activeSheet);
  if (!rows) return;

  const activeTag =
    state.activeTags.size === 1 ? [...state.activeTags][0] : null;
  const sheetChanged = state.activeSheet !== prev.activeSheet;
  const queryChanged = state.searchQuery !== prev.searchQuery;
  const tagChanged = activeTag !== prev.activeTag;
  const dataChanged = state.data !== prev.data;

  const allTagCounts = getAllTagCounts(state.data);
  const tagCounts = allTagCounts.get(state.activeSheet) || {};

  if (sheetChanged) {
    const sheet = CONFIG.sheets.find((s) => s.id === state.activeSheet);
    prev.sheet = sheet;
    prev.visibleColumns = getVisibleColumns(rows, sheet);
    renderNav(CONFIG.sheets, state.activeSheet, onSheetSwitch);
  }

  if (sheetChanged || tagChanged) {
    renderBreadcrumb(prev.sheet ? prev.sheet.label : "", activeTag);
    renderTags(tagCounts, state.activeTags, onTagToggle);
  }

  if (sheetChanged || queryChanged || tagChanged || dataChanged) {
    document
      .querySelector("#app")
      .classList.toggle("is-searching", !!state.searchQuery);
    let filtered, total;
    if (state.searchQuery) {
      // Cross-sheet search: scan all loaded sheets
      filtered = filterAllSheets(
        state.data,
        CONFIG.sheets,
        state.searchQuery,
        activeTag,
      );
      total = null; // signals "N results" rather than "N of M"
    } else {
      filtered = filterRows(rows, state.searchQuery, activeTag);
      total = rows.length;
    }
    renderResults(filtered, prev.visibleColumns, onTagToggle);
    renderStatus(filtered.length, total);
  }

  if (dataChanged) renderFooter();

  prev.activeSheet = state.activeSheet;
  prev.searchQuery = state.searchQuery;
  prev.activeTag = activeTag;
  prev.data = state.data;
}

// --- Search with debounce ---

let debounceTimer;
function initSearch() {
  const input = document.getElementById("search");
  const toggle = document.getElementById("search-toggle");
  const topbar = document.getElementById("topbar");

  // Mobile: 🔎 opens the search input
  if (toggle) {
    toggle.addEventListener("click", () => {
      topbar.classList.add("search-active");
      input.focus();
    });
  }

  // Collapse mobile search when cleared and focus leaves
  input.addEventListener("blur", () => {
    if (!input.value) topbar.classList.remove("search-active");
  });

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      setState({ searchQuery: input.value });
    }, 150);
  });
  // Keep input in sync with state (e.g. on hash navigation)
  subscribe((state) => {
    if (input.value !== state.searchQuery) input.value = state.searchQuery;
  });
}

// --- Disclosure mutual exclusion + click-outside ---

function initDisclosures() {
  const disclosures = Array.from(
    document.querySelectorAll("#breadcrumb details"),
  );

  // When one opens, close the others
  disclosures.forEach((d) => {
    d.addEventListener("toggle", () => {
      if (d.open) {
        disclosures.forEach((other) => {
          if (other !== d) other.open = false;
        });
      }
    });
  });

  // Click outside closes all
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#breadcrumb")) {
      disclosures.forEach((d) => {
        d.open = false;
      });
    }
  });
}

// --- Init ---

function init() {
  const titleEl = document.getElementById("site-title");
  if (titleEl) titleEl.textContent = CONFIG.title;
  document.title = CONFIG.title;

  if (!CONFIG.sheets.length) {
    renderError("No sheets configured. Edit config.js to add sheets.");
    return;
  }

  initRouter();
  initSearch();
  initDisclosures();
  subscribe(update);
  renderFooter(); // show any persisted timestamp immediately

  // Parse initial hash or default to first sheet
  const { sheet, query, tags } = parseHash(location.hash);
  const initialSheet = CONFIG.sheets.find((s) => s.id === sheet)
    ? sheet
    : CONFIG.sheets[0].id;

  setState({
    activeSheet: initialSheet,
    searchQuery: query,
    activeTags: new Set(tags),
  });

  loadSheet(initialSheet).then(() => {
    // Preload all other sheets in the background so tab-switching is instant
    CONFIG.sheets
      .filter((s) => s.id !== initialSheet)
      .forEach((s) => loadSheet(s.id, true));
  });

  if (CONFIG.pollInterval) {
    setInterval(
      () => refreshSheet(getState().activeSheet),
      CONFIG.pollInterval,
    );
  }
}

init();
