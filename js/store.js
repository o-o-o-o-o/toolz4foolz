const state = {
  activeSheet: null,
  searchQuery: '',
  activeTags: new Set(),
  data: new Map(),
};

const listeners = [];

export function getState() { return state; }

export function setState(partial) {
  Object.assign(state, partial);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.push(fn);
}
