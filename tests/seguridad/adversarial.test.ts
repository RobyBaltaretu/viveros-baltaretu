import { describe, expect, it } from 'vitest';
import { mismoOrigen, panelActivado } from '../../src/server/panel/acceso.ts';
import { puede } from '../../src/server/panel/permisos.ts';
import { respuestaImagenPrivada } from '../../src/server/panel/imagen-privada.ts';

/** Pruebas adversariales NO destructivas para regresiones de seguridad. */
describe('red team: peticiones CSRF y acceso', () => {
  const post = (headers: Record<string, string>) => new Request('https://panel.example.test/api/panel/simulador', { method: 'POST', headers });
  it('rechaza origen externo, null, ausencia de contexto y cross-site', () => {
    for (const headers of [
      { Origin: 'https://evil.example.test' },
      { Origin: 'null' },
      {},
      { 'Sec-Fetch-Site': 'cross-site' },
      { 'Sec-Fetch-Site': 'same-site' },
    ]) expect(mismoOrigen(post(headers))).toBe(false);
  });
  it('permite origen exacto o same-origin, pero no un subdominio', () => {
    expect(mismoOrigen(post({ Origin: 'https://panel.example.test' }))).toBe(true);
    expect(mismoOrigen(post({ 'Sec-Fetch-Site': 'same-origin' }))).toBe(true);
    expect(mismoOrigen(post({ Origin: 'https://sub.panel.example.test' }))).toBe(false);
  });
  it('el panel no se activa sin DB y configuración válida', () => {
    expect(panelActivado({ DB: {} })).toBe(false);
    expect(panelActivado({ ACCESS_EQUIPO: 'equipo', ACCESS_AUD: 'aud' })).toBe(false);
  });
  it('un editor no puede consultar finanzas ni gestión de personas', () => {
    for (const accion of ['facturas', 'gastos', 'informes', 'presupuestos', 'personas', 'publicar'] as const) {
      expect(puede('editor', accion)).toBe(false);
    }
  });
});

describe('red team: entrega de adjuntos', () => {
  const bytes = (texto: string) => new TextEncoder().encode(texto);
  it('rechaza archivos HTML, SVG y scripts como imagen', () => {
    for (const contenido of [
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
      '<html><script>alert(1)</script></html>',
      '#!/usr/bin/env node\nconsole.log("script")',
    ]) expect(respuestaImagenPrivada(bytes(contenido)).status).toBe(404);
  });
  it('evita interpretar otro tipo de contenido y no guarda caché de tickets', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const respuesta = respuestaImagenPrivada(jpeg);
    expect(respuesta.headers.get('Content-Type')).toBe('image/jpeg');
    expect(respuesta.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(respuesta.headers.get('Cache-Control')).toBe('no-store');
  });
});
