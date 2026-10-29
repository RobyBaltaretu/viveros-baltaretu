import { createRemoteJWKSet, jwtVerify } from 'jose';
import { repositorios } from '../data/index.ts';
import type { Repositorios, Usuario } from '../data/tipos.ts';

/** Variables del Worker que usa el acceso al panel (ver docs/panel-propio/pasos-manuales.md). */
export interface EntornoPanel {
  DB?: unknown;
  /** Nombre del equipo de Cloudflare Zero Trust (lo que va antes de .cloudflareaccess.com). */
  ACCESS_EQUIPO?: string;
  /** Application Audience (AUD) Tag de la aplicación de Access del panel. */
  ACCESS_AUD?: string;
  /** Email del propietario: entra como propietario la primera vez aunque no esté en la base. */
  PROPIETARIO_EMAIL?: string;
  /** Solo en el entorno `desarrollo` y en localhost: entra sin Access con este email. */
  PANEL_PRUEBA_EMAIL?: string;
}

export type SesionPanel =
  | { estado: 'sin-activar' }
  | { estado: 'sin-acceso'; email: string | null }
  | { estado: 'ok'; usuario: Usuario; repos: Repositorios };

const LOCALES = new Set(['localhost', '127.0.0.1', '[::1]']);

// Claves públicas de Access: se guardan por instancia del Worker (jose las renueva si cambia el `kid`).
const claves = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Email verificado por Cloudflare Access, o `null`. */
export async function emailDeAccess(request: Request, env: EntornoPanel): Promise<string | null> {
  const url = new URL(request.url);
  if (env.PANEL_PRUEBA_EMAIL && LOCALES.has(url.hostname)) return env.PANEL_PRUEBA_EMAIL.toLowerCase();
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_EQUIPO || !env.ACCESS_AUD) return null;
  const emisor = `https://${env.ACCESS_EQUIPO}.cloudflareaccess.com`;
  let jwks = claves.get(emisor);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${emisor}/cdn-cgi/access/certs`));
    claves.set(emisor, jwks);
  }
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: emisor, audience: env.ACCESS_AUD, algorithms: ['RS256'] });
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** El panel solo existe si hay base de datos y (fuera de pruebas locales) Access configurado. */
export const panelActivado = (env: EntornoPanel) => Boolean(env.DB && ((env.ACCESS_EQUIPO && env.ACCESS_AUD) || env.PANEL_PRUEBA_EMAIL));

/**
 * Quién es la persona que entra. Hoy solo existe Cloudflare Access; otro
 * proveedor (acceso propio, más adelante) solo tendría que cumplir esta interfaz.
 */
export interface ProveedorDeAcceso {
  email(request: Request, env: EntornoPanel): Promise<string | null>;
}
export const accesoCloudflare: ProveedorDeAcceso = { email: emailDeAccess };

export async function sesionPanel(request: Request, env: EntornoPanel, acceso: ProveedorDeAcceso = accesoCloudflare): Promise<SesionPanel> {
  if (!panelActivado(env)) return { estado: 'sin-activar' };
  const email = await acceso.email(request, env);
  if (!email) return { estado: 'sin-acceso', email: null };
  const repos = await repositorios(env);
  if (!repos) return { estado: 'sin-activar' };
  let usuario = await repos.usuarios.obtener(email);
  if (!usuario && env.PROPIETARIO_EMAIL && email === env.PROPIETARIO_EMAIL.toLowerCase()) {
    usuario = { email, nombre: '', rol: 'propietario', activo: true };
    await repos.usuarios.guardar(usuario);
    await repos.auditoria.registrar(email, 'alta del propietario');
  }
  if (!usuario || !usuario.activo) {
    await repos.auditoria.registrar(email, 'acceso denegado', new URL(request.url).pathname);
    return { estado: 'sin-acceso', email };
  }
  return { estado: 'ok', usuario, repos };
}

/** Protección CSRF: las peticiones que cambian algo deben venir del propio panel. */
export function mismoOrigen(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origen = request.headers.get('Origin');
  if (origen) return origen === new URL(request.url).origin;
  return request.headers.get('Sec-Fetch-Site') === 'same-origin';
}
