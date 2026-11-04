import type { Imagenes } from './imagenes-r2';
import type {
  ArticuloCatalogo, ConfigurableCatalogo, DecorativoCatalogo, FamiliaCatalogo,
  ImportacionCatalogo, PlantillaCatalogo, Repositorios, VarianteCatalogo,
} from '../tipos.ts';
import type { BaseD1 } from './base.ts';
import { claveNormalizada } from '../../catalogo/modelo.ts';

/** Catálogo de la carpintería (artículos y plantillas) sobre D1. */
const ahora = () => new Date().toISOString();

interface FilaArticulo {
  id: string;
  categoria: string;
  nombre: string;
  unidad: string;
  coste: number;
  datos: string;
  archivado: number;
  actualizado: string;
}
type DatosArticulo = Pick<ArticuloCatalogo, 'merma' | 'margen' | 'precioFijo' | 'referencia' | 'proveedor' | 'espesor' | 'acabado' | 'notas' | 'visual'>;

const aArticulo = (f: FilaArticulo): ArticuloCatalogo => {
  const d = JSON.parse(f.datos) as DatosArticulo;
  if (d.visual?.textura?.startsWith('/api/panel/foto?ruta=catalogo-materiales%2F')) {
    d.visual.textura = d.visual.textura.replace('/panel/foto?', '/panel/catalogo-muestra?');
  }
  return { id: f.id, categoria: f.categoria, nombre: f.nombre, unidad: f.unidad, coste: f.coste, ...d, archivado: f.archivado === 1, actualizado: f.actualizado };
};

interface FilaPlantilla {
  id: string;
  nombre: string;
  tipo_trabajo: string;
  datos: string;
  orden: number;
  archivado: number;
  actualizado: string;
}
type DatosPlantilla = Pick<PlantillaCatalogo, 'descripcion' | 'parametros' | 'opciones' | 'componentes'>;

const aPlantilla = (f: FilaPlantilla): PlantillaCatalogo => {
  const d = JSON.parse(f.datos) as DatosPlantilla;
  return { id: f.id, nombre: f.nombre, tipoTrabajo: f.tipo_trabajo, ...d, orden: f.orden, archivado: f.archivado === 1, actualizado: f.actualizado };
};

interface FilaEstructurada { id: string; datos: string; actualizado: string }
const desdeDatos = <T extends { id: string; actualizado: string }>(f: FilaEstructurada): T => ({ id: f.id, ...JSON.parse(f.datos), actualizado: f.actualizado }) as T;
const datosSinSistema = <T extends { id: string; actualizado?: string }>(valor: T) => {
  const { id: _id, actualizado: _actualizado, ...datos } = valor;
  return datos;
};

