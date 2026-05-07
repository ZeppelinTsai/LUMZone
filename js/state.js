// ── State ─────────────────────────────────────────────────────────────────────
let sessions = [];
let currentSessionId = null;
let lastSourceBySid = new Map();

// ── LocalStorage ──────────────────────────────────────────────────────────────
function saveSessions() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn("localStorage save failed", e);
  }
}
function loadSessions() {
  try {
    const r = localStorage.getItem(LS_KEY);
    if (r) sessions = JSON.parse(r);
  } catch (e) {
    sessions = [];
  }
}
function getSession(id) {
  return sessions.find((s) => s.id === id);
}
function deleteSession(id) {
  sessions = sessions.filter((s) => s.id !== id);
  saveSessions();
}
