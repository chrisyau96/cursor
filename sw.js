// Offline-first service worker for the website only.
// The Play app unregisters this so an old v59/v62 cache cannot hide 63.0.8.
const CACHE = "habit-journal-63.0.8";

const ASSETS = [
  ".",
  "index.html",
  "manifest.webmanifest",
  "assets/css/styles.css",
  "assets/js/app.js",
  "assets/js/launch-core.js",
  "assets/js/launch.js",
  "assets/icon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-180.png",
  "assets/widgets/today.svg",
  "assets/widgets/habit.svg",
  "assets/widgets/habits.svg",
  "assets/widgets/streak.svg",
  "assets/widgets/credits.svg",
  "assets/widgets/gift.svg",
  "assets/widgets/journal.svg",
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
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return resp;
      })
      .catch(() => caches.match(req)),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
