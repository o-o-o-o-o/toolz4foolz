# sheets2filtersite — Implementation Plan

## Context

Build a personal links/bookmarks site that pulls data from a Google Sheet (published as CSV) and presents it as a searchable, filterable website. Each sheet tab becomes a page. Zero dependencies, zero build tools — vanilla HTML/CSS/JS.

## Architecture

Single HTML page with hash-based routing. All state (active page, search query, active tags) encoded in URL hash so every view is bookmarkable.

Hash format: `#sheetId/q=search&tags=tag1,tag2`

## File Structure

```
www/
  index.html       — App shell
  css/style.css    — All styles
  js/config.js     — Sheet declarations (edit to add sheets)
  js/app.js        — Entry point
  js/router.js     — Hash ↔ state
  js/csv.js        — Fetch + parse CSV
  js/store.js      — State + subscribe
  js/render.js     — DOM rendering
  docs/PLAN.md     — This file
  docs/TODO.md     — Build progress tracking
```

## Key Decisions

- **Data source**: Google Sheets published as CSV (no API key needed)
- **Routing**: Hash-based with filter state (`#page/q=x&tags=a,b`)
- **Tag filtering**: AND logic (multiple tags = must have all)
- **Search**: Case-insensitive substring on name
- **Styling**: CSS custom properties for theming, system fonts, 860px max-width
