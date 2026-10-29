/**
 * Red de seguridad de la base de datos de Viveros Baltaretu:
 * 1. Instantánea del esquema (tablas, columnas, índices y versión). Si cambia,
 *    el PR debe explicar por qué: los cambios solo pueden ser aditivos.
 * 2. Una base con datos como los de hoy (`d1-datos.json`, ver
 *    `scripts/baseline/generar-d1.ts`) migra a la última versión sin perder ni
 *    cambiar ninguna fila ni columna.
 */
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BaseD1 } from '../../src/server/data/d1/base.ts';
import { aplicarMigraciones, MIGRACIONES, VERSION_ESQUEMA } from '../../src/server/data/d1/migraciones.ts';
import { d1DePrueba } from '../panel/d1.ts';

type Fila = Record<string, unknown>;
const NO_PROPIAS = "name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'";
const comoTexto = (v: unknown) => (v instanceof ArrayBuffer || ArrayBuffer.isView(v) || Array.isArray(v) ? { $blob: Buffer.from(v as ArrayBuffer).toString('base64') } : v);
const comoValor = (v: unknown) => (v && typeof v === 'object' && '$blob' in v ? new Uint8Array(Buffer.from(String(v.$blob), 'base64')) : v);

async function esquemaDe(db: BaseD1) {
  const objetos = (await db.prepare(`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE ${NO_PROPIAS} ORDER BY type, name`).all<Fila>()).results;
  const tablas: Record<string, unknown> = {};
  for (const o of objetos.filter((o) => o.type === 'table')) {
    const columnas = (await db.prepare(`PRAGMA table_info(${o.name})`).all<Fila>()).results.map((c) => ({
      nombre: c.name,
      tipo: c.type,
      obligatoria: !!c.notnull,
      porDefecto: c.dflt_value,
      clave: c.pk,
    }));
    tablas[String(o.name)] = {
      columnas,
      sql: String(o.sql).replace(/\s+/g, ' '),
    };
  }
  const indices = objetos
    .filter((o) => o.type === 'index')
    .map((o) => ({
      nombre: o.name,
      tabla: o.tbl_name,
      sql: String(o.sql ?? '').replace(/\s+/g, ' '),
    }));
  return { version: VERSION_ESQUEMA, tablas, indices };
}

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => ({ db, cerrar } = await d1DePrueba()), 30_000);
afterAll(() => cerrar());

describe('red de seguridad: D1', () => {
  it('el esquema coincide con la instantánea', async () => {
    const { db: limpia, cerrar: cerrarLimpia } = await d1DePrueba();
    try {
      await aplicarMigraciones(limpia);
      await expect(`${JSON.stringify(await esquemaDe(limpia), null, 2)}\n`).toMatchFileSnapshot('./d1-esquema.json');
    } finally {
      await cerrarLimpia();
    }
  });

  it('las versiones son consecutivas', () => {
    expect(MIGRACIONES.map((m) => m.version)).toEqual(MIGRACIONES.map((_, i) => i + 1));
  });

  it('una base con los datos de hoy migra a la última versión sin pérdidas', async () => {
    const base: { version: number; tablas: Record<string, Fila[]> } = JSON.parse(await readFile(new URL('./d1-datos.json', import.meta.url), 'utf8'));
    // Esquema tal como estaba en la versión de la referencia (sin registrar versiones: van en los datos).
    for (const m of MIGRACIONES.filter((m) => m.version <= base.version)) await db.batch(m.sql.map((s) => db.prepare(s)));
    await db.prepare('CREATE TABLE IF NOT EXISTS esquema_version (version INTEGER PRIMARY KEY, aplicada TEXT NOT NULL)').run();
    for (const [tabla, filas] of Object.entries(base.tablas)) {
      for (const f of filas) {
        const cols = Object.keys(f);
        await db
          .prepare(`INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
          .bind(...cols.map((c) => comoValor(f[c])))
          .run();
      }
    }

    expect(await aplicarMigraciones(db)).toBe(VERSION_ESQUEMA - base.version);

    for (const [tabla, filas] of Object.entries(base.tablas)) {
      const ahora = (await db.prepare(`SELECT * FROM ${tabla} ORDER BY rowid`).all<Fila>()).results;
      // Las filas de la referencia siguen ahí, iguales (las migraciones solo pueden añadir).
      const antes = tabla === 'esquema_version' ? ahora.filter((f) => Number(f.version) <= base.version) : ahora;
      expect(antes.length, tabla).toBe(filas.length);
      filas.forEach((f, i) => expect(Object.fromEntries(Object.keys(f).map((c) => [c, comoTexto(antes[i][c])])), `${tabla} fila ${i + 1}`).toEqual(f));
    }
  });
});
