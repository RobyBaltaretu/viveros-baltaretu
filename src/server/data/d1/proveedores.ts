import type { Proveedor, Repositorios } from '../tipos.ts';
import type { BaseD1 } from './base.ts';

/** Proveedores sobre D1: nombre y NIF en columnas (para ordenar y buscar), lo demás en `datos`. */
const ahora = () => new Date().toISOString();
type Datos = Omit<Proveedor, 'id' | 'nombre' | 'nif' | 'archivado' | 'actualizado'>;

interface Fila {
  id: string;
  nombre: string;
  nif: string;
  datos: string;
  archivado: number;
  actualizado: string;
}

const aProveedor = (f: Fila): Proveedor => ({ ...(JSON.parse(f.datos) as Datos), id: f.id, nombre: f.nombre, nif: f.nif, archivado: f.archivado === 1, actualizado: f.actualizado });

export function crearRepositorioProveedores(db: BaseD1): Pick<Repositorios, 'proveedores'> {
  return {
    proveedores: {
      async listar(opciones = {}) {
        const sql = `SELECT * FROM proveedores ${opciones.incluirArchivados ? '' : 'WHERE archivado = 0'} ORDER BY nombre COLLATE NOCASE`;
        return (await db.prepare(sql).all<Fila>()).results.map(aProveedor);
      },
      async obtener(id) {
        const f = await db.prepare('SELECT * FROM proveedores WHERE id = ?').bind(id).first<Fila>();
        return f ? aProveedor(f) : null;
      },
      async guardar(p, email) {
        const { id, nombre, nif, archivado, ...datos } = p;
        await db
          .prepare(
            `INSERT INTO proveedores (id, nombre, nif, datos, archivado, actualizado, actualizado_por) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, nif = excluded.nif, datos = excluded.datos, archivado = excluded.archivado,
               actualizado = excluded.actualizado, actualizado_por = excluded.actualizado_por`,
          )
          .bind(id, nombre, nif, JSON.stringify(datos satisfies Datos), archivado ? 1 : 0, ahora(), email)
          .run();
      },
      async borrarPruebas() {
        const r = await db.prepare("DELETE FROM proveedores WHERE id LIKE 'prueba-%'").run();
        return r.meta?.changes ?? 0;
      },
    },
  };
}
