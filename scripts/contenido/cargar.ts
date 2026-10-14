/** Carga entradas y fotos en D1: la local (desarrollo) o la real a través del Worker (con CONTENIDO_TOKEN). */
import { importarContenido, type EntradaImportada, type InformeImportacion } from '../../src/server/contenido/importacion.ts';
import { esRutaFotoValida } from '../../src/server/contenido/validacion.ts';
import { reposLocales } from './plataforma.ts';

const tipoDe = (ruta: string) => (ruta.endsWith('.png') ? 'image/png' : ruta.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

export async function cargar(entradas: EntradaImportada[], fotos: { ruta: string; bytes: Uint8Array }[], url?: string): Promise<InformeImportacion> {
  const validas = fotos.filter((f) => esRutaFotoValida(f.ruta));
  if (url) {
    const token = process.env.CONTENIDO_TOKEN;
    if (!token) throw new Error('Falta la variable CONTENIDO_TOKEN');
    const cabeceras = { Authorization: `Bearer ${token}` };
    for (const f of validas) {
      const r = await fetch(new URL(`/api/contenido/foto?ruta=${encodeURIComponent(f.ruta)}`, url), { method: 'PUT', headers: cabeceras, body: new Blob([f.bytes as Uint8Array<ArrayBuffer>]) });
      if (!r.ok) throw new Error(`No se pudo subir ${f.ruta}: ${r.status} ${await r.text()}`);
    }
    const r = await fetch(new URL('/api/contenido/importacion', url), {
      method: 'POST',
      headers: { ...cabeceras, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entradas }),
    });
    const informe = (await r.json().catch(() => ({ importadas: 0, errores: [{ coleccion: '', id: '', errores: [{ campo: '', mensaje: `HTTP ${r.status}` }] }], fotosQueFaltan: [] }))) as InformeImportacion;
    return informe;
  }
  const { repos, cerrar } = await reposLocales();
  try {
    for (const f of validas) await repos.fotos.guardar({ ruta: f.ruta, tipo: tipoDe(f.ruta), bytes: f.bytes }, 'importacion');
    return await importarContenido(repos, entradas, new Set(validas.map((f) => f.ruta)), 'importacion');
  } finally {
    await cerrar();
  }
}
