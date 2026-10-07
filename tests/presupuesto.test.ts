import { describe, expect, it, vi } from 'vitest';
import { componerEmail } from '../src/lib/presupuesto/email';
import { esquemaPresupuesto } from '../src/lib/presupuesto/esquema';
import { procesarPresupuesto, type DependenciasPresupuesto } from '../src/lib/presupuesto/procesar';
import { verificarTurnstile } from '../src/lib/presupuesto/turnstile';

const especies = new Map([
  ['phoenix-canariensis', { nombre: 'Palmera canaria', nombreCientifico: 'Phoenix canariensis' }],
  ['olivo-ornamental-copa', { nombre: 'Olivo ornamental de copa', nombreCientifico: 'Olea europaea' }],
]);

const valida = {
  nombre: 'Ana Pérez',
  empresa: 'Paisajismo Ejemplo',
  email: 'Ana@Ejemplo.com',
  telefono: '+34 600 000 000',
  provincia: 'Valencia',
  mensaje: 'Obra en Alicante <urgente>',
  lineas: [{ slug: 'phoenix-canariensis', cantidad: 4 }],
  idioma: 'es',
  consentimiento: true,
  turnstile: 'token',
};

function deps(cambios: Partial<DependenciasPresupuesto> = {}) {
  return {
    especies,
    verificarTurnstile: vi.fn<DependenciasPresupuesto['verificarTurnstile']>(
      cambios.verificarTurnstile ?? (async () => true),
    ),
    enviarEmail: vi.fn<DependenciasPresupuesto['enviarEmail']>(cambios.enviarEmail ?? (async () => {})),
  };
}

describe('procesarPresupuesto', () => {
  it('envía el aviso con el cliente como Reply-To', async () => {
    const d = deps();
    expect(await procesarPresupuesto(valida, d)).toEqual({ ok: true });
    expect(d.verificarTurnstile).toHaveBeenCalledWith('token');
    const mensaje = d.enviarEmail.mock.calls[0]![0];
    expect(mensaje.responderA).toBe('ana@ejemplo.com');
    expect(mensaje.texto).toContain('4 × Palmera canaria (Phoenix canariensis)');
  });

  it('acepta un formulario HTML sin JavaScript (campos de texto)', async () => {
    const d = deps();
    const formulario = {
      nombre: 'Ana',
      email: 'ana@ejemplo.com',
      lineas: '',
      consentimiento: 'on',
      'cf-turnstile-response': 'token',
      sitio_web: '',
    };
    expect(await procesarPresupuesto(formulario, d)).toEqual({ ok: true });
  });

  it('descarta en silencio si el campo trampa viene relleno', async () => {
    const d = deps();
    const r = await procesarPresupuesto({ ...valida, sitio_web: 'http://spam' }, d);
    expect(r).toMatchObject({ ok: false, codigo: 'antispam' });
    expect(d.verificarTurnstile).not.toHaveBeenCalled();
    expect(d.enviarEmail).not.toHaveBeenCalled();
  });

  it('no envía si Turnstile no valida', async () => {
    const d = deps({ verificarTurnstile: async () => false });
    expect(await procesarPresupuesto(valida, d)).toMatchObject({ ok: false, estado: 403, codigo: 'antispam' });
    expect(d.enviarEmail).not.toHaveBeenCalled();
  });

  it('rechaza especies que no están publicadas', async () => {
    const r = await procesarPresupuesto({ ...valida, lineas: [{ slug: 'cactus-inventado', cantidad: 1 }] }, deps());
    expect(r).toMatchObject({ ok: false, codigo: 'especie-desconocida' });
  });

  it('indica los campos inválidos', async () => {
    const { consentimiento, ...sinConsentimiento } = valida;
    const r = await procesarPresupuesto({ ...sinConsentimiento, email: 'no-es-email' }, deps());
    expect(r).toMatchObject({ ok: false, estado: 400, codigo: 'datos-invalidos' });
    expect(r.ok === false && r.campos).toEqual(expect.arrayContaining(['email', 'consentimiento']));
  });

  it('devuelve 502 si falla el envío del email', async () => {
    const d = deps({ enviarEmail: async () => Promise.reject(new Error('E_SENDER_NOT_VERIFIED')) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await procesarPresupuesto(valida, d)).toMatchObject({ ok: false, estado: 502, codigo: 'envio' });
  });
});

describe('esquemaPresupuesto', () => {
  it('limita cantidades y número de líneas', () => {
    expect(esquemaPresupuesto.safeParse({ ...valida, lineas: [{ slug: 'phoenix-canariensis', cantidad: 0 }] }).success).toBe(false);
    const muchas = Array.from({ length: 51 }, () => ({ slug: 'phoenix-canariensis', cantidad: 1 }));
    expect(esquemaPresupuesto.safeParse({ ...valida, lineas: muchas }).success).toBe(false);
  });
});

describe('componerEmail', () => {
  it('escapa el HTML de los datos del cliente', () => {
    const { html } = componerEmail(esquemaPresupuesto.parse(valida), especies);
    expect(html).toContain('Obra en Alicante &lt;urgente&gt;');
    expect(html).not.toContain('<urgente>');
  });
});

describe('verificarTurnstile', () => {
  it('envía el token, el secreto y la IP a siteverify', async () => {
    const hacerFetch = vi.fn(async () => Response.json({ success: true }));
    expect(await verificarTurnstile('tok', 'secreto', '1.2.3.4', hacerFetch as unknown as typeof fetch)).toBe(true);
    const [url, init] = hacerFetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const cuerpo = init.body as FormData;
    expect(cuerpo.get('secret')).toBe('secreto');
    expect(cuerpo.get('response')).toBe('tok');
    expect(cuerpo.get('remoteip')).toBe('1.2.3.4');
  });

  it('falla cerrado ante errores de red o respuestas negativas', async () => {
    const caido = vi.fn(async () => Promise.reject(new Error('red')));
    expect(await verificarTurnstile('t', 's', undefined, caido as unknown as typeof fetch)).toBe(false);
    const negativo = vi.fn(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }));
    expect(await verificarTurnstile('t', 's', undefined, negativo as unknown as typeof fetch)).toBe(false);
  });
});
