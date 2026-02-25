export const CONFIG = {
  title: "sheets2filtersite",
  info: "A curated collection of tools and resources, sourced from Google Sheets.",
  pollInterval: 5 * 60 * 1000, // ms between background refreshes (0 to disable)

  // Column display defaults (applied to all sheets; can be overridden per sheet).
  // include: null shows all columns; set to an array to show only those columns.
  // exclude: always-hidden columns (applied after include).
  columns: {
    include: null, // e.g. ['name', 'url', 'category', 'tags']
    exclude: [], // e.g. ['internal_notes']
  },

  sheets: [
    // Add your sheets here. To get the csvUrl:
    // 1. Open your Google Sheet
    // 2. File > Share > Publish to web
    // 3. Select the tab and "Comma-separated values (.csv)"
    // 4. Copy the URL
    //
    // { id: "webtools", label: "Web Tools", csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv" },
    {
      id: "tools",
      label: "Tools",
      csvUrl:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vRy4xQfSm3ZjdtrjYoavc8sBIpGjj_zxJ4bhYBzDJ1g1UzE28FRUwPL9lkoNRwd4Q/pub?gid=183940277&single=true&output=csv",
    },
    {
      id: "imgresources",
      label: "Image Resources",
      csvUrl:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vRy4xQfSm3ZjdtrjYoavc8sBIpGjj_zxJ4bhYBzDJ1g1UzE28FRUwPL9lkoNRwd4Q/pub?gid=423591686&single=true&output=csv",
    },
  ],
};
