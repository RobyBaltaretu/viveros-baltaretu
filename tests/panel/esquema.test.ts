import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarMigraciones, VERSION_ESQUEMA } from '../../src/server/data/d1/migraciones.ts';
import type { BaseD1 } from '../../src/server/data/d1/base.ts';
import { d1DePrueba } from './d1.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => ({ db, cerrar } = await d1DePrueba()), 30_000);
afterAll(() => cerrar());

describe('esquema de D1', () => {
  it('aplica las migraciones una sola vez', async () => {
    expect(await aplicarMigraciones(db)).toBe(VERSION_ESQUEMA);
    expect(await aplicarMigraciones(db)).toBe(0);
    const tablas = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all<{ name: string }>();
    expect(tablas.results.map((t) => t.name)).toEqual(
      expect.arrayContaining(['asistente_uso', 'auditoria', 'cambios', 'entradas', 'fotos', 'presupuestos', 'publicaciones', 'usuarios']),
    );
  });

  it('rechaza roles y estados fuera de la lista', async () => {
    await expect(db.prepare("INSERT INTO usuarios (email, rol, creado) VALUES ('a@example.com', 'jefe', '')").run()).rejects.toThrow();
    await expect(
      db.prepare("INSERT INTO entradas (coleccion, id, borrador, actualizado, actualizado_por) VALUES ('otra', 'x', '{}', '', '')").run(),
    ).rejects.toThrow();
  });
});
