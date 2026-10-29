import type { ArticuloCatalogo, PlantillaCatalogo, Repositorios } from '../tipos.ts';
import type { BaseD1 } from './base.ts';

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
type DatosArticulo = Pick<ArticuloCatalogo, 'merma' | 'margen' | 'precioFijo' | 'referencia' | 'proveedor' | 'espesor' | 'acabado' | 'notas'>;

const aArticulo = (f: FilaArticulo): ArticuloCatalogo => {
  const d = JSON.parse(f.datos) as DatosArticulo;
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

export function crearRepositorioCatalogo(db: BaseD1): Pick<Repositorios, 'catalogo'> {
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
        const datos: DatosArticulo = { merma: a.merma, margen: a.margen, precioFijo: a.precioFijo, referencia: a.referencia, proveedor: a.proveedor, espesor: a.espesor, acabado: a.acabado, notas: a.notas };
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
    },
  };
}
