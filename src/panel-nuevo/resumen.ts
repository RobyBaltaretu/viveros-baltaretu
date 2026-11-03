import type { Factura, Gasto, PresupuestoCliente } from '../server/data/tipos';
import { cifras, periodoAnterior, variacion, type Periodo } from '../server/informes/informes';

/** Comparaciones del mismo periodo; sin datos previos no se inventa una tendencia. */
export function resumenNegocio(facturas: Factura[], gastos: Gasto[], presupuestos: PresupuestoCliente[], periodo: Periodo) {
  const contar = (p: Periodo) => presupuestos.filter(x => x.fecha >= p.desde && x.fecha <= p.hasta).length;
  const anterior = periodoAnterior(periodo);
  const actual = cifras(facturas, gastos, [], periodo);
  const antes = cifras(facturas, gastos, [], anterior);
  return [
    { nombre: 'Presupuestos', valor: contar(periodo), euros: false, cambio: variacion(contar(periodo), contar(anterior)), href: '/panel/presupuestos-cliente', permiso: 'presupuestos' as const },
    { nombre: 'Facturado', valor: actual.ingresos, euros: true, cambio: variacion(actual.ingresos, antes.ingresos), href: '/panel/facturas', permiso: 'facturas' as const },
    { nombre: 'Gastos', valor: actual.gastos, euros: true, cambio: variacion(actual.gastos, antes.gastos), href: '/panel/gastos', permiso: 'gastos' as const },
    { nombre: 'Cobros', valor: actual.cobrado, euros: true, cambio: variacion(actual.cobrado, antes.cobrado), href: '/panel/informes', permiso: 'informes' as const },
  ];
}

/** Hitos administrativos reales del presupuesto, no porcentaje de ejecución de la obra. */
export function proyectosDe(presupuestos: PresupuestoCliente[]) {
  return presupuestos.filter(p => p.estado === 'aceptado').map(p => {
    const terminado = !!p.cobroResto && (p.totales.anticipo === 0 || !!p.cobroAnticipo);
    const avance = terminado ? 100 : p.facturaId ? 75 : p.cobroAnticipo ? 50 : 25;
    return { ...p, avance, terminado, etapa: terminado ? 'Cobrado' : p.facturaId ? 'Factura final preparada' : p.cobroAnticipo ? 'Anticipo cobrado' : 'Presupuesto aceptado' };
  }).sort((a,b) => b.actualizado.localeCompare(a.actualizado));
}

/** Coordenadas de una gráfica de datos reales; admite ceros e importes negativos. */
export function trazado(valores: number[]) {
  const min = Math.min(0, ...valores);
  const max = Math.max(1, ...valores);
  return valores.map((v, i) => `${i * 600 / Math.max(1, valores.length - 1)},${100 - (v - min) / (max - min) * 85}`).join(' ');
}
