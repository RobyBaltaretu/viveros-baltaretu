import { describe, expect, it } from 'vitest';
import { rellenarConPrueba } from '../src/lib/pruebas/rellenar';

describe('rellenarConPrueba', () => {
  it('solo rellena huecos pendientes y nunca pisa un dato real', () => {
    const real = { nombre: 'Viveros Baltaretu', telefono: '[PLACEHOLDER: teléfono]', whatsapp: '', email: 'real@vivero.es' };
    const prueba = { nombre: 'Otro', telefono: '+34 960 000 000', whatsapp: '34600000000', email: 'pedidos@example.com' };
    expect(rellenarConPrueba(real, prueba)).toEqual({
      nombre: 'Viveros Baltaretu',
      telefono: '+34 960 000 000',
      whatsapp: '34600000000',
      email: 'real@vivero.es',
    });
  });

  it('recorre objetos y listas por posición, y deja lo que no tiene prueba', () => {
    const real = { secciones: [{ texto: { es: '[PLACEHOLDER: a]', en: 'real' } }, { texto: { es: '[PLACEHOLDER: b]', en: '[PLACEHOLDER: b]' } }] };
    const prueba = { secciones: [{ texto: { es: 'prueba a', en: 'prueba' } }] };
    expect(rellenarConPrueba(real, prueba)).toEqual({
      secciones: [{ texto: { es: 'prueba a', en: 'real' } }, { texto: { es: '[PLACEHOLDER: b]', en: '[PLACEHOLDER: b]' } }],
    });
  });
});
