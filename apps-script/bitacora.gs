/**
 * BITÁCORA DE ACCESOS — masappsnegocios (archivo BASE LA LAGUNA 2026)
 * ============================================================
 * Pestaña "BITACORA NEGOCIOS": registro vivo de quién entra y cuándo
 * a la app. Todo lo de más de 45 días se borra solo (ver
 * limpiarBitacoraAntigua).
 *
 * La pestaña "HISTORICO" es aparte: ahí se pega A MANO, una sola vez,
 * lo viejo que se quiera conservar para siempre. Este script nunca la
 * lee ni la toca — así el historial no se pierde aunque la bitácora
 * viva se vaya limpiando cada 45 días.
 *
 * ---- IMPORTANTE: proyecto NUEVO e independiente ----
 * BASE LA LAGUNA 2026 ya tiene un Apps Script sirviendo el login
 * compartido (número + PIN de todas las apps de la carpeta de
 * ventas). Un proyecto de Apps Script solo puede tener UN doGet: si
 * pegas este código en "Extensiones → Apps Script" de esa hoja (el
 * proyecto que ya existe), le pisas el doGet del login y se cae el
 * acceso para TODAS las apps, no solo para esta.
 *
 * Por eso este script abre la hoja por su ID (openById) en vez de
 * usar getActiveSpreadsheet(): así puede vivir en un proyecto
 * completamente aparte, con su propia URL /exec, sin tocar el
 * proyecto del login.
 *
 * ---- CÓMO INSTALARLO ----
 * 1. Ve a https://script.google.com → "Proyecto nuevo" (NO uses
 *    "Extensiones → Apps Script" desde la hoja de cálculo).
 * 2. Pega este archivo completo.
 * 3. La primera vez que lo ejecutes o despliegues te va a pedir
 *    autorización para abrir la hoja: usa la cuenta que tiene acceso
 *    de edición a BASE LA LAGUNA 2026.
 * 4. En la hoja ya creaste "BITACORA NEGOCIOS" e "HISTORICO" — el
 *    script pondrá los encabezados solo en "BITACORA NEGOCIOS" si
 *    están vacíos, en su primer registro.
 * 5. Si "BITACORA NEGOCIOS" tiene protección/candado (como las demás
 *    pestañas de este archivo), agrega como editor a la cuenta con la
 *    que vas a desplegar el script, o quítale la protección a esa
 *    pestaña — si no, el script no va a poder escribir en ella.
 * 6. Implementar → Nueva implementación → Tipo "Aplicación web" →
 *    Ejecutar como "Yo" → Quién tiene acceso "Cualquier usuario" →
 *    Implementar. Copia la URL que termina en /exec.
 * 7. Activadores (ícono de reloj, panel izquierdo de este proyecto
 *    NUEVO) → Añadir activador → función "limpiarBitacoraAntigua" →
 *    evento "Basado en tiempo" → "Temporizador de día" → la hora que
 *    prefieras → Guardar.
 * 8. Manda esa URL /exec de vuelta: se pega en una sola línea del
 *    index.html (la llamada a "fn:'registrar'" y "fn:'bitacora'" que
 *    hoy usan BUZON_URL) sin tocar nada más de la app.
 * ============================================================
 */

const ID_HOJA = '1Ph5T-m-Lkbdw1LBq-9wIIMW6C8bljOG1t5GfZQhNZ2o'; // BASE LA LAGUNA 2026
const HOJA_BITACORA = 'BITACORA NEGOCIOS';
const DIAS_RETENCION = 45;

function doGet(e){
  const p = e.parameter || {};
  let resultado;
  try{
    switch(p.fn){
      case 'registrar': resultado = registrar(p); break;
      case 'bitacora':  resultado = leerBitacora(); break;
      default: resultado = { ok:false, error:'fn desconocida' };
    }
  } catch(err){
    resultado = { ok:false, error:String(err) };
  }
  const texto = JSON.stringify(resultado);
  const salida = p.callback ? (p.callback + '(' + texto + ')') : texto;
  return ContentService.createTextOutput(salida)
    .setMimeType(p.callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function hojaBitacora_(){
  const ss = SpreadsheetApp.openById(ID_HOJA);
  let hoja = ss.getSheetByName(HOJA_BITACORA);
  if(!hoja){
    hoja = ss.insertSheet(HOJA_BITACORA);
  }
  if(hoja.getLastRow() === 0){
    hoja.appendRow(['Numero', 'Nombre', 'Puesto', 'Distrito', 'Fecha']);
  }
  return hoja;
}

/* Anota un acceso. Recibe num/nombre/puesto/distrito igual que hoy
   manda anotarAcceso() desde el index.html. */
function registrar(p){
  if(!p.num) return { ok:false, error:'falta num' };
  const hoja = hojaBitacora_();
  hoja.appendRow([
    String(p.num || ''),
    String(p.nombre || ''),
    String(p.puesto || ''),
    String(p.distrito || ''),
    new Date()
  ]);
  return { ok:true };
}

/* Devuelve, por número de empleado, cuándo entró por última vez y
   cuántas veces — la misma forma que ya espera traerBitacora() /
   pintarEquipo() en el index.html (BITACORA[num] = {ultimo, veces}). */
function leerBitacora(){
  const hoja = hojaBitacora_();
  const filas = hoja.getDataRange().getValues();
  filas.shift(); // encabezado
  const porNumero = {};
  filas.forEach(function(f){
    const num = String(f[0] || '').trim();
    if(!num) return;
    const fecha = f[4] instanceof Date ? f[4] : new Date(f[4]);
    if(!porNumero[num]) porNumero[num] = { num: num, ultimo: fecha, veces: 0 };
    porNumero[num].veces++;
    if(fecha > porNumero[num].ultimo) porNumero[num].ultimo = fecha;
  });
  const datos = Object.keys(porNumero).map(function(k){
    const d = porNumero[k];
    return { num: d.num, ultimo: d.ultimo.toISOString(), veces: d.veces };
  });
  return { ok:true, datos: datos };
}

/* Borra de "BITACORA NEGOCIOS" todo lo de más de 45 días. Se instala
   como disparador de tiempo (paso 7 de arriba) para que corra solo,
   todos los días, sin que nadie tenga que acordarse de hacerlo a
   mano. Nunca toca "HISTORICO". */
function limpiarBitacoraAntigua(){
  const hoja = hojaBitacora_();
  const filas = hoja.getDataRange().getValues();
  const limite = new Date(Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000);
  // de abajo hacia arriba, para no desfasar los índices al borrar filas
  for(let i = filas.length - 1; i >= 1; i--){
    const fecha = filas[i][4] instanceof Date ? filas[i][4] : new Date(filas[i][4]);
    if(fecha < limite) hoja.deleteRow(i + 1);
  }
}
