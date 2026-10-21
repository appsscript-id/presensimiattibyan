// Service worker Presensi MI At Tibyan
// Naikkan angka versi (mi-absen-v2, v3, ...) bila ingin memaksa HP mengambil file baru.
var CACHE = "mi-absen-v1";
var FILES = [
  "./", "./index.html", "./manifest.json", "./logo.png",
  "./icon-192.png", "./icon-512.png", "./bunyi.mp3", "./masuk.mp3", "./salam.mp3"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // file yang belum ada (mis. mp3) dilewati, tidak menggagalkan instalasi
      return Promise.all(FILES.map(function (f) { return c.add(f).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf("mi-") === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Hanya file aplikasi (satu domain, GET). Apps Script, CDN face-api, dan suara online tidak disentuh.
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200) {
        var salinan = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, salinan); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match("./index.html"); });
    })
  );
});

// ---------- NOTIFIKASI PUSH (pengingat murid belum diabsen) ----------
// Server (Apps Script) mengirim pesan data-saja lewat FCM: { judul, isi, url }.
// Bentuk payload dari FCM: { data: {...} } atau langsung objek datar; keduanya ditangani.
self.addEventListener("push", function (e) {
  var d = {};
  try {
    var j = e.data ? e.data.json() : {};
    d = (j && j.data) || (j && j.notification) || j || {};
  } catch (err) {
    try { d = { isi: e.data.text() }; } catch (e2) {}
  }
  var judul = d.judul || d.title || "Presensi MI At Tibyan";
  e.waitUntil(self.registration.showNotification(judul, {
    body: d.isi || d.body || "",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: d.tag || "absen-pengingat",   // notifikasi baru menggantikan yang lama, tidak menumpuk
    renotify: true,
    vibrate: [400, 200, 400],          // getar 2 kali (Android)
    data: { url: d.url || "./index.html" }
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var tujuan = new URL((e.notification.data && e.notification.data.url) || "./index.html", self.location.href).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.registration.scope) === 0 && "focus" in list[i]) return list[i].focus();
      }
      return self.clients.openWindow(tujuan);
    })
  );
});
