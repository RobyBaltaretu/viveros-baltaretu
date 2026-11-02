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
      async porFactura(id) {
        const fila = await db.prepare("SELECT * FROM presupuestos_cliente WHERE json_extract(datos, '$.facturaAnticipoId') = ? OR json_extract(datos, '$.facturaId') = ? LIMIT 1").bind(id, id).first<Fila>();
        return fila ? aPresupuesto(fila) : null;
      },
      async registrarCobro(id, parte, fecha, email) {
        const campo = parte === 'anticipo' ? '$.cobroAnticipo' : '$.cobroResto';
        const enlace = parte === 'anticipo' ? '$.facturaAnticipoId' : '$.facturaId';
        const t = ahora();
        const [r] = await db.batch([
          db.prepare("UPDATE presupuestos_cliente SET datos = json_set(datos, ?, ?), actualizado = ?, actualizado_por = ? WHERE id = ? AND estado = 'aceptado'")
            .bind(campo, fecha, t, email, id),
          db.prepare(`UPDATE facturas SET estado = ?, cobrada_el = ?, actualizada = ? WHERE estado IN ('emitida','cobrada')
            AND id = (SELECT json_extract(datos, ?) FROM presupuestos_cliente WHERE id = ? AND estado = 'aceptado')`).bind(fecha ? 'cobrada' : 'emitida', fecha, t, enlace, id),
        ]);
        return r.meta?.changes === 1;
      },
      async indicadores(desde, hasta, hoy) {
        const fila = await db.prepare(`SELECT
          COUNT(CASE WHEN fecha BETWEEN ?1 AND ?2 AND estado = 'aceptado' THEN 1 END) AS aceptados,
          COUNT(CASE WHEN fecha BETWEEN ?1 AND ?2 AND estado IN ('aceptado','rechazado') THEN 1 END) AS decididos,
          COUNT(CASE WHEN estado = 'enviado' AND (validez IS NULL OR validez >= ?3) THEN 1 END) AS pendientes,
          COALESCE(SUM(CASE WHEN estado = 'enviado' AND (validez IS NULL OR validez >= ?3) THEN ROUND(total * 100) ELSE 0 END), 0) / 100.0 AS cartera,
          COUNT(CASE WHEN estado = 'enviado' AND validez BETWEEN ?3 AND date(?3,'+6 days') THEN 1 END) AS caducan,
          COALESCE(SUM(CASE WHEN estado = 'enviado' AND validez BETWEEN ?3 AND date(?3,'+6 days') THEN ROUND(total * 100) ELSE 0 END), 0) / 100.0 AS valorCaduca
          FROM presupuestos_cliente`).bind(desde, hasta, hoy).first<{ aceptados: number; decididos: number; pendientes: number; cartera: number; caducan: number; valorCaduca: number }>();
        return fila ?? { aceptados: 0, decididos: 0, pendientes: 0, cartera: 0, caducan: 0, valorCaduca: 0 };
      },
      async enlazarFactura(p, tipo, f, email) {
        const ruta = tipo === 'anticipo' ? '$.facturaAnticipoId' : '$.facturaId';
        const t = ahora();
        const [enlace] = await db.batch([
          db.prepare(`UPDATE presupuestos_cliente SET datos = json_set(datos, ?, ?), actualizado = ?, actualizado_por = ?
            WHERE id = ? AND estado = 'aceptado' AND actualizado = ? AND json_extract(datos, ?) IS NULL
            AND json_extract(datos, '$.facturaId') IS NULL AND json_extract(datos, '$.facturaAnticipoId') IS ?`)
            .bind(ruta, f.id, t, email, p.id, p.actualizado, ruta, p.facturaAnticipoId),
          db.prepare(`INSERT INTO facturas (id,tipo,estado,fecha,cliente_id,total,datos,creada,creada_por,actualizada)
            SELECT ?,?,'borrador',?,?,?,?,?,?,? WHERE EXISTS
            (SELECT 1 FROM presupuestos_cliente WHERE id = ? AND json_extract(datos, ?) = ?)`)
            .bind(f.id, f.tipo, f.fecha, f.clienteId, f.totales.total, JSON.stringify(f), f.creada, f.creadaPor, t, p.id, ruta, f.id),
        ]);
        return enlace.meta?.changes === 1;
      },
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
            `UPDATE presupuestos_cliente SET estado = ?, fecha = ?, validez = ?, cliente_id = ?, obra_id = ?, anticipo_pct = ?, total = ?, datos = json_set(?, '$.facturaId', json_extract(datos, '$.facturaId'), '$.facturaAnticipoId', json_extract(datos, '$.facturaAnticipoId')),
             actualizado = ?, actualizado_por = ? WHERE id = ?`,
          )
          .bind(p.estado, p.fecha, p.validez, p.clienteId, p.obraId, p.anticipoPct, p.totales.total, datosDe(p), ahora(), email, p.id)
          .run();
      },
      async borrarPruebas() {
        const r = await db.prepare("DELETE FROM presupuestos_cliente WHERE id LIKE 'prueba-%'").run();
        return r.meta?.changes ?? 0;
      },
    },
  };
}
