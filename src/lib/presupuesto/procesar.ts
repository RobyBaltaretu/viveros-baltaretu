import { componerEmail, type EspecieEmail, type MensajeEmail } from './email';
import { CAMPO_TRAMPA, esquemaPresupuesto, normalizarEntrada } from './esquema';

export type ResultadoPresupuesto =
  | { ok: true }
  | { ok: false; estado: 400 | 403 | 500 | 502; codigo: CodigoError; campos?: string[] };

export type CodigoError = 'datos-invalidos' | 'antispam' | 'especie-desconocida' | 'configuracion' | 'envio';

export interface DependenciasPresupuesto {
  especies: ReadonlyMap<string, EspecieEmail>;
  verificarTurnstile: (token: string) => Promise<boolean>;
  enviarEmail: (mensaje: MensajeEmail & { responderA: string }) => Promise<void>;
}

/** Valida, comprueba el anti-spam y envía el aviso. Sin dependencias de Cloudflare: se prueba con Vitest. */
export async function procesarPresupuesto(
  cuerpo: Record<string, unknown>,
  deps: DependenciasPresupuesto,
): Promise<ResultadoPresupuesto> {
  const entrada = normalizarEntrada(cuerpo);

  // Campo trampa relleno: se responde como si fuera un error de validación, sin enviar nada.
  if (typeof entrada[CAMPO_TRAMPA] === 'string' && entrada[CAMPO_TRAMPA] !== '') {
    return { ok: false, estado: 400, codigo: 'antispam' };
  }

  const resultado = esquemaPresupuesto.safeParse(entrada);
  if (!resultado.success) {
    const campos = [...new Set(resultado.error.issues.map((i) => String(i.path[0] ?? '')))].filter(Boolean);
    return { ok: false, estado: 400, codigo: 'datos-invalidos', campos };
  }
  const solicitud = resultado.data;

  if (solicitud.lineas.some((l) => !deps.especies.has(l.slug))) {
    return { ok: false, estado: 400, codigo: 'especie-desconocida' };
  }

  if (!(await deps.verificarTurnstile(solicitud.turnstile))) {
    return { ok: false, estado: 403, codigo: 'antispam' };
  }

  try {
    await deps.enviarEmail({ ...componerEmail(solicitud, deps.especies), responderA: solicitud.email });
  } catch (error) {
    console.error('Error al enviar el aviso de presupuesto', error);
    return { ok: false, estado: 502, codigo: 'envio' };
  }
  return { ok: true };
}
