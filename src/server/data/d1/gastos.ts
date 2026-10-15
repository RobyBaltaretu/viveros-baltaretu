import type { Gasto, Repositorios } from '../tipos.ts';
import type { BaseD1 } from './base.ts';

/** Repositorios de gastos y fotos de tickets sobre D1. */
const ahora = () => new Date().toISOString();

export function crearRepositoriosGastos(db: BaseD1): Pick<Repositorios, 'gastos' | 'tickets'> {
  return {
    gastos: {
      async listar(filtro = {}) {
        const donde: string[] = [];
        const valores: unknown[] = [];
        const anadir = (sql: string, v: unknown) => {
          donde.push(sql);
          valores.push(v);
        };
        if (filtro.estado) anadir('estado = ?', filtro.estado);
        if (filtro.desde) anadir('fecha >= ?', filtro.desde);
        if (filtro.hasta) anadir('fecha <= ?', filtro.hasta);
        const sql = `SELECT datos, estado FROM gastos ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''} ORDER BY fecha DESC, creado DESC LIMIT ?`;
        const filas = await db
          .prepare(sql)
          .bind(...valores, filtro.limite ?? 1000)
          .all<{ datos: string; estado: Gasto['estado'] }>();
        return filas.results.map((f) => ({ ...(JSON.parse(f.datos) as Gasto), estado: f.estado }));
      },
      async obtener(id) {
        const f = await db.prepare('SELECT datos, estado FROM gastos WHERE id = ?').bind(id).first<{ datos: string; estado: Gasto['estado'] }>();
        return f ? { ...(JSON.parse(f.datos) as Gasto), estado: f.estado } : null;
      },
      async guardar(g) {
        const t = ahora();
        await db
          .prepare(
            `INSERT INTO gastos (id, estado, fecha, proveedor, categoria, total, ticket_id, datos, creado, creado_por, actualizado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET estado = excluded.estado, fecha = excluded.fecha, proveedor = excluded.proveedor,
             categoria = excluded.categoria, total = excluded.total, ticket_id = excluded.ticket_id, datos = excluded.datos, actualizado = excluded.actualizado`,
          )
          .bind(g.id, g.estado, g.fecha, g.proveedor, g.categoria, g.total, g.ticketId, JSON.stringify({ ...g, actualizado: t }), g.creado, g.creadoPor, t)
          .run();
      },
      async borrar(id) {
        const f = await db.prepare('SELECT ticket_id FROM gastos WHERE id = ?').bind(id).first<{ ticket_id: string | null }>();
        if (!f) return false;
        await db.batch([db.prepare('DELETE FROM gastos WHERE id = ?').bind(id), db.prepare('DELETE FROM tickets WHERE id = ?').bind(f.ticket_id ?? '')]);
        return true;
      },
    },
    tickets: {
      async guardar(t, email) {
        await db.prepare('INSERT INTO tickets (id, tipo, bytes, tamano, subido, subido_por) VALUES (?, ?, ?, ?, ?, ?)').bind(t.id, t.tipo, t.bytes, t.bytes.byteLength, ahora(), email).run();
      },
      async obtener(id) {
        const f = await db.prepare('SELECT tipo, bytes FROM tickets WHERE id = ?').bind(id).first<{ tipo: string; bytes: ArrayBuffer | number[] }>();
        return f ? { tipo: f.tipo, bytes: new Uint8Array(f.bytes) } : null;
      },
    },
  };
}
