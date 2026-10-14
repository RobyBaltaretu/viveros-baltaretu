import { describe, expect, it } from 'vitest';
import { altPropuesto, rutaDeImagen, tipoDeImagen } from '../../src/server/panel/fotos.ts';

describe('fotos del panel', () => {
  it('reconoce el tipo por el contenido, no por el nombre', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(20).fill(0)]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Array(20).fill(0)]);
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 xxxxxxxx');
    expect(tipoDeImagen(jpeg)?.ext).toBe('jpg');
    expect(tipoDeImagen(png)?.ext).toBe('png');
    expect(tipoDeImagen(webp)?.ext).toBe('webp');
    expect(tipoDeImagen(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull();
  });
  it('propone textos alternativos en los dos idiomas', () => {
    expect(altPropuesto({ nombre: { es: 'Olivo', en: 'Olive tree' } })).toEqual({ es: 'Olivo en el vivero', en: 'Olive tree at the nursery' });
  });
  it('convierte la referencia de la ficha en ruta de la base', () => {
    expect(rutaDeImagen('../../assets/catalogo/olivo/a.jpg')).toBe('catalogo/olivo/a.jpg');
  });
});
