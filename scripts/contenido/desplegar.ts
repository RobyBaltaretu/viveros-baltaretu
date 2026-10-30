/**
 * Comando de despliegue de Workers Builds (`npm run desplegar`). Publica solo
 * los cambios del panel: si este build incluye publicaciones pendientes, lo
 * despliega y las marca como en la web; si no, sube una versión para que el
 * propietario la apruebe (ver `modoDespliegue`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { MARCA_DESCARGA, modoDespliegue } from './desplegar-comun.ts';
import { clienteActual } from '../../src/plataforma/actual.ts';

const token = process.env.CONTENIDO_TOKEN;
const url = process.env.CONTENIDO_URL || process.env.SITE_URL;
const cabeceras = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

let hasta: string | null = null;
let pendientes = 0;
if (token && url && existsSync(MARCA_DESCARGA)) {
  hasta = (JSON.parse(readFileSync(MARCA_DESCARGA, 'utf8')) as { hasta: string }).hasta;
  const r = await fetch(new URL(`/api/contenido/publicacion?hasta=${encodeURIComponent(hasta)}`, url), { headers: cabeceras });
  if (r.ok) pendientes = ((await r.json()) as { pendientes: number }).pendientes;
  else console.warn(`[desplegar] No se pudo consultar las publicaciones (${r.status}); se sube como versión.`);
}

const cliente = clienteActual();
const configArgs = cliente.cloudflare.wrangler ? ['-c', cliente.cloudflare.wrangler] : [];

const modo = modoDespliegue(pendientes, process.env.PUBLICAR_SIEMPRE);
console.log(modo === 'desplegar' ? `[desplegar] ${pendientes} publicaciones del panel: se publica en la web.` : '[desplegar] Sin publicaciones del panel: se sube una versión para aprobarla en Cloudflare.');
execFileSync('npx', ['wrangler', ...configArgs, ...(modo === 'desplegar' ? ['deploy'] : ['versions', 'upload'])], { stdio: 'inherit' });

if (modo === 'desplegar' && hasta) {
  const r = await fetch(new URL('/api/contenido/publicacion', url), { method: 'POST', headers: cabeceras, body: JSON.stringify({ hasta }) });
  console.log(r.ok ? '[desplegar] Publicaciones marcadas como en la web.' : `[desplegar] Desplegado, pero no se pudo marcar (${r.status}).`);
}
