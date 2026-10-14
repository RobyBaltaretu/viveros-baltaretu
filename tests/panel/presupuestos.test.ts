import { describe, expect, it } from 'vitest';
import { celdaCsv, presupuestosCsv } from '../../src/server/panel/presupuestos.ts';

describe('exportación de presupuestos', () => {
  it('escapa comillas y neutraliza fórmulas', () => {
    expect(celdaCsv('Hola "amigo"')).toBe('"Hola ""amigo"""');
    expect(celdaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celdaCsv('+34 600')).toBe(`"'+34 600"`);
  });
  it('genera cabecera y una fila por presupuesto', () => {
    const csv = presupuestosCsv([
      { id: 'a', fecha: '2026-10-14', estado: 'nuevo', idioma: 'es', tipoPedido: 'unidad', nombre: 'Ana', email: 'a@example.com', telefono: '', empresa: '', provincia: '', mensaje: 'x', lineas: [{ especie: 'olivo', nombre: 'Olivo', cantidad: 2 }] },
    ]);
    expect(csv.startsWith('﻿"Fecha"')).toBe(true);
    expect(csv).toContain('"por unidad"');
    expect(csv).toContain('"2 × Olivo"');
  });
});
