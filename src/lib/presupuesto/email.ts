import type { SolicitudPresupuesto } from './esquema';

export interface EspecieEmail {
  nombre: string;
  nombreCientifico: string;
}

export interface MensajeEmail {
  asunto: string;
  texto: string;
  html: string;
}

const escapar = (valor: string) =>
  valor.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Email interno para la empresa (siempre en español), con el cliente como Reply-To. */
export function componerEmail(
  solicitud: SolicitudPresupuesto,
  especies: ReadonlyMap<string, EspecieEmail>,
): MensajeEmail {
  const lineas = solicitud.lineas.map(({ slug, cantidad }) => {
    const especie = especies.get(slug);
    const nombre = especie ? `${especie.nombre} (${especie.nombreCientifico})` : slug;
    return { cantidad, nombre };
  });

  const datos: [string, string | undefined][] = [
    ['Nombre', solicitud.nombre],
    ['Empresa', solicitud.empresa],
    ['Email', solicitud.email],
    ['Teléfono', solicitud.telefono],
    ['Provincia', solicitud.provincia],
    ['Idioma de la web', solicitud.idioma === 'es' ? 'Español' : 'Inglés'],
  ];
  const datosPresentes = datos.filter((d): d is [string, string] => Boolean(d[1]));
  const quien = solicitud.empresa ? `${solicitud.nombre} (${solicitud.empresa})` : solicitud.nombre;
  const asunto = `Petición de presupuesto: ${quien}`.slice(0, 200);

  const texto = [
    'Nueva petición de presupuesto desde la web.',
    '',
    ...datosPresentes.map(([k, v]) => `${k}: ${v}`),
    '',
    'Especies:',
    ...(lineas.length ? lineas.map((l) => `- ${l.cantidad} × ${l.nombre}`) : ['- (ninguna seleccionada)']),
    '',
    'Mensaje:',
    solicitud.mensaje ?? '(sin mensaje)',
    '',
    'Responde a este email para contestar directamente al cliente.',
  ].join('\n');

  const html = `<!doctype html><html lang="es"><body style="font-family:sans-serif">
<h1 style="font-size:18px">Nueva petición de presupuesto desde la web</h1>
<table>${datosPresentes.map(([k, v]) => `<tr><th align="left">${escapar(k)}</th><td>${escapar(v)}</td></tr>`).join('')}</table>
<h2 style="font-size:16px">Especies</h2>
${
  lineas.length
    ? `<ul>${lineas.map((l) => `<li>${l.cantidad} × ${escapar(l.nombre)}</li>`).join('')}</ul>`
    : '<p>(ninguna seleccionada)</p>'
}
<h2 style="font-size:16px">Mensaje</h2>
<p style="white-space:pre-wrap">${escapar(solicitud.mensaje ?? '(sin mensaje)')}</p>
<p><small>Responde a este email para contestar directamente al cliente.</small></p>
</body></html>`;

  return { asunto, texto, html };
}
