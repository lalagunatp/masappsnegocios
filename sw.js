/* ============================================================
   Service Worker — Totalplay Negocios | Guía de ventas
   VERSIÓN 6 — liga del buzón actualizada

   Qué hace: guarda una copia del sitio en el celular para que la
   app ABRA SIEMPRE, aunque la conexión de datos falle o titubee.

   Correcciones de la v2 respecto a la v1:
   1. Antes se guardaban todos los archivos "de golpe": si UNO solo
      faltaba en GitHub (por ejemplo un ícono), fallaba todo y no se
      guardaba NADA. Ahora se guarda uno por uno y los que fallen
      simplemente se omiten.
   2. Antes, si no había copia guardada y la red fallaba, se devolvía
      una respuesta vacía -> el navegador mostraba ERR_FAILED.
      Ahora SIEMPRE se devuelve algo: la copia guardada o, en el peor
      caso, una pantalla que explica qué pasó y permite reintentar.
   3. Ahora abre primero desde la copia guardada (instantáneo) y
      revisa actualizaciones en segundo plano, en vez de esperar
      a la red en cada apertura.

   Al publicar cambios, subir el número de CACHE_NAME (v2 -> v3...)
   para que los celulares ya instalados reciban la actualización.
   ============================================================ */

const CACHE_NAME = 'tp-negocios-v6';

/* Lo único imprescindible es el HTML. Los demás son opcionales:
   si alguno falta en GitHub, el sitio sigue funcionando igual. */
const ARCHIVO_PRINCIPAL = './index.html';
const ARCHIVOS_OPCIONALES = [
  './',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './img/manteleta-1-prev.jpg',
  './img/manteleta-2-prev.jpg',
  './img/manteleta-1.jpg',
  './img/manteleta-2.jpg'
];

/* Pantalla de respaldo: solo se ve si no hay copia guardada
   Y tampoco hay conexión. Nunca deja al usuario con un error seco. */
const PAGINA_RESPALDO = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#173049;color:#fdf3de;font-family:system-ui,sans-serif;padding:24px;text-align:center}
 .c{max-width:340px}
 h1{font-size:20px;margin:0 0 10px}
 p{font-size:14px;line-height:1.5;color:#b9c8d4;margin:0 0 20px}
 button{background:#ef5a3c;color:#fff;border:none;border-radius:12px;
        padding:13px 26px;font-size:15px;font-weight:700;cursor:pointer}
</style></head><body><div class="c">
<div style="font-size:44px;margin-bottom:12px">📡</div>
<h1>No hay conexión en este momento</h1>
<p>Revisa que tengas datos o WiFi activos y vuelve a intentar.
Una vez que abras la app con buena señal, quedará guardada en tu
celular y podrás abrirla aunque la conexión falle.</p>
<button onclick="location.reload()">Reintentar</button>
</div></body></html>`;

function respuestaRespaldo(){
  return new Response(PAGINA_RESPALDO, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/* -------- instalación: guarda la copia, tolerando faltantes -------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // el HTML es lo único que de verdad importa
      const principal = cache.add(ARCHIVO_PRINCIPAL)
        .catch(err => console.warn('No se pudo guardar index.html:', err));

      // los demás, uno por uno: si alguno falla, no arrastra a los otros
      const opcionales = ARCHIVOS_OPCIONALES.map(url =>
        cache.add(url).catch(() => console.warn('Archivo opcional no encontrado:', url))
      );

      return Promise.all([principal].concat(opcionales));
    }).then(() => self.skipWaiting())
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
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // El directorio de empleados SIEMPRE va en vivo a Google,
  // nunca se guarda aquí.
  if (url.hostname.indexOf('docs.google.com') !== -1 ||
      url.hostname.indexOf('script.google.com') !== -1 ||
      url.hostname.indexOf('script.googleusercontent.com') !== -1 ||
      url.hostname.indexOf('googleusercontent.com') !== -1) {
    return; // lo maneja el navegador normalmente
  }

  /* --- Abrir la app (navegación) ---
     Primero la copia guardada: abre al instante y no depende de la
     señal. En segundo plano se busca una versión más nueva.
     Si no hay copia guardada, se intenta la red; y si tampoco hay
     red, se muestra la pantalla de respaldo (NUNCA una respuesta
     vacía, que es lo que causaba ERR_FAILED). */
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(ARCHIVO_PRINCIPAL).then(guardada => {
        const desdeRed = fetch(req).then(res => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(ARCHIVO_PRINCIPAL, copia));
          }
          return res;
        }).catch(() => null);

        if (guardada) {
          desdeRed; // actualiza en segundo plano, sin bloquear
          return guardada;
        }
        return desdeRed.then(res => res || respuestaRespaldo());
      }).catch(() => respuestaRespaldo())
    );
    return;
  }

  /* --- Resto de archivos (íconos, fuentes) --- */
  event.respondWith(
    caches.match(req).then(guardada => {
      if (guardada) {
        fetch(req).then(res => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copia));
          }
        }).catch(() => {});
        return guardada;
      }
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => new Response('', { status: 504, statusText: 'Sin conexión' }));
    }).catch(() => new Response('', { status: 504, statusText: 'Sin conexión' }))
  );
});
