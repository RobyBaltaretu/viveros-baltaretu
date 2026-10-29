import type { PresupuestoCliente, Repositorios } from '../tipos.ts';
import type { BaseD1 } from './base.ts';

/** Presupuestos a cliente sobre D1. */
const ahora = () => new Date().toISOString();
type Datos = Omit<PresupuestoCliente, 'id' | 'serie' | 'numero' | 'codigo' | 'estado' | 'fecha' | 'validez' | 'clienteId' | 'obraId' | 'anticipoPct' | 'actualizado'>;

interface Fila {
  id: string;
  serie: string;
  numero: number;
  codigo: string;
  estado: PresupuestoCliente['estado'];
  fecha: string;
  validez: string | null;
  cliente_id: string;
  obra_id: string | null;
  anticipo_pct: number;
  datos: string;
  actualizado: string;
}

const aPresupuesto = (f: Fila): PresupuestoCliente => ({
  ...(JSON.parse(f.datos) as Datos),
  id: f.id,
  serie: f.serie,
  numero: f.numero,
  codigo: f.codigo,
  estado: f.estado,
  fecha: f.fecha,
  validez: f.validez,
  clienteId: f.cliente_id,
  obraId: f.obra_id,
  anticipoPct: f.anticipo_pct,
  actualizado: f.actualizado,
});

const datosDe = (p: Omit<PresupuestoCliente, 'numero' | 'codigo' | 'actualizado'>): string => {
  const { id: _id, serie: _s, estado: _e, fecha: _f, validez: _v, clienteId: _c, obraId: _o, anticipoPct: _a, ...datos } = p;
  return JSON.stringify(datos satisfies Datos);
};

export const codigoPresupuesto = (serie: string, numero: number) => `${serie}-${String(numero).padStart(4, '0')}`;

export function crearRepositorioPresupuestosCliente(db: BaseD1): Pick<Repositorios, 'presupuestosCliente'> {
  const obtener = async (id: string) => {
    const f = await db.prepare('SELECT * FROM presupuestos_cliente WHERE id = ?').bind(id).first<Fila>();
    return f ? aPresupuesto(f) : null;
  };
  return {
    presupuestosCliente: {
      async listar(filtro = {}) {
        const donde: string[] = [];
        const valores: unknown[] = [];
        if (filtro.estado) {
          donde.push('estado = ?');
          valores.push(filtro.estado);
        }
        if (filtro.clienteId) {
          donde.push('cliente_id = ?');
          valores.push(filtro.clienteId);
        }
        const sql = `SELECT * FROM presupuestos_cliente ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''} ORDER BY fecha DESC, numero DESC LIMIT ?`;
        return (
          await db
            .prepare(sql)
            .bind(...valores, filtro.limite ?? 500)
            .all<Fila>()
        ).results.map(aPresupuesto);
      },
      obtener,
      async crear(p, email) {
        // El número sale de la base en la misma sentencia; si dos altas chocan, UNIQUE lo impide y se reintenta.
        for (let intento = 0; intento < 5; intento++) {
          const f = await db.prepare('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM presupuestos_cliente WHERE serie = ?').bind(p.serie).first<{ n: number }>();
          const numero = f?.n ?? 1;
          const t = ahora();
          try {
            await db
              .prepare(
                `INSERT INTO presupuestos_cliente (id, serie, numero, codigo, estado, fecha, validez, cliente_id, obra_id, anticipo_pct, total, datos, creado, actualizado, actualizado_por)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(p.id, p.serie, numero, codigoPresupuesto(p.serie, numero), p.estado, p.fecha, p.validez, p.clienteId, p.obraId, p.anticipoPct, p.totales.total, datosDe(p), t, t, email)
              .run();
            return (await obtener(p.id))!;
          } catch (error) {
            if (!String(error).includes('UNIQUE') || String(error).includes('presupuestos_cliente.id')) throw error;
          }
        }
        throw new Error('No se ha podido numerar el presupuesto. Prueba otra vez.');
      },
      async guardar(p, email) {
        await db
          .prepare(
            `UPDATE presupuestos_cliente SET estado = ?, fecha = ?, validez = ?, cliente_id = ?, obra_id = ?, anticipo_pct = ?, total = ?, datos = ?,
             actualizado = ?, actualizado_por = ? WHERE id = ?`,
          )
          .bind(p.estado, p.fecha, p.validez, p.clienteId, p.obraId, p.anticipoPct, p.totales.total, datosDe(p), ahora(), email, p.id)
          .run();
      },
    },
  };
}
