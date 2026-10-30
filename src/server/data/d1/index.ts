import type {
  Autor,
  Cambio,
  Coleccion,
  Documento,
  Entrada,
  EstadoPresupuesto,
  Presupuesto,
  Repositorios,
  Usuario,
} from '../tipos.ts';
import type { BaseD1 } from './base.ts';
import { crearRepositoriosFacturacion } from './facturacion.ts';
import { crearRepositoriosGastos } from './gastos.ts';
import { crearRepositorioConversaciones } from './conversaciones.ts';
import { crearRepositorioInventario } from './inventario.ts';
import { crearRepositoriosPortafolio } from './portafolio.ts';
import { crearRepositorioPresupuestosCliente } from './presupuestos-cliente.ts';
import { crearRepositorioCatalogo } from './catalogo.ts';
import { crearRepositorioProveedores } from './proveedores.ts';

/** Implementación de los repositorios sobre D1. Es el único sitio con SQL. */
const ahora = () => new Date().toISOString();
const json = (d: Documento) => JSON.stringify({ datos: d.datos, cuerpo: d.cuerpo ?? '' });
const doc = (texto: string | null): Documento | null => (texto ? (JSON.parse(texto) as Documento) : null);

interface FilaEntrada {
  coleccion: Coleccion;
  id: string;
  borrador: string;
  publicado: string | null;
  archivada: number;
  actualizado: string;
  actualizado_por: string;
}

const aEntrada = (f: FilaEntrada): Entrada => ({
  coleccion: f.coleccion,
  id: f.id,
  borrador: doc(f.borrador)!,
  publicado: doc(f.publicado),
  archivada: f.archivada === 1,
  actualizado: f.actualizado,
  actualizadoPor: f.actualizado_por,
});

interface FilaCambio {
  id: number;
  fecha: string;
  email: string;
  coleccion: Coleccion;
  entrada_id: string;
  antes: string | null;
  despues: string | null;
  origen: Cambio['origen'];
}

const aCambio = (f: FilaCambio): Cambio => ({
  id: f.id,
  fecha: f.fecha,
  email: f.email,
  coleccion: f.coleccion,
  entradaId: f.entrada_id,
  antes: doc(f.antes),
  despues: doc(f.despues),
  origen: f.origen,
});

interface FilaPresupuesto {
  id: string;
  fecha: string;
  estado: EstadoPresupuesto;
  idioma: string;
  tipo_pedido: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  provincia: string;
  mensaje: string;
  lineas: string;
}

const aPresupuesto = (f: FilaPresupuesto): Presupuesto => ({
  id: f.id,
  fecha: f.fecha,
  estado: f.estado,
  idioma: f.idioma,
  tipoPedido: f.tipo_pedido,
  nombre: f.nombre,
  email: f.email,
  telefono: f.telefono,
  empresa: f.empresa,
  provincia: f.provincia ?? '',
  mensaje: f.mensaje,
  lineas: JSON.parse(f.lineas),
});

const PENDIENTE = '((archivada = 0 AND (publicado IS NULL OR publicado != borrador)) OR (archivada = 1 AND publicado IS NOT NULL))';

