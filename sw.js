/* ============================================================
   Service Worker — Totalplay Negocios | Guía de ventas

   Su única función es guardar una copia del sitio en el celular,
   para que la página ABRA SIEMPRE aunque la conexión falle o
   titubee (típico con datos móviles). Sin esto, cada vez que se
   abre la liga el celular tiene que alcanzar GitHub, y si la red
   falla un instante, no abre.

   IMPORTANTE: la validación del número de empleado NO se guarda
   aquí. La hoja de Google siempre se consulta en vivo (y el propio
   HTML guarda su copia del directorio por separado).

   Al publicar cambios, subir la versión de CACHE_NAME (v1 -> v2...)
   para que los celulares ya instalados reciban la actualización.
   ============================================================ */

const CACHE_NAME = 'tp-negocios-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

/* -------- instalación: guarda la copia local -------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('Precarga parcial:', err))
  );
});

/* -------- activación: borra versiones viejas -------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* -------- peticiones -------- */
self.addEventListener('fetch', event => {
  const req = event.request;

  // solo GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // NUNCA guardar la consulta del directorio de empleados:
  // siempre debe ir en vivo a Google.
  if (url.hostname.indexOf('docs.google.com') !== -1 ||
      url.hostname.indexOf('googleusercontent.com') !== -1) {
    return; // que lo maneje el navegador normalmente
  }

  // Navegación (abrir la app): primero red, y si falla, la copia
  // guardada. Así siempre abre, con o sin buena señal.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Resto de archivos (íconos, fuentes): primero la copia guardada
  // para que abra rápido, y se actualiza en segundo plano.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
