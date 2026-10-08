import { describe, expect, it } from 'vitest';
import { CLAVE_CONSENTIMIENTO, debeCargarAnalitica, guardarConsentimiento, leerConsentimiento } from '../src/lib/cookies/consentimiento';

const memoria = () => {
  const datos = new Map<string, string>();
  return { getItem: (c: string) => datos.get(c) ?? null, setItem: (c: string, v: string) => void datos.set(c, v) };
};

describe('consentimiento de cookies', () => {
  it('sin elección guardada no hay consentimiento, y se recuerda lo elegido', () => {
    const almacen = memoria();
    expect(leerConsentimiento(almacen)).toBeNull();
    guardarConsentimiento(almacen, 'rechazado');
    expect(leerConsentimiento(almacen)).toBe('rechazado');
    expect(almacen.getItem(CLAVE_CONSENTIMIENTO)).toBe('rechazado');
  });

  it('tolera un almacenamiento que falla o con valores desconocidos', () => {
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    expect(leerConsentimiento(roto)).toBeNull();
    expect(() => guardarConsentimiento(roto, 'aceptado')).not.toThrow();
    expect(leerConsentimiento({ getItem: () => 'quizá', setItem: () => {} })).toBeNull();
  });

  it('GA4 solo se carga si se acepta y el ID es real', () => {
    expect(debeCargarAnalitica('aceptado', 'G-ABC123')).toBe(true);
    expect(debeCargarAnalitica('rechazado', 'G-ABC123')).toBe(false);
    expect(debeCargarAnalitica(null, 'G-ABC123')).toBe(false);
    expect(debeCargarAnalitica('aceptado', 'G-PRUEBA0000')).toBe(false);
    expect(debeCargarAnalitica('aceptado', '')).toBe(false);
  });
});
