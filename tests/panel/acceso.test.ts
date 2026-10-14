import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { emailDeAccess, mismoOrigen, panelActivado } from '../../src/server/panel/acceso.ts';
import { puede } from '../../src/server/panel/permisos.ts';

const EQUIPO = 'vivero';
const EMISOR = `https://${EQUIPO}.cloudflareaccess.com`;
const AUD = 'aud-del-panel';
const env = { ACCESS_EQUIPO: EQUIPO, ACCESS_AUD: AUD, DB: {} };
let firmar: (claims: Record<string, unknown>, opciones?: { aud?: string; iss?: string; exp?: string }) => Promise<string>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  vi.stubGlobal('fetch', async (url: string | URL) => {
    expect(String(url)).toBe(`${EMISOR}/cdn-cgi/access/certs`);
    return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'Content-Type': 'application/json' } });
  });
  firmar = (claims, o = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(o.iss ?? EMISOR)
      .setAudience(o.aud ?? AUD)
      .setIssuedAt()
      .setExpirationTime(o.exp ?? '1h')
      .sign(privateKey);
});
afterAll(() => vi.unstubAllGlobals());

const peticion = (token?: string, host = 'viveros.example.com') =>
  new Request(`https://${host}/panel`, token ? { headers: { 'Cf-Access-Jwt-Assertion': token } } : {});

describe('acceso con Cloudflare Access', () => {
  it('acepta un token válido y devuelve el email', async () => {
    expect(await emailDeAccess(peticion(await firmar({ email: 'Gerente@Example.com' })), env)).toBe('gerente@example.com');
  });
  it('rechaza sin token, con otra audiencia, otro emisor o caducado', async () => {
    expect(await emailDeAccess(peticion(), env)).toBeNull();
    expect(await emailDeAccess(peticion(await firmar({ email: 'a@example.com' }, { aud: 'otra' })), env)).toBeNull();
    expect(await emailDeAccess(peticion(await firmar({ email: 'a@example.com' }, { iss: 'https://otro.cloudflareaccess.com' })), env)).toBeNull();
    expect(await emailDeAccess(peticion(await firmar({ email: 'a@example.com' }, { exp: '-1m' })), env)).toBeNull();
    expect(await emailDeAccess(peticion('basura'), env)).toBeNull();
  });
  it('el modo de prueba solo vale en localhost', async () => {
    const prueba = { ...env, PANEL_PRUEBA_EMAIL: 'p@example.com' };
    expect(await emailDeAccess(peticion(undefined, 'localhost:4321'), prueba)).toBe('p@example.com');
    expect(await emailDeAccess(peticion(), prueba)).toBeNull();
  });
  it('sin base o sin Access configurado, el panel no está activado', () => {
    expect(panelActivado({})).toBe(false);
    expect(panelActivado({ DB: {} })).toBe(false);
    expect(panelActivado({ ACCESS_EQUIPO: 'x', ACCESS_AUD: 'y' })).toBe(false);
    expect(panelActivado(env)).toBe(true);
  });
});

describe('protección y permisos', () => {
  it('bloquea envíos desde otro origen', () => {
    const post = (h: Record<string, string>) => new Request('https://v.example.com/api/panel/x', { method: 'POST', headers: h });
    expect(mismoOrigen(post({ Origin: 'https://v.example.com' }))).toBe(true);
    expect(mismoOrigen(post({ Origin: 'https://malo.example.com' }))).toBe(false);
    expect(mismoOrigen(post({}))).toBe(false);
    expect(mismoOrigen(new Request('https://v.example.com/panel'))).toBe(true);
  });
  it('cada rol solo hace lo suyo', () => {
    expect(puede('propietario', 'personas')).toBe(true);
    expect(puede('gerente', 'personas')).toBe(false);
    expect(puede('gerente', 'publicar')).toBe(true);
    expect(puede('editor', 'publicar')).toBe(false);
    expect(puede('editor', 'presupuestos')).toBe(false);
  });
});
