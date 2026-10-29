/**
 * Genera `tests/baseline/d1-datos.json`: una base de D1 con datos como los de
 * hoy en TODAS las tablas (contenido del repositorio, datos de prueba del panel,
 * usuarios, asistente, inventario…), volcada fila a fila. El test
 * `tests/baseline/d1.test.ts` la carga en una D1 vacía con el esquema de su
 * versión, aplica las migraciones nuevas y comprueba que no se pierde nada.
 *
 * No usa datos de producción: todo es sintético (correos en example.com).
 * Solo se regenera cuando se quiere una referencia nueva y en un PR propio:
 *   npx tsx scripts/baseline/generar-d1.ts
 */
import { writeFile } from 'node:fs/promises';
import { leerContenido } from '../contenido/archivos.mjs';
import { importarContenido, type EntradaImportada } from '../../src/server/contenido/importacion.ts';
import { VERSION_ESQUEMA } from '../../src/server/data/d1/migraciones.ts';
import { cargarDatosPrueba } from '../../src/server/panel/pruebas.ts';
import { moverInventario } from '../../src/server/panel/inventario.ts';
import { getPlatformProxy } from 'wrangler';
import type { BaseD1 } from '../../src/server/data/d1/base.ts';
import { crearRepositoriosD1, asegurarEsquema } from '../../src/server/data/index.ts';

const SALIDA = 'tests/baseline/d1-datos.json';
const yo = 'propietario@example.com';
const hoy = new Date().toISOString().slice(0, 10);

// D1 local en memoria (entorno `desarrollo`): no toca recursos reales.
const p = await getPlatformProxy<{ DB: BaseD1 }>({
  environment: 'desarrollo',
  persist: false,
});
const db = p.env.DB;
try {
  await asegurarEsquema(db);
  const repos = crearRepositoriosD1(db);
  const { entradas, fotos } = await leerContenido(process.cwd());
  // Fotos recortadas: basta con que la tabla tenga filas con bytes.
  for (const f of fotos) await repos.fotos.guardar({ ruta: f.ruta, tipo: 'image/jpeg', bytes: f.bytes.slice(0, 64) }, yo);
  const lista = entradas.map((e) => ({
    coleccion: e.coleccion,
    id: e.id,
    documento: { datos: e.datos, cuerpo: e.cuerpo },
  })) as EntradaImportada[];
  const informe = await importarContenido(repos, lista, new Set(fotos.map((f) => f.ruta)), yo);
  if (!informe.importadas) throw new Error(`Importación rechazada: ${JSON.stringify(informe)}`);

  await repos.usuarios.guardar({
    email: yo,
    nombre: 'Propietario de prueba',
    rol: 'propietario',
    activo: true,
  });
  await repos.usuarios.guardar({
    email: 'gerente@example.com',
    nombre: 'Gerente de prueba',
    rol: 'gerente',
    activo: true,
  });
  await repos.usuarios.guardar({
    email: 'editor@example.com',
    nombre: '',
    rol: 'editor',
    activo: false,
  });

  await cargarDatosPrueba(repos, yo, hoy);
  for (const m of [
    { tipo: 'entrada', cantidad: 40, motivo: 'Producción propia' },
    {
      tipo: 'baja',
      cantidad: 2,
      motivo: 'Otro motivo',
      nota: 'Rota al cargar',
    },
  ] as const) {
    const r = await moverInventario(repos, 'yucca-elephantipes', m, yo);
    if (!r.ok) throw new Error(r.error);
  }

  await repos.publicaciones.registrar(yo, 'lanzada', 'prueba');
  await repos.usoAsistente.sumar(yo, hoy, 120);
  await repos.tickets.guardar(
    {
      id: 'ticket-base',
      tipo: 'image/jpeg',
      bytes: new Uint8Array([255, 216, 255, 224, 1, 2, 3]),
    },
    yo,
  );
  const conversacion = await repos.conversaciones.nueva(yo);
  await repos.conversaciones.anadir({
    conversacion,
    rol: 'usuario',
    texto: 'Sube un 5 % las palmeras',
    propuestas: [],
  });
  await repos.conversaciones.guardarPropuesta({
    id: 'propuesta-base',
    conversacion,
    email: yo,
    herramienta: 'cambiar_plantas',
    argumentos: { familia: 'palmeras', ajustePrecio: { porcentaje: 5 } },
    resumen: 'Subir un 5 % las palmeras',
    estado: 'pendiente',
    resultado: '',
    creada: new Date().toISOString(),
  });
  await repos.conversaciones.anadir({
    conversacion,
    rol: 'asistente',
    texto: 'Pulsa «Sí» para aplicarlo.',
    propuestas: ['propuesta-base'],
  });

  const tablas = (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{ name: string }>()).results.map(
    (t) => t.name,
  );
  const volcado: Record<string, Record<string, unknown>[]> = {};
  for (const t of tablas) {
    const filas = (await db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all<Record<string, unknown>>()).results;
    volcado[t] = filas.map((f) =>
      Object.fromEntries(
        Object.entries(f).map(([k, v]) => [k, v instanceof ArrayBuffer || ArrayBuffer.isView(v) || Array.isArray(v) ? { $blob: Buffer.from(v as ArrayBuffer).toString('base64') } : v]),
      ),
    );
  }
  const vacias = tablas.filter((t) => !volcado[t].length);
  if (vacias.length) throw new Error(`Tablas sin datos (añádelos al generador): ${vacias.join(', ')}`);
  await writeFile(SALIDA, `${JSON.stringify({ version: VERSION_ESQUEMA, generado: hoy, tablas: volcado }, null, 1)}\n`);
  console.log(`${SALIDA}: versión ${VERSION_ESQUEMA}, ${tablas.length} tablas, ${Object.values(volcado).reduce((t, f) => t + f.length, 0)} filas`);
} finally {
  await p.dispose();
}
