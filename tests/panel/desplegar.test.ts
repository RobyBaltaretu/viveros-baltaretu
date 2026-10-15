import { describe, expect, it } from 'vitest';
import { modoDespliegue } from '../../scripts/contenido/desplegar-comun.ts';

describe('despliegue automático', () => {
  it('publica en la web solo si el build lleva cambios del panel o el propietario lo pide', () => {
    expect(modoDespliegue(2, undefined)).toBe('desplegar');
    expect(modoDespliegue(0, undefined)).toBe('subir-version');
    expect(modoDespliegue(0, '1')).toBe('desplegar');
    expect(modoDespliegue(0, '0')).toBe('subir-version');
  });
});
