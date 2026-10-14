import type { BaseD1 } from './base.ts';

/**
 * Migraciones versionadas del esquema de D1. Nunca se edita una ya publicada:
 * los cambios van en una nueva, con la versión siguiente. El Worker las aplica
 * solo la primera vez que las necesita (ver `asegurarEsquema`).
 */
export const MIGRACIONES: { version: number; nombre: string; sql: string[] }[] = [
  {
    version: 1,
    nombre: 'esquema inicial',
    sql: [
      `CREATE TABLE usuarios (
        email TEXT PRIMARY KEY,
        nombre TEXT NOT NULL DEFAULT '',
        rol TEXT NOT NULL CHECK (rol IN ('propietario', 'gerente', 'editor')),
        activo INTEGER NOT NULL DEFAULT 1,
        creado TEXT NOT NULL
      )`,
      `CREATE TABLE entradas (
        coleccion TEXT NOT NULL CHECK (coleccion IN ('catalogo', 'ajustes', 'paginas', 'proyectos', 'guias')),
        id TEXT NOT NULL,
        borrador TEXT NOT NULL,
        publicado TEXT,
        archivada INTEGER NOT NULL DEFAULT 0,
        actualizado TEXT NOT NULL,
        actualizado_por TEXT NOT NULL,
        PRIMARY KEY (coleccion, id)
      )`,
      `CREATE TABLE cambios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        email TEXT NOT NULL,
        coleccion TEXT NOT NULL,
        entrada_id TEXT NOT NULL,
        antes TEXT,
        despues TEXT,
        origen TEXT NOT NULL DEFAULT 'panel' CHECK (origen IN ('panel', 'asistente', 'importacion', 'deshacer'))
      )`,
      `CREATE INDEX cambios_entrada ON cambios (coleccion, entrada_id, id)`,
      `CREATE TABLE fotos (
        ruta TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,
        bytes BLOB NOT NULL,
        tamano INTEGER NOT NULL,
        subida TEXT NOT NULL,
        subida_por TEXT NOT NULL
      )`,
      `CREATE TABLE publicaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        email TEXT NOT NULL,
        estado TEXT NOT NULL CHECK (estado IN ('lanzada', 'sin-cambios', 'error')),
        detalle TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        email TEXT NOT NULL,
        accion TEXT NOT NULL,
        detalle TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE presupuestos (
        id TEXT PRIMARY KEY,
        fecha TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'respondido', 'archivado')),
        idioma TEXT NOT NULL,
        tipo_pedido TEXT NOT NULL,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL,
        telefono TEXT NOT NULL DEFAULT '',
        empresa TEXT NOT NULL DEFAULT '',
        mensaje TEXT NOT NULL DEFAULT '',
        lineas TEXT NOT NULL DEFAULT '[]'
      )`,
      `CREATE INDEX presupuestos_estado ON presupuestos (estado, fecha)`,
      `CREATE TABLE asistente_uso (
        email TEXT NOT NULL,
        dia TEXT NOT NULL,
        usos INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (email, dia)
      )`,
    ],
  },
  {
    version: 2,
    nombre: 'provincia en los presupuestos',
    sql: [`ALTER TABLE presupuestos ADD COLUMN provincia TEXT NOT NULL DEFAULT ''`],
  },
];

export const VERSION_ESQUEMA = MIGRACIONES[MIGRACIONES.length - 1].version;

let esquemaListo: Promise<void> | null = null;

/** Aplica las migraciones pendientes. Una sola vez por instancia del Worker. */
export function asegurarEsquema(db: BaseD1): Promise<void> {
  const promesa = (esquemaListo ??= aplicarMigraciones(db).then(
    () => undefined,
    (error) => {
      esquemaListo = null;
      throw error;
    },
  ));
  return promesa;
}

export async function aplicarMigraciones(db: BaseD1): Promise<number> {
  await db.prepare('CREATE TABLE IF NOT EXISTS esquema_version (version INTEGER PRIMARY KEY, aplicada TEXT NOT NULL)').run();
  const fila = await db.prepare('SELECT MAX(version) AS v FROM esquema_version').first<{ v: number | null }>();
  const actual = fila?.v ?? 0;
  let aplicadas = 0;
  for (const m of MIGRACIONES) {
    if (m.version <= actual) continue;
    // En lote: si una sentencia falla, D1 deshace toda la migración.
    await db.batch([
      ...m.sql.map((s) => db.prepare(s)),
      db.prepare('INSERT INTO esquema_version (version, aplicada) VALUES (?, ?)').bind(m.version, new Date().toISOString()),
    ]);
    aplicadas++;
  }
  return aplicadas;
}
