// PWA update policy:
//  - look for a new version on launch, every 10 minutes, and whenever the app comes back to the foreground
//  - a new version is downloaded in the background but only ACTIVATED when no game is in progress
export function initUpdater(isSafe, onApply) {
  const st = { supported: false, checks: 0, pending: false, applying: false };
  const api = { st, check() { }, tryApply() { return false; } };
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return api;
  st.supported = true;
  let reg = null;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (st.applying) location.reload(); });
  api.tryApply = () => {
    if (!reg || !reg.waiting || !navigator.serviceWorker.controller) return false;
    st.pending = true;
    if (st.applying || !isSafe()) return false; // never update in the middle of a game
    st.applying = true;
    if (onApply) onApply();
    reg.waiting.postMessage('SKIP_WAITING');
    return true;
  };
  api.check = () => {
    st.checks++;
    if (reg) reg.update().catch(() => { });
    api.tryApply();
  };
  navigator.serviceWorker.register('./sw.js').then(r => {
    reg = r;
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') api.tryApply(); });
    });
    api.check();
  }).catch(() => { });
  setInterval(api.check, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') api.check(); });
  window.addEventListener('online', api.check);
  return api;
}
