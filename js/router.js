import { getState, setState, subscribe } from './store.js';

let lastHash = '';

export function parseHash(hash) {
  const clean = hash.replace(/^#/, '');
  const [sheet, paramString] = clean.split('/', 2);
  const params = new URLSearchParams(paramString || '');
  return {
    sheet: sheet || null,
    query: params.get('q') || '',
    tags: params.get('tags') ? params.get('tags').split(',').map(t => t.trim()) : [],
  };
}

export function buildHash({ sheet, query, tags }) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (tags.length) params.set('tags', tags.join(','));
  const paramStr = params.toString();
  return '#' + sheet + (paramStr ? '/' + paramStr : '');
}

function syncHashToState() {
  const hash = location.hash;
  if (hash === lastHash) return;
  const { sheet, query, tags } = parseHash(hash);
  setState({
    activeSheet: sheet,
    searchQuery: query,
    activeTags: new Set(tags),
  });
}

function syncStateToHash(state) {
  if (!state.activeSheet) return;
  const hash = buildHash({
    sheet: state.activeSheet,
    query: state.searchQuery,
    tags: [...state.activeTags],
  });
  if (hash !== location.hash) {
    lastHash = hash;
    location.hash = hash;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', syncHashToState);
  subscribe(syncStateToHash);
}
