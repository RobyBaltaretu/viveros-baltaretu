import type { PedidoProveedor, Repositorios } from '../tipos.ts';
import type { BaseD1 } from './base.ts';

/** Pedidos a proveedor sobre D1. Código correlativo por año: PE2026-0001. */
const ahora = () => new Date().toISOString();
type Datos = Omit<PedidoProveedor, 'id' | 'codigo' | 'estado' | 'proveedorId' | 'presupuestoClienteId' | 'fecha' | 'coste' | 'actualizado'>;

interface Fila {
  id: string;
  codigo: string;
  estado: PedidoProveedor['estado'];
  proveedor_id: string;
  presupuesto_cliente_id: string | null;
  fecha: string;
  coste: number;
  datos: string;
  actualizado: string;
}

const aPedido = (f: Fila): PedidoProveedor => ({
  ...(JSON.parse(f.datos) as Datos),
  id: f.id,
  codigo: f.codigo,
  estado: f.estado,
  proveedorId: f.proveedor_id,
  presupuestoClienteId: f.presupuesto_cliente_id,
  fecha: f.fecha,
  coste: f.coste,
  actualizado: f.actualizado,
});

const datosDe = (p: Omit<PedidoProveedor, 'codigo' | 'actualizado'>): string => {
  const { id: _i, estado: _e, proveedorId: _p, presupuestoClienteId: _c, fecha: _f, coste: _co, ...datos } = p;
  return JSON.stringify(datos satisfies Datos);
};

export const serieDePedido = (fecha: string) => `PE${fecha.slice(0, 4)}`;

export function crearRepositorioPedidosProveedor(db: BaseD1): Pick<Repositorios, 'pedidosProveedor'> {
  const obtener = async (id: string) => {
    const f = await db.prepare('SELECT * FROM pedidos_proveedor WHERE id = ?').bind(id).first<Fila>();
    return f ? aPedido(f) : null;
  };
  return {
    pedidosProveedor: {
      async listar(filtro = {}) {
        const donde: string[] = [];
        const valores: unknown[] = [];
        if (filtro.estado) {
          donde.push('estado = ?');
          valores.push(filtro.estado);
        }
        if (filtro.proveedorId) {
          donde.push('proveedor_id = ?');
          valores.push(filtro.proveedorId);
        }
        if (filtro.presupuestoClienteId) {
          donde.push('presupuesto_cliente_id = ?');
          valores.push(filtro.presupuestoClienteId);
        }
        const sql = `SELECT * FROM pedidos_proveedor ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''} ORDER BY fecha DESC, codigo DESC LIMIT ?`;
        return (
          await db
            .prepare(sql)
            .bind(...valores, filtro.limite ?? 500)
            .all<Fila>()
        ).results.map(aPedido);
      },
      obtener,
      async crear(p, email) {
        const serie = serieDePedido(p.fecha);
        // El número sale de la base; si dos altas chocan, UNIQUE lo impide y se reintenta.
        for (let intento = 0; intento < 5; intento++) {
          const f = await db
            .prepare('SELECT COALESCE(MAX(CAST(substr(codigo, ?) AS INTEGER)), 0) + 1 AS n FROM pedidos_proveedor WHERE codigo LIKE ?')
            .bind(serie.length + 2, `${serie}-%`)
            .first<{ n: number }>();
          const codigo = `${serie}-${String(f?.n ?? 1).padStart(4, '0')}`;
          try {
            await db
              .prepare(
                `INSERT INTO pedidos_proveedor (id, codigo, estado, proveedor_id, obra_id, presupuesto_cliente_id, fecha, coste, datos, actualizado, actualizado_por)
                 VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(p.id, codigo, p.estado, p.proveedorId, p.presupuestoClienteId, p.fecha, p.coste, datosDe(p), ahora(), email)
              .run();
            return (await obtener(p.id))!;
          } catch (error) {
            if (!String(error).includes('UNIQUE') || String(error).includes('pedidos_proveedor.id')) throw error;
          }
        }
        throw new Error('No se ha podido numerar el pedido. Prueba otra vez.');
      },
      async guardar(p, email) {
        await db
          .prepare(
            `UPDATE pedidos_proveedor SET estado = ?, proveedor_id = ?, presupuesto_cliente_id = ?, fecha = ?, coste = ?, datos = ?, actualizado = ?, actualizado_por = ?
             WHERE id = ?`,
          )
          .bind(p.estado, p.proveedorId, p.presupuestoClienteId, p.fecha, p.coste, datosDe(p), ahora(), email, p.id)
          .run();
      },
      async borrar(id) {
        const r = await db.prepare("DELETE FROM pedidos_proveedor WHERE id = ? AND estado = 'borrador'").bind(id).run();
        return (r.meta?.changes ?? 0) > 0;
      },
      async borrarPruebas() {
        const r = await db.prepare("DELETE FROM pedidos_proveedor WHERE id LIKE 'prueba-%'").run();
        return r.meta?.changes ?? 0;
      },
    },
  };
}
