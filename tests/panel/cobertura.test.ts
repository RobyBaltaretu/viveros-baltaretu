import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PANTALLAS_PLANTA } from '../../src/server/panel/plantas.ts';
import { OCULTOS, SECCIONES, LISTAS } from '../../src/server/panel/textos.ts';

/**
 * Condición para retirar Keystatic (tarea 5.3): todo lo que se edita en
 * keystatic.config.ts se puede editar en el panel propio. Lista de campos de
 * Keystatic tomada de la configuración (se comprueba abajo mientras exista).
 */
const KEYSTATIC = {
  colecciones: {
    catalogo: 'slug,familia,nombre,nombreCientifico,descripcion,alturaMin,alturaMax,perimetroTroncoCm,formatos,disponibilidad,precioDesde,precioUnidad,unidadPrecio,origen,destacada,ventaUnitaria,silueta,fotos,seo,datosDeEjemplo,revisado,contenido',
    proyectos: 'slug,titulo,resumen,ubicacion,especies,fotos,secciones,seoDescripcion,datosDeEjemplo,revisado',
    guias: 'slug,titulo,resumen,secciones,seoDescripcion,datosDeEjemplo,revisado',
  },
  singletons: {
    'ajustes/empresa': 'nombre,telefono,whatsapp,email,direccion',
    'ajustes/condiciones': 'pedidoMinimo,plazosMayor,envioUnidad',
    'ajustes/catalogo': 'catalogo,palmeras,olivos,higueras,otras-ornamentales',
    'ajustes/portada': 'titular,titularDestacado,entradilla,familiasTitulo,familiasTexto,comprarTitulo,mayorTitulo,mayorTexto,unidadTitulo,unidadTexto,pasosTitulo,pasos,confianzaTitulo,confianza,mision,vision,llamadaTitulo,llamadaTexto',
    'paginas/nosotros': 'titulo,entradilla,secciones,seoDescripcion,pendienteRevision',
    'paginas/reparto': 'titulo,entradilla,secciones,seoDescripcion,pendienteRevision',
    'paginas/aviso-legal': 'titulo,entradilla,secciones,seoDescripcion,pendienteRevision',
    'paginas/privacidad': 'titulo,entradilla,secciones,seoDescripcion,pendienteRevision',
    'paginas/cookies': 'titulo,entradilla,secciones,seoDescripcion,pendienteRevision',
  },
};

/** Campos que el panel rellena solo o que no tienen nada que editar. */
const AUTOMATICOS: Record<string, string> = {
  slug: 'se crea a partir del nombre o del título',
  seo: 'se genera al guardar (decisión 14)',
  unidadPrecio: 'solo admite «unidad»',
  contenido: 'las fichas no tienen cuerpo de texto',
};

const lista = (t: string) => t.split(',');

describe('cobertura del panel frente a Keystatic', () => {
  it('cada campo de una planta tiene pantalla, fotos o se rellena solo', () => {
    const editables = new Set(
      Object.values(PANTALLAS_PLANTA)
        .flatMap((t) => lista(t))
        .map((c) => c.split('.')[0])
        .map((c) => (c === 'perimetro' ? 'perimetroTroncoCm' : c)),
    );
    editables.add('fotos'); // pantalla «Fotos» de cada planta
    const sinCubrir = lista(KEYSTATIC.colecciones.catalogo).filter((c) => !editables.has(c) && !(c in AUTOMATICOS));
    expect(sinCubrir).toEqual([]);
  });

  it('proyectos, guías y textos fijos: el editor muestra todos los campos salvo los que tienen pantalla propia', () => {
    expect([...OCULTOS].sort()).toEqual(['fotos', 'slug']);
    expect(Object.keys(LISTAS).sort()).toEqual(['guias', 'proyectos']);
    // Las fotos solo existen en los proyectos y tienen su pantalla (/panel/textos/proyectos/<id>/fotos).
    expect(lista(KEYSTATIC.colecciones.guias)).not.toContain('fotos');
    const secciones = new Set(SECCIONES.map((s) => `${s.coleccion}/${s.id}`));
    expect(Object.keys(KEYSTATIC.singletons).filter((k) => !secciones.has(k))).toEqual([]);
    // La portada se edita por partes: entre todas cubren todos sus campos.
    const portada = SECCIONES.find((s) => s.id === 'portada')!;
    const enPartes = new Set(portada.partes!.flatMap((p) => p.campos));
    expect(lista(KEYSTATIC.singletons['ajustes/portada']).filter((c) => !enPartes.has(c))).toEqual([]);
  });

  it('la lista coincide con keystatic.config.ts mientras exista', async () => {
    let config: { collections?: Record<string, { schema: object }>; singletons?: Record<string, { path: string; schema: object }> } | null = null;
    // Keystatic ya retirado: queda la lista de arriba como referencia.
    if (!existsSync('keystatic.config.ts')) return;
    // Ruta en variable: cuando se retire Keystatic, el archivo ya no existirá.
    const ruta = '../../keystatic.config';
    config = ((await import(/* @vite-ignore */ ruta)) as { default: unknown }).default as typeof config;
    for (const [c, campos] of Object.entries(KEYSTATIC.colecciones)) expect(Object.keys(config!.collections![c].schema).join(',')).toBe(campos);
    const porRuta = Object.fromEntries(Object.values(config!.singletons!).map((s) => [s.path.replace('src/content/', ''), Object.keys(s.schema).join(',')]));
    expect(porRuta).toEqual(KEYSTATIC.singletons);
  });
});
