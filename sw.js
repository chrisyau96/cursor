// Minimal offline-first service worker for the Momentum PWA.
// Caches the app shell + assets so it launches instantly and works offline.
// Cross-origin requests (Google sign-in / Drive API) always go to the network.
const CACHE = "momentum-v2";

// Paths are relative so the app also works when hosted under a subpath
// (e.g. GitHub Pages project sites like /repo/).
const ASSETS = [
  ".",
  "index.html",
  "manifest.webmanifest",
  "assets/icon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-180.png",
  "assets/css/styles.css",
  "assets/js/app.js",
  "assets/js/store.js",
  "assets/js/gamify.js",
  "assets/js/drive.js",
  "assets/js/utils.js",
  "assets/js/charts.js",
  "assets/js/habitForm.js",
  "assets/js/views/today.js",
  "assets/js/views/calendar.js",
  "assets/js/views/reports.js",
  "assets/js/views/rewards.js",
  "assets/js/views/settings.js",
  "assets/js/views/sheets.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle same-origin GET requests; let Google APIs pass straight through.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === "basic") {
            const copy = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
