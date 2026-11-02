import { tipoDeImagen } from './fotos.ts';

/**
 * Nunca se utiliza el MIME guardado en D1 como cabecera HTTP: puede estar
 * desactualizado o manipulado. Solo servimos formatos raster reconocidos
 * por su firma, nunca HTML, SVG ni otro contenido activo.
 */
export function respuestaImagenPrivada(bytes: Uint8Array, cache: 'ticket' | 'foto' = 'ticket'): Response {
  const tipo = tipoDeImagen(bytes);
  if (!tipo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(bytes) as Uint8Array<ArrayBuffer>, {
    headers: {
      'Content-Type': tipo.tipo,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cache === 'foto' ? 'private, max-age=31536000, immutable' : 'no-store',
    },
  });
}
