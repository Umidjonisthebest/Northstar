// Some browsers refuse site storage (blocked site data, certain private modes, sandboxed frames):
// there, even reading `window.localStorage` throws, and the app has ~60 places that use it. Rather
// than guard every one, a refused store is replaced by an in-memory one for this tab. Nothing is
// remembered across reloads in that case, but nothing crashes either.
function usable(name) {
  try {
    const store = window[name];
    const probe = "__northstar_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function memoryStore() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(String(k)) ? data.get(String(k)) : null),
    setItem: (k, v) => void data.set(String(k), String(v)),
    removeItem: (k) => void data.delete(String(k)),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    }
  };
}

for (const name of ["localStorage", "sessionStorage"]) {
  if (usable(name)) continue;
  try {
    Object.defineProperty(window, name, { value: memoryStore(), configurable: true });
  } catch {
    // The property can't be replaced here; the app's own try/catch guards still apply.
  }
}
