import type { MensajeAsistente, Propuesta, RepositorioConversaciones } from '../tipos.ts';
import type { BaseD1 } from './base.ts';

/** Conversaciones del asistente, sus mensajes y las propuestas por confirmar, en D1. */
const ahora = () => new Date().toISOString();

interface FilaPropuesta {
  id: string;
  conversacion: string;
  email: string;
  herramienta: string;
  argumentos: string;
  resumen: string;
  estado: Propuesta['estado'];
  resultado: string;
  creada: string;
}
const aPropuesta = (f: FilaPropuesta): Propuesta => ({ ...f, argumentos: JSON.parse(f.argumentos) as Record<string, unknown> });

export function crearRepositorioConversaciones(db: BaseD1): RepositorioConversaciones {
  const nueva = async (email: string) => {
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO asistente_conversaciones (id, email, creada) VALUES (?, ?, ?)').bind(id, email, ahora()).run();
    return id;
  };
  return {
    async actual(email) {
      const f = await db.prepare('SELECT id FROM asistente_conversaciones WHERE email = ? ORDER BY creada DESC LIMIT 1').bind(email).first<{ id: string }>();
      return f?.id ?? nueva(email);
    },
    nueva,
    async mensajes(conversacion, limite = 40) {
      const filas = await db
        .prepare('SELECT * FROM (SELECT * FROM asistente_mensajes WHERE conversacion = ? ORDER BY id DESC LIMIT ?) ORDER BY id')
        .bind(conversacion, limite)
        .all<Omit<MensajeAsistente, 'propuestas'> & { propuestas: string }>();
      return filas.results.map((f) => ({ ...f, propuestas: JSON.parse(f.propuestas) as string[] }));
    },
    async anadir(m) {
      await db
        .prepare('INSERT INTO asistente_mensajes (conversacion, rol, texto, propuestas, fecha) VALUES (?, ?, ?, ?, ?)')
        .bind(m.conversacion, m.rol, m.texto, JSON.stringify(m.propuestas), ahora())
        .run();
    },
    async guardarPropuesta(p) {
      await db
        .prepare('INSERT INTO asistente_propuestas (id, conversacion, email, herramienta, argumentos, resumen, estado, resultado, creada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(p.id, p.conversacion, p.email, p.herramienta, JSON.stringify(p.argumentos), p.resumen, p.estado, p.resultado, p.creada)
        .run();
    },
    async propuesta(id) {
      const f = await db.prepare('SELECT * FROM asistente_propuestas WHERE id = ?').bind(id).first<FilaPropuesta>();
      return f ? aPropuesta(f) : null;
    },
    async propuestas(ids) {
      if (!ids.length) return [];
      const filas = await db
        .prepare(`SELECT * FROM asistente_propuestas WHERE id IN (${ids.map(() => '?').join(', ')})`)
        .bind(...ids)
        .all<FilaPropuesta>();
      const porId = new Map(filas.results.map((f) => [f.id, aPropuesta(f)]));
      return ids.map((i) => porId.get(i)).filter((p): p is Propuesta => !!p);
    },
    async resolver(id, estado, resultado) {
      const r = await db.prepare("UPDATE asistente_propuestas SET estado = ?, resultado = ? WHERE id = ? AND estado = 'pendiente'").bind(estado, resultado, id).run();
      return (r.meta?.changes ?? 0) > 0;
    },
    async anotar(id, estado, resultado) {
      await db.prepare('UPDATE asistente_propuestas SET estado = ?, resultado = ? WHERE id = ?').bind(estado, resultado, id).run();
    },
  };
}