export function crearRepositorioCatalogo(db: BaseD1, imagenes: Imagenes): Pick<Repositorios, 'catalogo'> {
  return {
    catalogo: {
      async articulos(opciones = {}) {
        const sql = `SELECT * FROM catalogo_articulos ${opciones.incluirArchivados ? '' : 'WHERE archivado = 0'} ORDER BY categoria, nombre`;
        return (await db.prepare(sql).all<FilaArticulo>()).results.map(aArticulo);
      },
      async articulo(id) {
        const f = await db.prepare('SELECT * FROM catalogo_articulos WHERE id = ?').bind(id).first<FilaArticulo>();
        return f ? aArticulo(f) : null;
      },
      async guardarArticulo(a, email) {
        const datos: DatosArticulo = { merma: a.merma, margen: a.margen, precioFijo: a.precioFijo, referencia: a.referencia, proveedor: a.proveedor, espesor: a.espesor, acabado: a.acabado, notas: a.notas, ...(a.visual ? {visual:a.visual} : {}) };
        const t = ahora();
        await db
          .prepare(
            `INSERT INTO catalogo_articulos (id, categoria, nombre, unidad, coste, datos, archivado, creado, actualizado, actualizado_por)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET categoria = excluded.categoria, nombre = excluded.nombre, unidad = excluded.unidad, coste = excluded.coste,
               datos = excluded.datos, actualizado = excluded.actualizado, actualizado_por = excluded.actualizado_por`,
          )
          .bind(a.id, a.categoria, a.nombre, a.unidad, a.coste, JSON.stringify(datos), t, t, email)
          .run();
      },
      async insertarArticuloSiNuevo(a, email, muestra) {
        const datos: DatosArticulo = { merma: a.merma, margen: a.margen, precioFijo: a.precioFijo, referencia: a.referencia, proveedor: a.proveedor, espesor: a.espesor, acabado: a.acabado, notas: a.notas, ...(a.visual ? {visual:a.visual} : {}) };
        const t = ahora();
        const insercion = db.prepare(
          `INSERT INTO catalogo_articulos (id, categoria, nombre, unidad, coste, datos, archivado, creado, actualizado, actualizado_por)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        ).bind(a.id, a.categoria, a.nombre, a.unidad, a.coste, JSON.stringify(datos), t, t, email);
        try {
          if (muestra) {
            await imagenes.escribir([muestra], ([puntero]) => [insercion, db.prepare(
              'INSERT INTO adjuntos (id,ambito,ref,tipo,bytes,tamano,creado,creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(muestra.ruta, 'catalogo', a.id, 'image/webp', puntero, muestra.bytes.length, t, email)]);
          } else await insercion.run();
          return true;
        } catch (e) {
          if (String(e).includes('UNIQUE constraint failed: catalogo_articulos.id')) return false;
          throw e;
        }
      },
      async archivarArticulo(id, archivado, email) {
        const r = await db.prepare('UPDATE catalogo_articulos SET archivado = ?, actualizado = ?, actualizado_por = ? WHERE id = ?').bind(archivado ? 1 : 0, ahora(), email, id).run();
        return (r.meta?.changes ?? 0) > 0;
      },
      async plantillas(opciones = {}) {
        const sql = `SELECT * FROM catalogo_plantillas ${opciones.incluirArchivadas ? '' : 'WHERE archivado = 0'} ORDER BY orden, nombre`;
        return (await db.prepare(sql).all<FilaPlantilla>()).results.map(aPlantilla);
      },
      async plantilla(id) {
        const f = await db.prepare('SELECT * FROM catalogo_plantillas WHERE id = ?').bind(id).first<FilaPlantilla>();
        return f ? aPlantilla(f) : null;
      },
      async guardarPlantilla(p, email) {
        const datos: DatosPlantilla = { descripcion: p.descripcion, parametros: p.parametros, opciones: p.opciones, componentes: p.componentes };
        const t = ahora();
        await db
          .prepare(
            `INSERT INTO catalogo_plantillas (id, nombre, tipo_trabajo, datos, orden, archivado, creado, actualizado, actualizado_por)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, tipo_trabajo = excluded.tipo_trabajo, datos = excluded.datos, orden = excluded.orden,
               actualizado = excluded.actualizado, actualizado_por = excluded.actualizado_por`,
          )
          .bind(p.id, p.nombre, p.tipoTrabajo, JSON.stringify(datos), p.orden, t, t, email)
          .run();
      },
      async archivarPlantilla(id, archivado, email) {
        const r = await db.prepare('UPDATE catalogo_plantillas SET archivado = ?, actualizado = ?, actualizado_por = ? WHERE id = ?').bind(archivado ? 1 : 0, ahora(), email, id).run();
        return (r.meta?.changes ?? 0) > 0;
      },
      async borrarPruebas() {
        const a = await db.prepare("DELETE FROM catalogo_articulos WHERE id LIKE 'prueba-%'").run();
        const p = await db.prepare("DELETE FROM catalogo_plantillas WHERE id LIKE 'prueba-%'").run();
        return (a.meta?.changes ?? 0) + (p.meta?.changes ?? 0);
      },
      async familias(opciones = {}) {
        const sql = `SELECT id, datos, actualizado FROM catalogo_familias ${opciones.incluirDescatalogadas ? '' : "WHERE estado != 'descatalogado'"} ORDER BY categoria, nombre`;
        return (await db.prepare(sql).all<FilaEstructurada>()).results.map((f) => desdeDatos<FamiliaCatalogo>(f));
      },
      async familia(id) {
        const f = await db.prepare('SELECT id, datos, actualizado FROM catalogo_familias WHERE id = ?').bind(id).first<FilaEstructurada>();
        return f ? desdeDatos<FamiliaCatalogo>(f) : null;
      },
      async guardarFamilia(familia, email) {
        const t = ahora();
        const identidad = claveNormalizada(familia.proveedor, familia.codigo || familia.nombre, familia.categoria, familia.tipo);
        await db.prepare(
          `INSERT INTO catalogo_familias (id, identidad, codigo, nombre, categoria, tipo, proveedor, datos, estado, creado, actualizado, actualizado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET codigo=excluded.codigo, nombre=excluded.nombre, categoria=excluded.categoria,
             tipo=excluded.tipo, proveedor=excluded.proveedor, datos=excluded.datos, estado=excluded.estado,
             actualizado=excluded.actualizado, actualizado_por=excluded.actualizado_por`,
        ).bind(familia.id, identidad, familia.codigo, familia.nombre, familia.categoria, familia.tipo, familia.proveedor,
          JSON.stringify(datosSinSistema(familia)), familia.estado, t, t, email).run();
      },
      async variantes(opciones = {}) {
        const condiciones: string[] = [];
        const valores: string[] = [];
        if (opciones.familiaId) { condiciones.push('familia_id = ?'); valores.push(opciones.familiaId); }
        if (opciones.articuloId) { condiciones.push('articulo_id = ?'); valores.push(opciones.articuloId); }
        if (!opciones.incluirDescatalogadas) condiciones.push("estado != 'descatalogado'");
        const sql = `SELECT id, datos, actualizado FROM catalogo_variantes ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''} ORDER BY referencia, formato, espesor_mm`;
        return (await db.prepare(sql).bind(...valores).all<FilaEstructurada>()).results.map((f) => desdeDatos<VarianteCatalogo>(f));
      },
      async variante(id) {
        const f = await db.prepare('SELECT id, datos, actualizado FROM catalogo_variantes WHERE id = ?').bind(id).first<FilaEstructurada>();
        return f ? desdeDatos<VarianteCatalogo>(f) : null;
      },
      async guardarVariante(variante, email) {
        const t = ahora();
        const identidad = claveNormalizada(variante.familiaId, variante.referencia, variante.codigo, variante.soporte,
          variante.dimensiones.largoMm, variante.dimensiones.anchoMm, variante.dimensiones.espesorMm,
          variante.acabado, variante.tratamiento, variante.calidad);
        await db.prepare(
          `INSERT INTO catalogo_variantes (id, identidad, familia_id, articulo_id, referencia, soporte, formato, espesor_mm, datos, estado, creado, actualizado, actualizado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET referencia=excluded.referencia, soporte=excluded.soporte, formato=excluded.formato,
             espesor_mm=excluded.espesor_mm, datos=excluded.datos, estado=excluded.estado,
             actualizado=excluded.actualizado, actualizado_por=excluded.actualizado_por`,
        ).bind(variante.id, identidad, variante.familiaId, variante.articuloId, variante.referencia, variante.soporte,
          variante.dimensiones.textoOriginal, variante.dimensiones.espesorMm, JSON.stringify(datosSinSistema(variante)),
          variante.estado, t, t, email).run();
        for (const decorativoId of variante.decorativoIds) await db.prepare(
          'INSERT OR IGNORE INTO catalogo_variante_decorativos (variante_id, decorativo_id, rol) VALUES (?, ?, ?)'
        ).bind(variante.id, decorativoId, 'principal').run();
      },
      async decorativos(opciones = {}) {
        const sql = `SELECT id, datos, actualizado FROM catalogo_decorativos ${opciones.fabricante ? 'WHERE fabricante = ?' : ''} ORDER BY fabricante, codigo, nombre`;
        const consulta = db.prepare(sql);
        const resultado = opciones.fabricante ? await consulta.bind(opciones.fabricante).all<FilaEstructurada>() : await consulta.all<FilaEstructurada>();
        return resultado.results.map((f) => desdeDatos<DecorativoCatalogo>(f));
      },
      async guardarDecorativo(decorativo, email) {
        const t = ahora();
        const identidad = claveNormalizada(decorativo.fabricante, decorativo.coleccion, decorativo.codigo || decorativo.nombre);
        await db.prepare(
          `INSERT INTO catalogo_decorativos (id, identidad, fabricante, codigo, nombre, datos, creado, actualizado, actualizado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET fabricante=excluded.fabricante, codigo=excluded.codigo, nombre=excluded.nombre,
             datos=excluded.datos, actualizado=excluded.actualizado, actualizado_por=excluded.actualizado_por`,
        ).bind(decorativo.id, identidad, decorativo.fabricante, decorativo.codigo, decorativo.nombre,
          JSON.stringify(datosSinSistema(decorativo)), t, t, email).run();
      },
      async configurables() {
        return (await db.prepare('SELECT id, datos, actualizado FROM catalogo_configurables ORDER BY nombre').all<FilaEstructurada>()).results
          .map((f) => desdeDatos<ConfigurableCatalogo>(f));
      },
      async guardarConfigurable(configurable, email) {
        const t = ahora();
        await db.prepare(
          `INSERT INTO catalogo_configurables (id, familia_id, nombre, datos, creado, actualizado, actualizado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET familia_id=excluded.familia_id, nombre=excluded.nombre, datos=excluded.datos,
             actualizado=excluded.actualizado, actualizado_por=excluded.actualizado_por`,
        ).bind(configurable.id, configurable.familiaId, configurable.nombre, JSON.stringify(datosSinSistema(configurable)), t, t, email).run();
      },
      async importacion(id) {
        const f = await db.prepare('SELECT id, datos, actualizado FROM catalogo_importaciones WHERE id = ?').bind(id).first<FilaEstructurada>();
        return f ? desdeDatos<ImportacionCatalogo>(f) : null;
      },
      async guardarImportacion(importacion, email) {
        const t = ahora();
        await db.prepare(
          `INSERT INTO catalogo_importaciones (id, proveedor, documento, estado, datos, creado, actualizado, actualizado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET estado=excluded.estado, datos=excluded.datos,
             actualizado=excluded.actualizado, actualizado_por=excluded.actualizado_por`,
        ).bind(importacion.id, importacion.proveedor, importacion.documento, importacion.estado,
          JSON.stringify(datosSinSistema(importacion)), t, t, email).run();
      },
      async reservarLoteImportacion(importacionId, loteId, email) {
        const r = await db.prepare(
          `INSERT INTO catalogo_importacion_lotes (importacion_id, lote_id, estado, resumen, actualizado, actualizado_por)
           VALUES (?, ?, 'procesando', '{}', ?, ?)
           ON CONFLICT (importacion_id, lote_id) DO UPDATE SET estado='procesando', actualizado=excluded.actualizado,
             actualizado_por=excluded.actualizado_por WHERE catalogo_importacion_lotes.estado='fallido'`
        ).bind(importacionId, loteId, ahora(), email).run();
        return (r.meta?.changes ?? 0) > 0;
      },
      async completarLoteImportacion(importacionId, loteId, resumen, email) {
        await db.prepare(
          `UPDATE catalogo_importacion_lotes SET estado='completado', resumen=?, actualizado=?, actualizado_por=?
           WHERE importacion_id=? AND lote_id=?`
        ).bind(JSON.stringify(resumen), ahora(), email, importacionId, loteId).run();
      },
      async fallarLoteImportacion(importacionId,loteId,email){
        await db.prepare(
          `UPDATE catalogo_importacion_lotes SET estado='fallido', actualizado=?, actualizado_por=?
           WHERE importacion_id=? AND lote_id=? AND estado='procesando'`
        ).bind(ahora(),email,importacionId,loteId).run();
      },
    },
  };
}
