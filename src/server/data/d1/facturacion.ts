import type { Cliente, Factura, Repositorios } from '../tipos.ts';
import type { BaseD1 } from './base.ts';

/** Repositorios de facturación sobre D1: ajustes privados, clientes y facturas. */
const ahora = () => new Date().toISOString();

interface FilaFactura {
  datos: string;
  estado: Factura['estado'];
  serie: string | null;
  numero: number | null;
  codigo: string | null;
  fecha: string;
  huella: string | null;
  cobrada_el: string | null;
  actualizada: string;
}

// Las columnas mandan sobre la copia en JSON (estado, número, fechas): son las que cambian al emitir o cobrar.
const aFactura = (f: FilaFactura): Factura => ({
  ...(JSON.parse(f.datos) as Factura),
  estado: f.estado,
  serie: f.serie,
  numero: f.numero,
  codigo: f.codigo,
  fecha: f.fecha,
  huella: f.huella,
  cobradaEl: f.cobrada_el,
  actualizada: f.actualizada,
});

export function crearRepositoriosFacturacion(db: BaseD1): Pick<Repositorios, 'ajustesPrivados' | 'clientes' | 'facturas'> {
  const filaFactura = (id: string) => db.prepare('SELECT * FROM facturas WHERE id = ?').bind(id).first<FilaFactura>();

  return {
    ajustesPrivados: {
      async obtener<T>(clave: string) {
        const f = await db.prepare('SELECT valor FROM ajustes_privados WHERE clave = ?').bind(clave).first<{ valor: string }>();
        return f ? (JSON.parse(f.valor) as T) : null;
      },
      async guardar(clave, valor, email) {
        await db
          .prepare(
            `INSERT INTO ajustes_privados (clave, valor, actualizado, actualizado_por) VALUES (?, ?, ?, ?)
             ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, actualizado = excluded.actualizado, actualizado_por = excluded.actualizado_por`,
          )
          .bind(clave, JSON.stringify(valor), ahora(), email)
          .run();
      },
    },
    clientes: {
      async listar(opciones = {}) {
        const sql = opciones.incluirArchivados ? 'SELECT datos FROM clientes ORDER BY nombre COLLATE NOCASE' : 'SELECT datos FROM clientes WHERE archivado = 0 ORDER BY nombre COLLATE NOCASE';
        return (await db.prepare(sql).all<{ datos: string }>()).results.map((f) => JSON.parse(f.datos) as Cliente);
      },
      async obtener(id) {
        const f = await db.prepare('SELECT datos FROM clientes WHERE id = ?').bind(id).first<{ datos: string }>();
        return f ? (JSON.parse(f.datos) as Cliente) : null;
      },
      async guardar(c, email) {
        await db
          .prepare(
            `INSERT INTO clientes (id, nombre, nif, datos, archivado, actualizado, actualizado_por) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, nif = excluded.nif, datos = excluded.datos,
             archivado = excluded.archivado, actualizado = excluded.actualizado, actualizado_por = excluded.actualizado_por`,
          )
          .bind(c.id, c.nombre, c.nif, JSON.stringify(c), c.archivado ? 1 : 0, ahora(), email)
          .run();
      },
    },
    facturas: {
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
        if (filtro.desde) {
          donde.push('fecha >= ?');
          valores.push(filtro.desde);
        }
        if (filtro.hasta) {
          donde.push('fecha <= ?');
          valores.push(filtro.hasta);
        }
        const sql = `SELECT * FROM facturas ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''} ORDER BY fecha DESC, numero DESC, creada DESC LIMIT ?`;
        const filas = await db
          .prepare(sql)
          .bind(...valores, filtro.limite ?? 500)
          .all<FilaFactura>();
        return filas.results.map(aFactura);
      },
      async obtener(id) {
        const f = await filaFactura(id);
        return f ? aFactura(f) : null;
      },
      async guardarBorrador(fa) {
        const previa = await filaFactura(fa.id);
        if (previa && previa.estado !== 'borrador') return false;
        const t = ahora();
        await db
          .prepare(
            `INSERT INTO facturas (id, tipo, estado, fecha, cliente_id, total, datos, creada, creada_por, actualizada) VALUES (?, ?, 'borrador', ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET fecha = excluded.fecha, cliente_id = excluded.cliente_id, total = excluded.total,
             datos = excluded.datos, actualizada = excluded.actualizada WHERE facturas.estado = 'borrador'`,
          )
          .bind(fa.id, fa.tipo, fa.fecha, fa.clienteId, fa.totales.total, JSON.stringify({ ...fa, actualizada: t }), fa.creada, fa.creadaPor, t)
          .run();
        return true;
      },
      async borrarBorrador(id) {
        const r = await db.prepare("DELETE FROM facturas WHERE id = ? AND estado = 'borrador'").bind(id).run();
        return (r.meta?.changes ?? 0) > 0;
      },
      async ultimaEmitida(serie) {
        const f = await db.prepare('SELECT * FROM facturas WHERE serie = ? AND numero IS NOT NULL ORDER BY numero DESC LIMIT 1').bind(serie).first<FilaFactura>();
        return f ? aFactura(f) : null;
      },
      async ultimaHuella() {
        const f = await db.prepare("SELECT huella FROM facturas WHERE huella IS NOT NULL ORDER BY json_extract(datos, '$.emitidaEl') DESC, rowid DESC LIMIT 1").first<{ huella: string }>();
        return f?.huella ?? null;
      },
      async emitir(id, d) {
        const previa = await filaFactura(id);
        if (!previa || previa.estado !== 'borrador') return null;
        // Dos intentos: si otra persona emite a la vez, el número choca (UNIQUE) y se toma el siguiente.
        for (let intento = 0; intento < 2; intento++) {
          const ultima = await db.prepare('SELECT MAX(numero) AS n FROM facturas WHERE serie = ?').bind(d.serie).first<{ n: number | null }>();
          const numero = (ultima?.n ?? 0) + 1;
          const codigo = d.codigo(numero);
          const huella = await d.huella(numero, codigo);
          const t = ahora();
          const datos: Factura = {
            ...(JSON.parse(previa.datos) as Factura),
            estado: 'emitida',
            serie: d.serie,
            numero,
            codigo,
            fecha: d.fecha,
            emisor: d.emisor,
            cliente: d.cliente,
            huella,
            huellaAnterior: d.huellaAnterior,
            actualizada: t,
          };
          try {
            const r = await db
              .prepare(
                `UPDATE facturas SET estado = 'emitida', serie = ?, numero = ?, codigo = ?, fecha = ?, huella = ?, datos = ?, actualizada = ?
                 WHERE id = ? AND estado = 'borrador'`,
              )
              .bind(d.serie, numero, codigo, d.fecha, huella, JSON.stringify({ ...datos, emitidaEl: t }), t, id)
              .run();
            return (r.meta?.changes ?? 0) > 0 ? datos : null;
          } catch (error) {
            if (intento === 1 || !/UNIQUE/i.test(String(error))) throw error;
          }
        }
        return null;
      },
      async marcarCobrada(id, fecha) {
        const r = await db
          .prepare(`UPDATE facturas SET estado = ?, cobrada_el = ?, actualizada = ? WHERE id = ? AND estado IN ('emitida', 'cobrada')`)
          .bind(fecha ? 'cobrada' : 'emitida', fecha, ahora(), id)
          .run();
        return (r.meta?.changes ?? 0) > 0;
      },
    },
  };
}
