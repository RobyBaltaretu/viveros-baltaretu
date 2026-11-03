import type { BaseD1, SentenciaD1 } from './base.ts';

export interface BucketPrivado {
  put(key: string, bytes: Uint8Array): Promise<unknown>;
  get(key: string): Promise<{arrayBuffer(): Promise<ArrayBuffer>} | null>;
  delete(key: string): Promise<void>;
}

export type BytesGuardados = ArrayBuffer | number[] | string;
export const LIMITE_IMAGENES = 5_000_000_000; // Margen sobre la franquicia compartida de la cuenta.
type Foto = {bytes: Uint8Array};
export type Imagenes = ReturnType<typeof imagenesPrivadas>;

export function imagenesPrivadas(db: BaseD1, bucket?: BucketPrivado, limite = LIMITE_IMAGENES, exigirR2 = false) {
  let preparada: Promise<unknown> | undefined;
  function preparar() {
    // Extensión aditiva y exclusiva de las bases con R2.
    return preparada ??= db.batch([
      db.prepare('CREATE TABLE IF NOT EXISTS turia_bytes_r2 (id INTEGER PRIMARY KEY CHECK(id=1), total INTEGER NOT NULL CHECK(total>=0))'),
      db.prepare('INSERT OR IGNORE INTO turia_bytes_r2 VALUES (1,0)'),
      db.prepare('CREATE TABLE IF NOT EXISTS turia_objetos_r2 (clave TEXT PRIMARY KEY, tamano INTEGER NOT NULL, creado TEXT DEFAULT CURRENT_TIMESTAMP)'),
      db.prepare('CREATE TRIGGER IF NOT EXISTS turia_bytes_alta AFTER INSERT ON turia_objetos_r2 BEGIN UPDATE turia_bytes_r2 SET total=total+NEW.tamano WHERE id=1; END'),
      db.prepare('CREATE TRIGGER IF NOT EXISTS turia_bytes_baja AFTER DELETE ON turia_objetos_r2 BEGIN UPDATE turia_bytes_r2 SET total=total-OLD.tamano WHERE id=1; END'),
    ]);
  }
  async function retirar(clave: unknown) {
    if (typeof clave !== 'string' || !clave.startsWith('privado/')) return;
    if (!bucket) throw Error('Almacén privado no disponible.');
    await bucket.delete(clave);
    await db.prepare('DELETE FROM turia_objetos_r2 WHERE clave=?').bind(clave).run();
  }
  return {
    retirar,
    async leer(valor: BytesGuardados) {
      if (typeof valor !== 'string') return new Uint8Array(valor);
      const objeto = await bucket?.get(valor);
      if (!objeto) throw Error('No se ha podido leer la imagen privada.');
      return new Uint8Array(await objeto.arrayBuffer());
    },
    async escribir(fotos: Foto[], sentencias: (punteros: (Uint8Array|string)[]) => SentenciaD1[]) {
      if (!bucket) {
        if (exigirR2) throw Error('El almacén privado de imágenes no está configurado.');
        await db.batch(sentencias(fotos.map(f => f.bytes)));
        return;
      }
      await preparar();
      const claves = fotos.map(() => 'privado/' + crypto.randomUUID());
      // La restricción NOT NULL provoca rollback del lote entero si no cabe alguna foto.
      try {
        await db.batch(fotos.map((f,i) => db.prepare(`INSERT INTO turia_objetos_r2(clave,tamano)
          SELECT ?,CASE WHEN total+?<=? THEN ? ELSE NULL END FROM turia_bytes_r2 WHERE id=1`)
          .bind(claves[i],f.bytes.byteLength,limite,f.bytes.byteLength)));
      } catch (e) {
        if (String(e).includes('NOT NULL')) throw Error('Se ha alcanzado el límite de fotos del taller.');
        throw e;
      }
      try {
        for (const [i,f] of fotos.entries()) await bucket.put(claves[i],f.bytes);
      } catch (e) {
        for (const clave of claves) await retirar(clave);
        throw e;
      }
      // Si D1 no confirma el resultado, conservar los objetos y su reserva. La
      // conciliación operativa puede liberarlos tras verificar que no tienen referencia.
      await db.batch(sentencias(claves));
    },
  };
}
