import { describe, expect, it } from 'vitest';
import { validarCota, validarInterpretacion, requiereRevision, type InterpretacionBoceto } from '../../src/server/simulador/boceto';

const cota = (valorMm: number | null, precision: 'exacta' | 'aproximada' | 'desconocida', confirmada = false) => ({ valorMm, precision, confirmada, origen: 'boceto' as const });
const base = (): InterpretacionBoceto => ({
  version: 1, estado: 'pendiente', categoria: 'lavadero',
  fotoEspacioId: 'espacio-1', fotoBocetoId: 'boceto-1',
  obstaculos: [{ id: 'termo', descripcion: 'Termo existente', conservar: true }],
  preguntas: ['Confirmar ancho total'],
  modulos: [{ id: 'columna', tipo: 'hueco-electrodomestico', orden: 0,
    ancho: cota(620,'aproximada'), alto: cota(null,'desconocida'), fondo: cota(null,'desconocida'),
    piezas: [{ id: 'lateral', tipo: 'costado', catalogoVarianteId: null, acabadoId: null }]
  }]
});
describe('Contrato multimodal de boceto', () => {
  it('acepta medidas mixtas sin inventar dimensiones', () => {
    const b=base();expect(validarInterpretacion(b)).toEqual([]);expect(requiereRevision(b)).toBe(true);
  });
  it('rechaza cotas desconocidas con valor inventado', () => {
    expect(validarCota(cota(2330,'desconocida'))).toMatch(/desconocida/);
  });
  it('exige validación humana antes de aprobar', () => {
    const b=base();b.estado='validada';expect(validarInterpretacion(b)).toContain('La validación requiere confirmación humana registrada');
  });
  it('rechaza módulos duplicados', () => {
    const b=base();b.modulos.push({...b.modulos[0]});expect(validarInterpretacion(b).some(e=>e.includes('duplicado'))).toBe(true);
  });
  it('mantiene acabados por pieza independientes', () => {
    const b=base();b.modulos[0].piezas.push({id:'puerta',tipo:'puerta',catalogoVarianteId:'var-2',acabadoId:'roble'});
    expect(b.modulos[0].piezas[0].acabadoId).toBeNull();
    expect(b.modulos[0].piezas[1].acabadoId).toBe('roble');
  });
});
