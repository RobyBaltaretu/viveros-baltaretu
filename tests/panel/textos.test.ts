import { describe, expect, it } from 'vitest';
import { aplicarFormulario, plantilla, validarTextos } from '../../src/server/panel/textos.ts';

const form = (pares: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of pares) f.append(k, v);
  return f;
};

describe('textos de la web en el panel', () => {
  const base = { titular: { es: 'Hola', en: 'Hi' }, pasos: [{ titulo: { es: 'a', en: 'a' }, texto: { es: 'b', en: 'b' } }], pendienteRevision: true };

  it('aplica textos, casillas y no deja tocar campos que no existen', () => {
    const d = aplicarFormulario(form([['d:titular.es', ' Nuevo '], ['casilla', 'pendienteRevision'], ['d:inventado', 'x'], ['d:__proto__.x', 'y']]), base);
    expect(d.titular).toEqual({ es: 'Nuevo', en: 'Hi' });
    expect(d.pendienteRevision).toBe(false);
    expect(d).not.toHaveProperty('inventado');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('añade y quita elementos de una lista', () => {
    const mas = aplicarFormulario(form([['accion', 'agregar:pasos']]), base);
    expect(mas.pasos).toEqual([base.pasos[0], { titulo: { es: '', en: '' }, texto: { es: '', en: '' } }]);
    expect(aplicarFormulario(form([['accion', 'quitar:pasos.0']]), base).pasos).toEqual([]);
  });

  it('explica en español lo que falta', () => {
    const errores = validarTextos('ajustes', 'condiciones', { pedidoMinimo: { es: '', en: 'x' }, plazosMayor: { es: 'a', en: 'b' }, envioUnidad: { es: 'a', en: 'b' } });
    expect(errores[0].mensaje).toBe('Falta: Pedido mínimo (en español).');
  });

  it('una guía nueva vacía no pasa la validación', () => {
    expect(validarTextos('guias', 'nueva', { ...plantilla('guias'), slug: 'nueva' }).length).toBeGreaterThan(0);
  });
});
