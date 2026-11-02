import { describe, expect, it } from 'vitest';
import { respuestaImagenPrivada } from '../../src/server/panel/imagen-privada.ts';

const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe('imágenes privadas del panel', () => {
  it('sirve solo formatos de imagen reconocidos y declara el MIME derivado de los bytes', () => {
    const r = respuestaImagenPrivada(jpg);
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('image/jpeg');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });

  it('no sirve HTML ni SVG aunque se hayan almacenado como adjuntos', () => {
    for (const contenido of ['<script>alert(1)</script>', '<svg onload="alert(1)"/>']) {
      expect(respuestaImagenPrivada(new TextEncoder().encode(contenido)).status).toBe(404);
    }
  });

  it('permite caché privada únicamente para las fotos de ruta inmutable', () => {
    expect(respuestaImagenPrivada(jpg, 'foto').headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
    expect(respuestaImagenPrivada(jpg, 'portafolio').headers.get('Cache-Control')).toBe('private, max-age=3600');
  });
});
