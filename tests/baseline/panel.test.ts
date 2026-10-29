/**
 * Red de seguridad del panel de Viveros Baltaretu: lo que ve y puede hacer cada
 * rol (zonas, pestañas, barra del móvil y permisos) y las herramientas e
 * instrucciones del asistente. Si una instantánea cambia, el PR debe explicar
 * por qué y que lo ha pedido el propietario.
 */
import { createHash } from 'node:crypto';
import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import type { Rol } from '../../src/server/data/tipos.ts';
import { HERRAMIENTAS, herramientasDe, type Contexto } from '../../src/server/asistente/herramientas.ts';
import { instruccionesDe } from '../../src/server/asistente/instrucciones.ts';
import { barraDe, zonasDe } from '../../src/server/panel/navegacion.ts';
import { ACCIONES, puede } from '../../src/server/panel/permisos.ts';

const ROLES: Rol[] = ['propietario', 'gerente', 'editor'];
const huella = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 16);
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

describe('red de seguridad: panel', () => {
  it('navegación y permisos por rol', async () => {
    const porRol = Object.fromEntries(
      ROLES.map((rol) => [
        rol,
        {
          permisos: ACCIONES.filter((a) => puede(rol, a)),
          zonas: zonasDe(rol).map((z) => ({
            zona: z.zona,
            texto: z.texto,
            href: z.href,
            secciones: z.secciones.map((s) => `${s.texto} ${s.href}`),
          })),
          barraMovil: barraDe(rol).map((z) => z.href),
        },
      ]),
    );
    await expect(json(porRol)).toMatchFileSnapshot('./panel-navegacion.json');
  });

  it('herramientas e instrucciones del asistente por rol', async () => {
    const herramientas = HERRAMIENTAS.map((h) => ({
      nombre: h.nombre,
      tipo: h.tipo,
      permiso: h.permiso,
      descripcion: huella(h.descripcion),
      argumentos: huella(JSON.stringify(z.toJSONSchema(h.esquema))),
    }));
    const ctx = (rol: Rol) =>
      ({
        usuario: { email: `${rol}@example.com`, nombre: '', rol, activo: true },
        hoy: '2026-01-15',
      }) as unknown as Contexto;
    const porRol = Object.fromEntries(
      ROLES.map((rol) => [
        rol,
        {
          herramientas: herramientasDe(rol).map((h) => h.nombre),
          instrucciones: huella(instruccionesDe(ctx(rol))),
        },
      ]),
    );
    await expect(json({ herramientas, porRol })).toMatchFileSnapshot('./asistente-herramientas.json');
  });
});
