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
  const crear = async (email: string) => {
    const id = crypto.randomUUID();
    const t = ahora();
    await db.prepare('INSERT INTO asistente_conversaciones (id, email, creada, usada) VALUES (?, ?, ?, ?)').bind(id, email, t, t).run();
    return id;
  };
  const abierta = (email: string) =>
    db.prepare('SELECT id FROM asistente_conversaciones WHERE email = ? ORDER BY COALESCE(usada, creada) DESC, rowid DESC LIMIT 1').bind(email).first<{ id: string }>();
  const vacia = async (id: string) => !(await db.prepare('SELECT 1 FROM asistente_mensajes WHERE conversacion = ? LIMIT 1').bind(id).first());
  return {
    async actual(email) {
      return (await abierta(email))?.id ?? crear(email);
    },
    async nueva(email) {
      const f = await abierta(email);
      return f && (await vacia(f.id)) ? f.id : crear(email);
    },
    async listar(email, limite = 50) {
      const filas = await db
        .prepare(
          `SELECT c.id, c.creada, COALESCE(c.usada, c.creada) AS usada, COUNT(m.id) AS mensajes,
             (SELECT texto FROM asistente_mensajes WHERE conversacion = c.id AND rol = 'usuario' ORDER BY id LIMIT 1) AS titulo
           FROM asistente_conversaciones c JOIN asistente_mensajes m ON m.conversacion = c.id
           WHERE c.email = ? GROUP BY c.id ORDER BY usada DESC, c.rowid DESC LIMIT ?`,
        )
        .bind(email, limite)
        .all<{ id: string; creada: string; usada: string; mensajes: number; titulo: string | null }>();
      return filas.results.map((f) => ({ ...f, titulo: (f.titulo ?? 'Conversación').slice(0, 90) }));
    },
    async abrir(email, id) {
      const r = await db.prepare('UPDATE asistente_conversaciones SET usada = ? WHERE id = ? AND email = ?').bind(ahora(), id, email).run();
      return (r.meta?.changes ?? 0) > 0;
    },
    async borrar(email, id) {
      const r = await db.prepare('DELETE FROM asistente_conversaciones WHERE id = ? AND email = ?').bind(id, email).run();
      if (!(r.meta?.changes ?? 0)) return false;
      // Las propuestas sin responder se descartan; las resueltas se quedan (la auditoría ya las tiene).
      await db.batch([
        db.prepare('DELETE FROM asistente_mensajes WHERE conversacion = ?').bind(id),
        db.prepare("UPDATE asistente_propuestas SET estado = 'rechazada', resultado = 'Conversación borrada.' WHERE conversacion = ? AND estado = 'pendiente'").bind(id),
      ]);
      return true;
    },
    async mensajes(conversacion, limite = 40) {
      const filas = await db
        .prepare('SELECT * FROM (SELECT * FROM asistente_mensajes WHERE conversacion = ? ORDER BY id DESC LIMIT ?) ORDER BY id')
        .bind(conversacion, limite)
        .all<Omit<MensajeAsistente, 'propuestas'> & { propuestas: string }>();
      return filas.results.map((f) => ({ ...f, propuestas: JSON.parse(f.propuestas) as string[] }));
    },
    async anadir(m) {
      const t = ahora();
      await db.batch([
        db.prepare('INSERT INTO asistente_mensajes (conversacion, rol, texto, propuestas, fecha) VALUES (?, ?, ?, ?, ?)').bind(m.conversacion, m.rol, m.texto, JSON.stringify(m.propuestas), t),
        db.prepare('UPDATE asistente_conversaciones SET usada = ? WHERE id = ?').bind(t, m.conversacion),
      ]);
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
