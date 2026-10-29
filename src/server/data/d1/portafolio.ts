import type { Adjunto, ProyectoPortafolio, Repositorios } from '../tipos.ts';
import type { BaseD1 } from './base.ts';

/** Portafolio privado y adjuntos sobre D1. */
const ahora = () => new Date().toISOString();

interface FilaProyecto {
  id: string;
  titulo: string;
  categoria: string;
  datos: string;
  orden: number;
  archivado: number;
  actualizado: string;
}
type DatosProyecto = Pick<ProyectoPortafolio, 'descripcion' | 'materiales' | 'anio' | 'localidad' | 'antes' | 'despues' | 'destacado'>;

const aProyecto = (f: FilaProyecto): ProyectoPortafolio => {
  const d = JSON.parse(f.datos) as DatosProyecto;
  return { id: f.id, titulo: f.titulo, categoria: f.categoria, ...d, orden: f.orden, archivado: f.archivado === 1, actualizado: f.actualizado };
};

interface FilaAdjunto {
  id: string;
  ambito: string;
  ref: string;
  tipo: string;
  tamano: number;
  creado: string;
}
const aAdjunto = (f: FilaAdjunto): Adjunto => ({ id: f.id, ambito: f.ambito, ref: f.ref, tipo: f.tipo, tamano: f.tamano, creado: f.creado });

export function crearRepositoriosPortafolio(db: BaseD1): Pick<Repositorios, 'portafolio' | 'adjuntos'> {
  return {
    portafolio: {
      async listar(opciones = {}) {
        const sql = `SELECT * FROM portafolio ${opciones.incluirArchivados ? '' : 'WHERE archivado = 0'} ORDER BY orden, creado DESC`;
        return (await db.prepare(sql).all<FilaProyecto>()).results.map(aProyecto);
      },
      async obtener(id) {
        const f = await db.prepare('SELECT * FROM portafolio WHERE id = ?').bind(id).first<FilaProyecto>();
        return f ? aProyecto(f) : null;
      },
      async guardar(p, email) {
        const datos: DatosProyecto = { descripcion: p.descripcion, materiales: p.materiales, anio: p.anio, localidad: p.localidad, antes: p.antes, despues: p.despues, destacado: p.destacado };
        const t = ahora();
        await db
          .prepare(
            `INSERT INTO portafolio (id, titulo, categoria, datos, orden, archivado, creado, actualizado, actualizado_por) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET titulo = excluded.titulo, categoria = excluded.categoria, datos = excluded.datos, orden = excluded.orden,
             actualizado = excluded.actualizado, actualizado_por = excluded.actualizado_por`,
          )
          .bind(p.id, p.titulo, p.categoria, JSON.stringify(datos), p.orden, t, t, email)
          .run();
      },
      async archivar(id, archivado, email) {
        const r = await db.prepare('UPDATE portafolio SET archivado = ?, actualizado = ?, actualizado_por = ? WHERE id = ?').bind(archivado ? 1 : 0, ahora(), email, id).run();
        return (r.meta?.changes ?? 0) > 0;
      },
      async borrar(id) {
        const r = await db.prepare('DELETE FROM portafolio WHERE id = ?').bind(id).run();
        return (r.meta?.changes ?? 0) > 0;
      },
    },
    adjuntos: {
      async guardar(a, email) {
        await db
          .prepare('INSERT INTO adjuntos (id, ambito, ref, tipo, bytes, tamano, creado, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(a.id, a.ambito, a.ref, a.tipo, a.bytes, a.bytes.byteLength, ahora(), email)
          .run();
      },
      async obtener(id) {
        const f = await db.prepare('SELECT * FROM adjuntos WHERE id = ?').bind(id).first<FilaAdjunto & { bytes: ArrayBuffer | number[] }>();
        return f ? { ...aAdjunto(f), bytes: new Uint8Array(f.bytes) } : null;
      },
      async listar(ambito, ref) {
        const filas = await db.prepare('SELECT id, ambito, ref, tipo, tamano, creado FROM adjuntos WHERE ambito = ? AND ref = ? ORDER BY creado').bind(ambito, ref).all<FilaAdjunto>();
        return filas.results.map(aAdjunto);
      },
      async borrar(id) {
        const r = await db.prepare('DELETE FROM adjuntos WHERE id = ?').bind(id).run();
        return (r.meta?.changes ?? 0) > 0;
      },
      async borrarDe(ambito, ref) {
        const r = await db.prepare('DELETE FROM adjuntos WHERE ambito = ? AND ref = ?').bind(ambito, ref).run();
        return r.meta?.changes ?? 0;
      },
    },
  };
}
