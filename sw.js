/* Bump CACHE whenever you edit index.html, then reload twice on each phone.
   Keep the number the same as APP_VERSION in index.html — that is the one
   shown in the corner of the menu. */
const CACHE = 'jh-clock-v79';
const FILES = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png', './logo.png',
  './archivo-var.woff2', './junkheroes-bold.woff2', './junkheroes-medium.woff2', './barlow-cond-700.woff2'
];
// How long to wait for GitHub before opening the saved copy instead
const WAIT_MS = 5000;
const SLOW = {};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Never cache punch uploads — they must hit the network or fail loudly.
  if (req.method !== 'GET' || req.url.includes('script.google.com')) return;

  // A fresh copy, saved for next time. It keeps downloading in the background
  // even after a saved copy has already been shown.
  const fresh = fetch(req).then(res => {
    // only a good answer replaces the saved copy — a 404 mid-upload must not
    if (!res.ok) return res;
    const copy = res.clone();
    // wait for the whole file, not just the first byte: a line that answers
    // and then crawls is just as slow
    return copy.clone().arrayBuffer()
      .then(() => caches.open(CACHE))
      .then(c => c.put(req, copy))
      .catch(() => {})
      .then(() => res);
  });
  e.waitUntil(fresh.catch(() => {}));

  // Fonts and pictures only change with a release, and every release saves
  // fresh ones as it installs, so the saved copy opens straight away.
  if (req.mode !== 'navigate') {
    e.respondWith(caches.match(req).then(hit => hit || fresh));
    return;
  }

  // The page itself: network first so edits show up, but only for WAIT_MS. One
  // bar at a job site can leave a request hanging for a minute before it fails,
  // and the crew shouldn't stare at a white screen for that. After WAIT_MS the
  // copy saved on the phone opens, and the next open gets the fresh one.
  const saved = () => caches.match(req).then(hit => hit || caches.match('./index.html'));
  const slow = new Promise(resolve => setTimeout(resolve, WAIT_MS, SLOW));
  e.respondWith(
    Promise.race([fresh.catch(() => SLOW), slow])
      .then(won => {
        if (won !== SLOW) return won;
        // too slow or no signal: the saved copy, or keep waiting if there is none
        return saved().then(hit => hit || fresh);
      })
      .catch(() => saved())
  );
});
