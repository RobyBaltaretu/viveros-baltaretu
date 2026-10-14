import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { rutas } from '../../i18n/ui';
import { obtenerEspecies } from '../../lib/catalogo';
import { procesarPresupuesto } from '../../lib/presupuesto/procesar';
import { TURNSTILE_PRUEBA, verificarTurnstile } from '../../lib/presupuesto/turnstile';
import { repositorios } from '../../server/data/index.ts';
import { presupuestoDesde } from '../../server/panel/presupuestos.ts';

// Única ruta del sitio, junto al panel, que se ejecuta en el Worker.
export const prerender = false;

/** Lo que usamos del binding `send_email` (Cloudflare Email Service). */
interface EnvioEmail {
  send(mensaje: {
    from: string | { email: string; name?: string };
    to: string;
    replyTo?: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<unknown>;
}

interface EntornoPresupuesto {
  EMAIL?: EnvioEmail;
  EMAIL_DESTINO?: string;
  EMAIL_REMITENTE?: string;
  TURNSTILE_SECRET_KEY?: string;
  /** Base del panel: si existe, cada petición se guarda también para la bandeja. */
  DB?: unknown;
}

const json = (cuerpo: unknown, estado: number) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, url, redirect }) => {
  // Solo peticiones desde la propia web.
  const origen = request.headers.get('Origin');
  if (origen && origen !== url.origin) return json({ ok: false, codigo: 'origen' }, 403);

  const tipo = request.headers.get('Content-Type') ?? '';
  const esJson = tipo.includes('application/json');
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = esJson
      ? ((await request.json()) as Record<string, unknown>)
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return json({ ok: false, codigo: 'datos-invalidos' }, 400);
  }

  const entorno = env as unknown as EntornoPresupuesto;
  const secreto = entorno.TURNSTILE_SECRET_KEY || (import.meta.env.DEV ? TURNSTILE_PRUEBA.claveSecreta : undefined);
  const { EMAIL_DESTINO: destino, EMAIL_REMITENTE: remitente, EMAIL: binding } = entorno;
  if (!secreto || !destino || !remitente || !binding) {
    console.error('Faltan TURNSTILE_SECRET_KEY, EMAIL_DESTINO, EMAIL_REMITENTE o el binding EMAIL');
    return json({ ok: false, codigo: 'configuracion' }, 500);
  }

  const especies = new Map(
    (await obtenerEspecies('es')).map(({ data }) => [
      data.slug,
      { nombre: data.nombre.es, nombreCientifico: data.nombreCientifico },
    ]),
  );

  const resultado = await procesarPresupuesto(cuerpo, {
    especies,
    guardar: entorno.DB
      ? async (solicitud) => {
          const repos = await repositorios(entorno);
          await repos?.presupuestos.guardar(presupuestoDesde(solicitud, especies));
        }
      : undefined,
    verificarTurnstile: (token) =>
      verificarTurnstile(token, secreto, request.headers.get('CF-Connecting-IP') ?? undefined),
    enviarEmail: async ({ asunto, texto, html, responderA }) => {
      await binding.send({
        from: { email: remitente, name: 'Web del vivero' },
        to: destino,
        replyTo: responderA,
        subject: asunto,
        text: texto,
        html,
      });
    },
  });

  if (esJson) return json(resultado.ok ? { ok: true } : resultado, resultado.ok ? 200 : resultado.estado);
  // Formulario sin JavaScript: se redirige a la página de confirmación o de vuelta al formulario.
  const idioma = cuerpo.idioma === 'en' ? 'en' : 'es';
  return redirect(resultado.ok ? rutas.presupuestoEnviado[idioma] : `${rutas.presupuesto[idioma]}?error=1`, 303);
};
