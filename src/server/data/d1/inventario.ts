import type { Existencias, MovimientoInventario, RepositorioInventario } from '../tipos.ts';
import type { BaseD1 } from './base.ts';

/**
 * Inventario en D1: una tabla de movimientos que nunca se cambian ni se borran
 * (como un libro); las existencias son su suma. Lo que viene de una factura
 * lleva `referencia` única, así que emitirla dos veces no descuenta dos veces.
 */
const ahora = () => new Date().toISOString();

export function crearRepositorioInventario(db: BaseD1): RepositorioInventario {
  return {
    async registrar(movimientos, email) {
      if (!movimientos.length) return 0;
      const t = ahora();
      const r = await db.batch(
        movimientos.map((m) =>
          db
            .prepare('INSERT OR IGNORE INTO inventario_movimientos (planta, tipo, cantidad, motivo, nota, referencia, fecha, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(m.planta, m.tipo, Math.round(m.cantidad), m.motivo, m.nota ?? '', m.referencia ?? null, t, email),
        ),
      );
      return r.reduce((n, x) => n + ((x as { meta?: { changes?: number } }).meta?.changes ?? 0), 0);
    },
    async existencias() {
      const filas = await db
        .prepare(
          `SELECT planta, SUM(cantidad) AS disponible, SUM(CASE WHEN tipo = 'baja' THEN -cantidad ELSE 0 END) AS desperdicio,
             MAX(fecha) AS ultimo FROM inventario_movimientos GROUP BY planta`,
        )
        .all<Existencias & { planta: string }>();
      return Object.fromEntries(filas.results.map(({ planta, ...e }) => [planta, e]));
    },
    async movimientos(filtro = {}) {
      const donde: string[] = [];
      const valores: unknown[] = [];
      if (filtro.planta) {
        donde.push('planta = ?');
        valores.push(filtro.planta);
      }
      if (filtro.tipo) {
        donde.push('tipo = ?');
        valores.push(filtro.tipo);
      }
      if (filtro.desde) {
        donde.push('fecha >= ?');
        valores.push(filtro.desde);
      }
      const filas = await db
        .prepare(`SELECT * FROM inventario_movimientos ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`)
        .bind(...valores, filtro.limite ?? 100)
        .all<MovimientoInventario>();
      return filas.results;
    },
    async borrarPruebas() {
      const r = await db.prepare("DELETE FROM inventario_movimientos WHERE referencia LIKE 'prueba:%'").run();
      return r.meta?.changes ?? 0;
    },
  };
}