export function crearRepositoriosD1(db: BaseD1): Repositorios {
  const insertarCambio = (coleccion: Coleccion, id: string, antes: string | null, despues: string | null, autor: Autor) =>
    db
      .prepare('INSERT INTO cambios (fecha, email, coleccion, entrada_id, antes, despues, origen) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(ahora(), autor.email, coleccion, id, antes, despues, autor.origen ?? 'panel');

  const filaEntrada = (coleccion: Coleccion, id: string) =>
    db.prepare('SELECT * FROM entradas WHERE coleccion = ? AND id = ?').bind(coleccion, id).first<FilaEntrada>();

  const contenido: Repositorios['contenido'] = {
    async listar(coleccion, opciones) {
      const sql = opciones?.incluirArchivadas
        ? 'SELECT * FROM entradas WHERE coleccion = ? ORDER BY id'
        : 'SELECT * FROM entradas WHERE coleccion = ? AND archivada = 0 ORDER BY id';
      return (await db.prepare(sql).bind(coleccion).all<FilaEntrada>()).results.map(aEntrada);
    },
    async obtener(coleccion, id) {
      const f = await filaEntrada(coleccion, id);
      return f ? aEntrada(f) : null;
    },
    async guardarBorrador(coleccion, id, documento, autor) {
      const previa = await filaEntrada(coleccion, id);
      const nuevo = json(documento);
      if (previa && previa.borrador === nuevo && previa.archivada === 0) return;
      await db.batch([
        db
          .prepare(
            `INSERT INTO entradas (coleccion, id, borrador, archivada, actualizado, actualizado_por) VALUES (?, ?, ?, 0, ?, ?)
             ON CONFLICT (coleccion, id) DO UPDATE SET borrador = excluded.borrador, archivada = 0,
             actualizado = excluded.actualizado, actualizado_por = excluded.actualizado_por`,
          )
          .bind(coleccion, id, nuevo, ahora(), autor.email),
        insertarCambio(coleccion, id, previa && previa.archivada === 0 ? previa.borrador : null, nuevo, autor),
      ]);
    },
    async archivar(coleccion, id, archivada, autor) {
      const previa = await filaEntrada(coleccion, id);
      if (!previa || (previa.archivada === 1) === archivada) return;
      await db.batch([
        db
          .prepare('UPDATE entradas SET archivada = ?, actualizado = ?, actualizado_por = ? WHERE coleccion = ? AND id = ?')
          .bind(archivada ? 1 : 0, ahora(), autor.email, coleccion, id),
        archivada
          ? insertarCambio(coleccion, id, previa.borrador, null, autor)
          : insertarCambio(coleccion, id, null, previa.borrador, autor),
      ]);
    },
    async pendientes() {
      return (await db.prepare(`SELECT * FROM entradas WHERE ${PENDIENTE} ORDER BY coleccion, id`).all<FilaEntrada>()).results.map(aEntrada);
    },
    async publicarTodo() {
      const n = (await db.prepare(`SELECT COUNT(*) AS n FROM entradas WHERE ${PENDIENTE}`).first<{ n: number }>())?.n ?? 0;
      if (n > 0) {
        await db.batch([
          db.prepare('UPDATE entradas SET publicado = NULL WHERE archivada = 1 AND publicado IS NOT NULL'),
          db.prepare('UPDATE entradas SET publicado = borrador WHERE archivada = 0 AND (publicado IS NULL OR publicado != borrador)'),
        ]);
      }
      return n;
    },
    async publicadas() {
      const filas = await db
        .prepare('SELECT coleccion, id, publicado FROM entradas WHERE publicado IS NOT NULL ORDER BY coleccion, id')
        .all<{ coleccion: Coleccion; id: string; publicado: string }>();
      return filas.results.map((f) => ({ coleccion: f.coleccion, id: f.id, documento: doc(f.publicado)! }));
    },
    async historial(opciones = {}) {
      const condiciones: string[] = [];
      const valores: unknown[] = [];
      if (opciones.coleccion) {
        condiciones.push('coleccion = ?');
        valores.push(opciones.coleccion);
      }
      if (opciones.id) {
        condiciones.push('entrada_id = ?');
        valores.push(opciones.id);
      }
      // Un cambio deshecho (y el propio «deshacer») ya no se enseña: solo se deshace una vez.
      condiciones.push("deshecho = 0 AND origen != 'deshacer'");
      const donde = `WHERE ${condiciones.join(' AND ')}`;
      const filas = await db
        .prepare(`SELECT * FROM cambios ${donde} ORDER BY id DESC LIMIT ?`)
        .bind(...valores, opciones.limite ?? 50)
        .all<FilaCambio>();
      return filas.results.map(aCambio);
    },
    async deshacer(cambioId, autor) {
      const f = await db.prepare('SELECT * FROM cambios WHERE id = ?').bind(cambioId).first<FilaCambio & { deshecho: number }>();
      if (!f || f.deshecho || f.origen === 'deshacer') return null;
      // Se marca antes de aplicar: dos pulsaciones seguidas no lo deshacen dos veces.
      const marcado = await db.prepare('UPDATE cambios SET deshecho = 1 WHERE id = ? AND deshecho = 0').bind(cambioId).run();
      if (!marcado.meta?.changes) return null;
      const cambio = aCambio(f);
      const deshacer = { ...autor, origen: 'deshacer' as const };
      if (cambio.antes === null) await contenido.archivar(cambio.coleccion, cambio.entradaId, true, deshacer);
      else await contenido.guardarBorrador(cambio.coleccion, cambio.entradaId, cambio.antes, deshacer);
      return cambio;
    },
    async importar(entradas, autor) {
      const sentencias = entradas.map((e) =>
        db
          .prepare(
            `INSERT INTO entradas (coleccion, id, borrador, publicado, archivada, actualizado, actualizado_por) VALUES (?, ?, ?, ?, 0, ?, ?)
             ON CONFLICT (coleccion, id) DO UPDATE SET borrador = excluded.borrador, publicado = excluded.publicado,
             archivada = 0, actualizado = excluded.actualizado, actualizado_por = excluded.actualizado_por`,
          )
          .bind(e.coleccion, e.id, json(e.documento), json(e.documento), ahora(), autor.email),
      );
      for (let i = 0; i < sentencias.length; i += 40) await db.batch(sentencias.slice(i, i + 40));
      return sentencias.length;
    },
  };

  return {
    contenido,
    fotos: {
      async guardar(foto, email) {
        await db
          .prepare(
            `INSERT INTO fotos (ruta, tipo, bytes, tamano, subida, subida_por) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (ruta) DO UPDATE SET tipo = excluded.tipo, bytes = excluded.bytes, tamano = excluded.tamano,
             subida = excluded.subida, subida_por = excluded.subida_por`,
          )
          .bind(foto.ruta, foto.tipo, foto.bytes, foto.bytes.byteLength, ahora(), email)
          .run();
      },
      async obtener(ruta) {
        const f = await db.prepare('SELECT ruta, tipo, bytes FROM fotos WHERE ruta = ?').bind(ruta).first<{ ruta: string; tipo: string; bytes: ArrayBuffer | number[] }>();
        return f ? { ruta: f.ruta, tipo: f.tipo, bytes: new Uint8Array(f.bytes) } : null;
      },
      async listar() {
        const filas = await db
          .prepare('SELECT ruta, tipo, tamano, subida, subida_por FROM fotos ORDER BY ruta')
          .all<{ ruta: string; tipo: string; tamano: number; subida: string; subida_por: string }>();
        return filas.results.map((f) => ({ ruta: f.ruta, tipo: f.tipo, tamano: f.tamano, subida: f.subida, subidaPor: f.subida_por }));
      },
      async borrar(ruta) {
        await db.prepare('DELETE FROM fotos WHERE ruta = ?').bind(ruta).run();
      },
    },
    usuarios: {
      async obtener(email) {
        const f = await db.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email.toLowerCase()).first<{ email: string; nombre: string; rol: Usuario['rol']; activo: number }>();
        return f ? { email: f.email, nombre: f.nombre, rol: f.rol, activo: f.activo === 1 } : null;
      },
      async listar() {
        const filas = await db.prepare('SELECT * FROM usuarios ORDER BY rol, email').all<{ email: string; nombre: string; rol: Usuario['rol']; activo: number }>();
        return filas.results.map((f) => ({ email: f.email, nombre: f.nombre, rol: f.rol, activo: f.activo === 1 }));
      },
      async guardar(u) {
        await db
          .prepare(
            `INSERT INTO usuarios (email, nombre, rol, activo, creado) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (email) DO UPDATE SET nombre = excluded.nombre, rol = excluded.rol, activo = excluded.activo`,
          )
          .bind(u.email.toLowerCase(), u.nombre, u.rol, u.activo ? 1 : 0, ahora())
          .run();
      },
    },
    auditoria: {
      async registrar(email, accion, detalle = '') {
        await db.prepare('INSERT INTO auditoria (fecha, email, accion, detalle) VALUES (?, ?, ?, ?)').bind(ahora(), email, accion, detalle).run();
      },
      async listar(limite = 50) {
        return (await db.prepare('SELECT * FROM auditoria ORDER BY id DESC LIMIT ?').bind(limite).all<{ id: number; fecha: string; email: string; accion: string; detalle: string }>()).results;
      },
    },
    publicaciones: {
      async registrar(email, estado, detalle = '') {
        await db.prepare('INSERT INTO publicaciones (fecha, email, estado, detalle) VALUES (?, ?, ?, ?)').bind(ahora(), email, estado, detalle).run();
      },
      async listar(limite = 20) {
        const filas = await db
          .prepare('SELECT * FROM publicaciones ORDER BY id DESC LIMIT ?')
          .bind(limite)
          .all<{ id: number; fecha: string; email: string; estado: 'lanzada' | 'sin-cambios' | 'error'; detalle: string; en_web: string | null }>();
        return filas.results.map(({ en_web, ...p }) => ({ ...p, enWeb: en_web }));
      },
      async pendientes(hasta) {
        const f = await db.prepare("SELECT COUNT(*) AS n FROM publicaciones WHERE estado = 'lanzada' AND en_web IS NULL AND fecha <= ?").bind(hasta).first<{ n: number }>();
        return f?.n ?? 0;
      },
      async marcarEnWeb(hasta) {
        const r = await db.prepare("UPDATE publicaciones SET en_web = ? WHERE estado = 'lanzada' AND en_web IS NULL AND fecha <= ?").bind(ahora(), hasta).run();
        return r.meta?.changes ?? 0;
      },
    },
    presupuestos: {
      async guardar(p) {
        await db
          .prepare(
            `INSERT INTO presupuestos (id, fecha, estado, idioma, tipo_pedido, nombre, email, telefono, empresa, provincia, mensaje, lineas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(p.id, p.fecha, p.estado, p.idioma, p.tipoPedido, p.nombre, p.email, p.telefono, p.empresa, p.provincia, p.mensaje, JSON.stringify(p.lineas))
          .run();
      },
      async obtener(id) {
        const f = await db.prepare('SELECT * FROM presupuestos WHERE id = ?').bind(id).first<FilaPresupuesto>();
        return f ? aPresupuesto(f) : null;
      },
      async listar(opciones = {}) {
        const filas = opciones.estado
          ? await db.prepare('SELECT * FROM presupuestos WHERE estado = ? ORDER BY fecha DESC LIMIT ?').bind(opciones.estado, opciones.limite ?? 200).all<FilaPresupuesto>()
          : await db.prepare('SELECT * FROM presupuestos ORDER BY fecha DESC LIMIT ?').bind(opciones.limite ?? 200).all<FilaPresupuesto>();
        return filas.results.map(aPresupuesto);
      },
      async cambiarEstado(id, estado) {
        const r = await db.prepare('UPDATE presupuestos SET estado = ? WHERE id = ?').bind(estado, id).run();
        return (r.meta?.changes ?? 0) > 0;
      },
      async borrar(id) {
        const r = await db.prepare('DELETE FROM presupuestos WHERE id = ?').bind(id).run();
        return (r.meta?.changes ?? 0) > 0;
      },
      async contar(estado) {
        return (await db.prepare('SELECT COUNT(*) AS n FROM presupuestos WHERE estado = ?').bind(estado).first<{ n: number }>())?.n ?? 0;
      },
    },
    usoAsistente: {
      async sumar(email, dia, cantidad = 1) {
        const f = await db
          .prepare(
            `INSERT INTO asistente_uso (email, dia, usos) VALUES (?, ?, ?)
             ON CONFLICT (email, dia) DO UPDATE SET usos = usos + excluded.usos RETURNING usos`,
          )
          .bind(email, dia, cantidad)
          .first<{ usos: number }>();
        return f?.usos ?? 1;
      },
      async obtener(email, dia) {
        return (await db.prepare('SELECT usos FROM asistente_uso WHERE email = ? AND dia = ?').bind(email, dia).first<{ usos: number }>())?.usos ?? 0;
      },
    },
    ...crearRepositoriosFacturacion(db),
    ...crearRepositoriosGastos(db),
    conversaciones: crearRepositorioConversaciones(db),
    inventario: crearRepositorioInventario(db),
    ...crearRepositoriosPortafolio(db),
    ...crearRepositorioPresupuestosCliente(db),
    ...crearRepositorioCatalogo(db),
    ...crearRepositorioProveedores(db),
  };
}
