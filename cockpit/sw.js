// Cockpit-App: Benachrichtigungen und Start ohne Netz. Die Daten bleiben verschlüsselt (data.json);
// lesbar werden sie erst mit deinem Passwort im Cockpit selbst.
const CACHE = "cockpit-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Netz zuerst; im Funkloch die letzte geladene Fassung von Seite und Daten
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url), scope = new URL(self.registration.scope);
  if (req.method !== "GET" || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  // nur das Cockpit selbst (nicht Seiten darin wie die Tischbuch-Ansicht) gilt als Startseite
  const startseite = url.pathname === scope.pathname || url.pathname === scope.pathname + "index.html";
  const schluessel = req.mode === "navigate" && startseite ? scope.pathname : /data\.json$/.test(url.pathname) ? url.pathname : null;
  if (!schluessel) return;
  e.respondWith(fetch(req).then((r) => {
    if (r.ok) { const kopie = r.clone(); e.waitUntil(caches.open(CACHE).then((c) => c.put(schluessel, kopie))); }
    return r;
  }).catch(() => caches.open(CACHE).then((c) => c.match(schluessel)).then((r) => r || Response.error())));
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titel: "Cockpit", text: e.data ? e.data.text() : "" }; }
  const opt = { body: d.text || "", icon: "icon-192.png", badge: "badge-96.png", data: { url: d.url || "./" }, lang: "de" };
  if (d.tag) { opt.tag = d.tag; opt.renotify = true; }
  if (d.dringend) opt.vibrate = [70, 50, 70];
  e.waitUntil(self.registration.showNotification(d.titel || "Cockpit", opt));
});

// Tipp auf die Benachrichtigung: offenes Cockpit nach vorn holen und an die passende Stelle springen
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const ziel = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope);
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
    const offen = fenster.find((c) => c.frameType !== "nested" && c.url.startsWith(self.registration.scope) && !c.url.includes("/tischbuch-"));
    if (offen) { offen.postMessage({ typ: "ziel", hash: ziel.hash }); return offen.focus(); }
    return self.clients.openWindow(ziel.href);
  }));
});
