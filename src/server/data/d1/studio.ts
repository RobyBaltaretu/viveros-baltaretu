import type { BaseD1 } from './base.ts';

/**
 * Sentencias de Turia Studio (bocetos, sus archivos privados, versiones y
 * generaciones). Todas filtran por `cliente_id`: un cliente nunca ve lo de otro.
 * Las API las usan con `.bind(...)` y `.first/.all/.run` o en `db.batch`, igual
 * que antes; así el SQL vive solo en la capa de datos (tests/panel/arquitectura).
 */
export function sentenciasStudio(db: BaseD1) {
  return {
    leerBoceto: () => db.prepare('SELECT id,estado FROM studio_bocetos WHERE id=? AND cliente_id=?'),
    insertarArchivo: () => db.prepare('INSERT INTO studio_boceto_archivos(id,boceto_id,cliente_id,clase,objeto_r2,mime,tamano,creado) VALUES (?,?,?,?,?,?,?,?)'),
    leerArchivo: () => db.prepare('SELECT objeto_r2 FROM studio_boceto_archivos WHERE id=? AND cliente_id=?'),
    leerBoceto2: () => db.prepare('SELECT id,titulo,estado,interpretacion,revision,actualizado FROM studio_bocetos WHERE id=? AND cliente_id=?'),
    leerBoceto3: () => db.prepare('SELECT id,titulo,estado,revision,actualizado FROM studio_bocetos WHERE cliente_id=? ORDER BY actualizado DESC LIMIT 100'),
    insertarBoceto: () => db.prepare('INSERT INTO studio_bocetos(id,cliente_id,titulo,estado,interpretacion,revision,creado,actualizado,actualizado_por) VALUES (?,?,?,?,?,1,?,?,?)'),
    insertarVersion: () => db.prepare('INSERT INTO studio_boceto_versiones(boceto_id,revision,interpretacion,creado,creado_por) VALUES (?,1,?,?,?)'),
    leerArchivo2: () => db.prepare('SELECT id,clase FROM studio_boceto_archivos WHERE boceto_id=? AND cliente_id=? AND id IN (?,?)'),
    leerBoceto4: () => db.prepare('SELECT revision,estado FROM studio_bocetos WHERE id=? AND cliente_id=?'),
    actualizarBoceto: () => db.prepare('UPDATE studio_bocetos SET interpretacion=?,estado=?,revision=?,titulo=COALESCE(?,titulo),actualizado=?,actualizado_por=? WHERE id=? AND cliente_id=? AND revision=? AND estado<>?'),
    insertarVersion2: () => db.prepare('INSERT INTO studio_boceto_versiones(boceto_id,revision,interpretacion,creado,creado_por) SELECT id,revision,interpretacion,?,? FROM studio_bocetos WHERE id=? AND cliente_id=? AND revision=?'),
    leerBoceto5: () => db.prepare('SELECT revision,interpretacion FROM studio_bocetos WHERE id=? AND cliente_id=?'),
    leerBoceto6: () => db.prepare('SELECT titulo,estado,interpretacion FROM studio_bocetos WHERE id=? AND cliente_id=?'),
    insertarBoceto2: () => db.prepare('INSERT INTO studio_bocetos(id,cliente_id,titulo,estado,interpretacion,revision,creado,actualizado,actualizado_por,origen_boceto_id) VALUES (?,?,?,?,?,1,?,?,?,?)'),
    leerGeneracion: () => db.prepare('SELECT id,revision,estado,resultado_archivo_id FROM studio_generaciones WHERE cliente_id=? AND boceto_id=? AND clave_idempotencia=?'),
    leerBoceto7: () => db.prepare('SELECT revision,interpretacion FROM studio_bocetos WHERE id=? AND cliente_id=? AND estado=?'),
    leerArchivo3: () => db.prepare('SELECT id,objeto_r2,mime,clase FROM studio_boceto_archivos WHERE boceto_id=? AND cliente_id=? AND id IN (?,?)'),
    leerGeneracion2: () => db.prepare('SELECT id FROM studio_generaciones WHERE boceto_id=? AND cliente_id=? AND revision=? AND estado=? LIMIT 1'),
    insertarGeneracion: () => db.prepare('INSERT INTO studio_generaciones(id,boceto_id,cliente_id,revision,estado,solicitud,coste_estimado_cent,creado,actualizado,clave_idempotencia) VALUES (?,?,?,?,?,?,?,?,?,?)'),
    actualizarGeneracion: () => db.prepare('UPDATE studio_generaciones SET estado=?,error=?,actualizado=? WHERE id=?'),
    actualizarGeneracion2: () => db.prepare('UPDATE studio_generaciones SET estado=?,resultado_archivo_id=?,actualizado=? WHERE id=? AND cliente_id=?'),
    leerGeneracion3: () => db.prepare('SELECT id,estado,resultado_archivo_id,creado,error FROM studio_generaciones WHERE boceto_id=? AND cliente_id=? ORDER BY creado DESC LIMIT 20'),
    leerArchivo4: () => db.prepare('SELECT id,objeto_r2 FROM studio_boceto_archivos WHERE boceto_id=? AND cliente_id=? AND id IN (?,?)'),
    actualizarBoceto2: () => db.prepare('UPDATE studio_bocetos SET interpretacion=?,estado=?,revision=?,actualizado=?,actualizado_por=? WHERE id=? AND cliente_id=? AND revision=?'),
    insertarVersion3: () => db.prepare('INSERT INTO studio_boceto_versiones(boceto_id,revision,interpretacion,creado,creado_por) VALUES (?,?,?,?,?)'),
    /** Generación colgada (más de 15 min «procesando»): se da por fallida para poder reintentar. */
    marcarGeneracionCaducada: () => db.prepare("UPDATE studio_generaciones SET estado='fallida',error='Tiempo de ejecución excedido; consumo del proveedor sin confirmar',actualizado=? WHERE id=? AND cliente_id=? AND estado='procesando' AND creado<?"),
  };
}
