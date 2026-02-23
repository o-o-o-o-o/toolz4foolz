# sheets2filtersite

Turns a Google Sheet into a searchable, filterable website. Each sheet tab becomes a page.

The entire UI — search, tag filtering, active page — is encoded in the URL hash, so every view is a shareable bookmark.

## Why it's built this way

### No build step, no dependencies, no npm

USes vanilla HTML, CSS, and ES modules. The only external dependency is the Google Sheets CSV endpoint, which Google has maintained since ~2010.

### Google Sheets as a CMS via published CSV

The data source is Google Sheets' "Publish to web" CSV export. This was chosen over the Sheets API v4 because:

- No API key, no OAuth, no Google Cloud project
- No CORS proxy needed (published CSV URLs serve permissive CORS headers)
- No server needed — the site is fully static
- The CSV format has been stable for over a decade

The tradeoff: data updates aren't instant. Google's published CSV has a cache delay (typically a few minutes). For a bookmarks/links site that changes infrequently, this is acceptable.

### Config lives next to index.html, not inside js/

`config.js` sits at the root alongside `index.html` because it's the one file a user edits regularly (to add new sheet tabs). Burying it inside `js/` creates unnecessary friction for the most common operation.

## How it works

### Data flow

```
Google Sheet (published CSV)
  → fetch() in csv.js
  → parseCSV() → array of { name, url, tags[] }
  → cached in store.data Map (keyed by sheet id)
  → filterRows() applies search + tag filters
  → render functions write to DOM
```

CSV is fetched once per sheet per session and cached in memory. A page refresh re-fetches.

### State management (store.js, ~20 lines)

A single mutable object, a setter that calls listeners, and `subscribe`. That's it.

This is deliberately not a class, not an event emitter, not Redux. The app has one consumer of state changes (`update()` in app.js) plus the router and search input sync. A pub/sub pattern with more ceremony would add code without adding clarity.

`setState` uses `Object.assign` — it merges partial updates, not deep copies. This means `activeTags` and `data` are replaced wholesale (new `Set` / new `Map`) on each update rather than mutated in place. This is intentional: it keeps the store dumb and avoids bugs where a subscriber sees stale references.

### Hash routing (router.js)

Format: `#sheetId/q=search&tags=tag1,tag2`

The `/` separator between sheet ID and params was chosen over `?` because everything after `#` is already a fragment — using `?` inside a fragment is legal but visually confusing. The `/` reads naturally.

The `lastHash` variable prevents an infinite loop: state change → hash update → hashchange event → state change → ... The router tracks the last hash it wrote and skips the hashchange handler if it matches.

### CSV parser (csv.js)

A character-by-character parser (~45 lines) rather than a simple `split(",")`. This exists because Google Sheets wraps the tags column in quotes when it contains commas (e.g., `"tools, resource, drawing"`), and a naive split would break those fields apart. The parser handles:

- Quoted fields (commas inside quotes)
- Escaped quotes (`""` inside a quoted field)
- `\r\n` line endings (Google Sheets uses these on some platforms)

A library like PapaParse would also work, but it's 20KB for something that takes 45 lines to do correctly for this specific data shape.

### Tag filtering uses AND logic

Selecting multiple tags shows entries that have **all** selected tags, not any of them. AND logic was chosen because the primary use case is narrowing: "show me things tagged both `tools` AND `drawing`." OR logic would widen results, which is less useful when you're already looking at everything.

Tag counts in the pill bar are computed from the full (unfiltered) dataset, not the currently visible results. This gives the user a sense of how large each category is overall, rather than showing counts that shrink as you filter.

### Search debounce is 150ms

The search input debounces at 150ms before updating state (and thus the hash). Without debounce, typing "paint" would push 5 hash changes into browser history. 150ms is fast enough to feel instant but slow enough to batch a typical keystroke sequence into one state change.

## File map

| File | Lines | Role |
|------|-------|------|
| `config.js` | 24 | Sheet declarations — the only file you edit to add data sources |
| `index.html` | 22 | App shell — five container elements, one CSS link, one JS module |
| `css/style.css` | 200 | All styles, CSS custom properties for theming |
| `js/app.js` | 122 | Entry point — filtering, data loading, event wiring |
| `js/csv.js` | 54 | Fetch + parse Google Sheets CSV |
| `js/store.js` | 19 | State object + subscribe |
| `js/router.js` | 51 | Hash ↔ state sync |
| `js/render.js` | 91 | All DOM rendering functions |

## Adding a new sheet

1. In your Google Sheet, go to **File > Share > Publish to web**
2. Select the tab you want, choose **CSV**, click Publish
3. Copy the URL
4. Add an entry to `config.js`:

```js
{ id: "mysheet", label: "My Sheet", csvUrl: "PASTE_URL_HERE" }
```

The `id` is used in the URL hash (keep it short, URL-safe). The `label` is what shows in the nav tabs.

Your sheet needs at least `name`, `url`, and `tags` columns. The `tags` column should be comma-separated values. Additional columns are parsed but not displayed.

## Running locally

ES modules require a server (browsers block `file://` module imports). Any static server works:

```sh
# pick one
python3 -m http.server           # from www/
npx serve                        # from www/
php -S localhost:8000             # from www/
```
