export function renderBreadcrumb(sheetLabel, activeTag) {
  const sheetEl = document.getElementById("sheet-label");
  const tagEl = document.getElementById("tag-label");
  if (sheetEl) sheetEl.textContent = sheetLabel || "—";
  if (tagEl) tagEl.textContent = activeTag || "All";
}

// allTagCounts: Map<sheetId, {tag: count}> — pre-computed by getAllTagCounts() in app.js
export function renderTree(
  sheets,
  allTagCounts,
  activeSheet,
  activeTag,
  onSheetSwitch,
  onTagToggle,
) {
  const el = document.getElementById("tree");
  if (!el) return;
  el.innerHTML = "";

  sheets.forEach((sheet) => {
    const sheetDiv = document.createElement("div");
    sheetDiv.className = "tree-sheet";

    const sheetBtn = document.createElement("button");
    sheetBtn.className =
      "tree-sheet-btn" + (sheet.id === activeSheet ? " active" : "");
    sheetBtn.textContent = sheet.label;
    sheetBtn.addEventListener("click", () => onSheetSwitch(sheet.id));
    sheetDiv.appendChild(sheetBtn);

    const counts = allTagCounts.get(sheet.id);
    if (counts) {
      const tags = Object.keys(counts).sort();
      if (tags.length) {
        const tagList = document.createElement("div");
        tagList.className = "tree-tags";

        // "All" clears tag filter for this sheet
        const allBtn = document.createElement("button");
        const isAllActive = sheet.id === activeSheet && activeTag === null;
        allBtn.className = "tree-tag" + (isAllActive ? " active" : "");
        allBtn.innerHTML =
          'All<span class="tree-tag-count">' +
          Object.values(counts).reduce((a, b) => a + b, 0) +
          "</span>";
        allBtn.addEventListener("click", () => {
          if (sheet.id !== activeSheet) onSheetSwitch(sheet.id);
          onTagToggle(null);
        });
        tagList.appendChild(allBtn);

        tags.forEach((tag) => {
          const btn = document.createElement("button");
          const isActive = sheet.id === activeSheet && activeTag === tag;
          btn.className = "tree-tag" + (isActive ? " active" : "");
          btn.innerHTML =
            tag + `<span class="tree-tag-count">${counts[tag]}</span>`;
          btn.addEventListener("click", () => {
            if (sheet.id !== activeSheet) onSheetSwitch(sheet.id);
            onTagToggle(tag);
          });
          tagList.appendChild(btn);
        });
        sheetDiv.appendChild(tagList);
      }
    }

    el.appendChild(sheetDiv);
  });
}

export function renderNav(sheets, activeSheet, onSwitch) {
  const nav = document.getElementById("nav");
  nav.innerHTML = "";
  sheets.forEach((s) => {
    const btn = document.createElement("button");
    btn.textContent = s.label;
    btn.className = s.id === activeSheet ? "active" : "";
    btn.addEventListener("click", () => onSwitch(s.id));
    nav.appendChild(btn);
  });
}

export function renderTags(tagCounts, activeTags, onToggle) {
  const el = document.getElementById("tags");
  el.innerHTML = "";

  // "All" clears any active tag
  const allBtn = document.createElement("button");
  allBtn.className = "tag" + (activeTags.size === 0 ? " active" : "");
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => onToggle(null));
  el.appendChild(allBtn);

  const sorted = Object.keys(tagCounts).sort();
  sorted.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "tag" + (activeTags.has(tag) ? " active" : "");
    btn.innerHTML = tag + `<span class="tag-count">${tagCounts[tag]}</span>`;
    btn.addEventListener("click", () => onToggle(tag));
    el.appendChild(btn);
  });
}

export function renderResults(items, visibleColumns, onTagClick) {
  const el = document.getElementById("results");
  el.innerHTML = "";

  if (!items.length) {
    el.innerHTML = '<div class="empty">No results found.</div>';
    return;
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "entry";

    if (item._sheet) {
      const badge = document.createElement("span");
      badge.className = "entry-sheet-badge";
      badge.textContent = item._sheet;
      div.appendChild(badge);
    }
    visibleColumns.forEach((col) => {
      if (col === "name") {
        const name = document.createElement("div");
        name.className = "entry-name";
        if (item.url) {
          const a = document.createElement("a");
          a.href = item.url;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = item.name || item.url;
          name.appendChild(a);
        } else {
          name.textContent = item.name || "";
        }
        div.appendChild(name);
      } else if (col === "url") {
        const url = document.createElement("div");
        url.className = "entry-url";
        url.textContent = item.url || "";
        div.appendChild(url);
      } else if (col === "tags") {
        if (item.tags && item.tags.length) {
          const tags = document.createElement("div");
          tags.className = "entry-tags";
          item.tags.forEach((t) => {
            const btn = document.createElement("button");
            btn.className = "tag";
            btn.textContent = t;
            btn.addEventListener("click", () => onTagClick(t));
            tags.appendChild(btn);
          });
          div.appendChild(tags);
        }
      } else {
        const val = item[col];
        if (val) {
          const field = document.createElement("div");
          field.className = "entry-field";
          const label = document.createElement("span");
          label.className = "field-label";
          label.textContent = col + ": ";
          const value = document.createElement("span");
          value.className = "field-value";
          value.textContent = val;
          field.appendChild(label);
          field.appendChild(value);
          div.appendChild(field);
        }
      }
    });

    el.appendChild(div);
  });
}

export function renderStatus(shown, total) {
  const el = document.getElementById("status");
  if (total === null) {
    el.textContent =
      shown === 1 ? "1 result" : `${shown} results across all sheets`;
  } else if (shown === total) {
    el.textContent = `${total} items`;
  } else {
    el.textContent = `${shown} of ${total} items`;
  }
}

export function renderLoading() {
  document.getElementById("results").innerHTML =
    '<div class="loading">Loading...</div>';
  document.getElementById("tags").innerHTML = "";
  document.getElementById("status").textContent = "";
}

export function renderError(msg) {
  document.getElementById("results").innerHTML =
    `<div class="error">${msg}</div>`;
  document.getElementById("tags").innerHTML = "";
  document.getElementById("status").textContent = "";
}
