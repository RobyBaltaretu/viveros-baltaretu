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
    verificarTurnstile: vi.fn<NonNullable<DependenciasPresupuesto['verificarTurnstile']>>(
      cambios.verificarTurnstile ?? (async () => true),
    ),
    enviarEmail: vi.fn<NonNullable<DependenciasPresupuesto['enviarEmail']>>(cambios.enviarEmail ?? (async () => {})),
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

  it('sin correo ni Turnstile configurados, la petición se guarda en el panel y vale', async () => {
    const guardar = vi.fn(async () => {});
    const { turnstile: _t, ...sinToken } = valida as Record<string, unknown>;
    expect(await procesarPresupuesto(sinToken, { especies, guardar })).toEqual({ ok: true });
    expect(guardar).toHaveBeenCalledOnce();
    expect(await procesarPresupuesto(sinToken, { especies })).toMatchObject({ ok: false, codigo: 'configuracion' });
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

  it('indica si el pedido es al por mayor (por defecto) o por unidad', () => {
    expect(componerEmail(esquemaPresupuesto.parse(valida), especies).texto).toContain('Tipo de pedido: Al por mayor');
    const unidad = componerEmail(esquemaPresupuesto.parse({ ...valida, tipoPedido: 'unidad' }), especies);
    expect(unidad.texto).toContain('Tipo de pedido: Por unidad, con envío');
    expect(esquemaPresupuesto.safeParse({ ...valida, tipoPedido: 'tienda' }).success).toBe(false);
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

describe('guardar presupuestos para la bandeja del panel', () => {
  const fallo = async () => {
    throw new Error('fallo');
  };

  it('guarda la petición válida y además envía el email', async () => {
    const guardar = vi.fn(async () => {});
    const d = { ...deps(), guardar };
    expect(await procesarPresupuesto(valida, d)).toEqual({ ok: true });
    expect(guardar).toHaveBeenCalledOnce();
    expect(d.enviarEmail).toHaveBeenCalledOnce();
  });

  it('no guarda nada si salta el campo trampa o falla Turnstile', async () => {
    const guardar = vi.fn(async () => {});
    await procesarPresupuesto({ ...valida, sitio_web: 'spam' }, { ...deps(), guardar });
    await procesarPresupuesto(valida, { ...deps({ verificarTurnstile: async () => false }), guardar });
    expect(guardar).not.toHaveBeenCalled();
  });

  it('si falla el email pero se guardó, la petición no se pierde', async () => {
    expect(await procesarPresupuesto(valida, { ...deps({ enviarEmail: fallo }), guardar: async () => {} })).toEqual({ ok: true });
    expect(await procesarPresupuesto(valida, { ...deps({ enviarEmail: fallo }), guardar: fallo })).toMatchObject({ ok: false, codigo: 'envio' });
  });

  it('si falla el guardado, el email sigue saliendo', async () => {
    const d = { ...deps(), guardar: fallo };
    expect(await procesarPresupuesto(valida, d)).toEqual({ ok: true });
    expect(d.enviarEmail).toHaveBeenCalledOnce();
  });

  it('convierte la petición en un presupuesto de la bandeja', async () => {
    const { presupuestoDesde } = await import('../src/server/panel/presupuestos.ts');
    const p = presupuestoDesde(esquemaPresupuesto.parse(valida), especies, new Date('2026-10-14T10:00:00Z'), 'p1');
    expect(p).toMatchObject({ id: 'p1', estado: 'nuevo', email: 'ana@ejemplo.com', provincia: 'Valencia', tipoPedido: 'mayor' });
    expect(p.lineas).toEqual([{ especie: 'phoenix-canariensis', nombre: 'Palmera canaria', cantidad: 4 }]);
  });
});
