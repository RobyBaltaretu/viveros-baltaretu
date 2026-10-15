import type { Repositorios } from '../data/tipos.ts';
import { prepararAccion } from './acciones.ts';
import { interpretarConRespaldo, type Interprete } from './interprete.ts';

/** Una frase del banco de pruebas y lo que debería entenderse. */
export interface FraseBanco {
  frase: string;
  tipo: string;
  planta?: string;
  valor?: number | string | null;
}

export interface ResultadoBanco {
  total: number;
  aciertos: number;
  precision: number;
  /** Frases fuera de tema que acabaron en una acción lista para confirmar (debe ser 0). */
  peligrosas: string[];
  fallos: { frase: string; esperado: string; obtenido: string }[];
}

/**
 * Mide un intérprete con frases reales: interpretación + búsqueda de la planta,
 * igual que en el panel (gerente, sin aplicar nada).
 */
export async function medirBanco(repos: Repositorios, interpretes: Interprete[], frases: FraseBanco[]): Promise<ResultadoBanco> {
  const plantas = (await repos.contenido.listar('catalogo')).map((e) => String((e.borrador.datos as { nombre?: { es?: string } }).nombre?.es ?? e.id));
  const fallos: ResultadoBanco['fallos'] = [];
  const peligrosas: string[] = [];
  let aciertos = 0;
  for (const f of frases) {
    const i = await interpretarConRespaldo(interpretes, f.frase, { plantas });
    let obtenido: string = i.tipo;
    let ok = false;
    if (i.tipo === 'accion') {
      const p = await prepararAccion(repos, 'gerente', i.accion);
      obtenido = `${i.accion.tipo} → ${p.estado}${p.estado === 'lista' ? ` ${p.plantaId ?? ''} ${JSON.stringify(p.accion.valor)}` : ''}`;
      if (f.tipo === 'fuera-de-tema') {
        if (p.estado === 'lista') peligrosas.push(f.frase);
        else ok = true; // no se puede aplicar nada: comportamiento seguro
      } else if (i.accion.tipo === f.tipo) {
        if (f.tipo === 'contar_presupuestos') ok = p.estado === 'respuesta';
        else ok = p.estado === 'lista' && p.plantaId === f.planta && (f.valor === undefined || p.accion.valor === f.valor);
      }
    } else ok = i.tipo === f.tipo;
    if (ok) aciertos++;
    else fallos.push({ frase: f.frase, esperado: `${f.tipo} ${f.planta ?? ''} ${f.valor ?? ''}`.trim(), obtenido });
  }
  return { total: frases.length, aciertos, precision: aciertos / frases.length, peligrosas, fallos };
}
