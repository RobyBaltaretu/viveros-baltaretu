import type { CategoriaGasto } from '../../src/server/gastos/gastos.ts';

/** Tipos de gasto del vivero (los de siempre) y las palabras que los delatan en un ticket. */
export const categoriasGastoVivero: CategoriaGasto[] = [
  { id: 'planta', nombre: 'Planta y semillas', palabras: ['planta', 'semilla', 'esqueje', 'plantel', 'bulbo', 'arbol', 'palmera', 'olivo'] },
  { id: 'sustratos', nombre: 'Sustratos y abonos', palabras: ['sustrato', 'turba', 'abono', 'fertiliz', 'tierra', 'compost', 'humus', 'perlita'] },
  { id: 'macetas', nombre: 'Macetas y envases', palabras: ['maceta', 'contenedor', 'bandeja', 'alveolo', 'tiesto', 'envase'] },
  { id: 'fitosanitarios', nombre: 'Fitosanitarios', palabras: ['insecticida', 'fungicida', 'herbicida', 'fitosanitario', 'plaga', 'cobre', 'azufre'] },
  { id: 'riego', nombre: 'Riego', palabras: ['riego', 'gotero', 'manguera', 'aspersor', 'tuberia', 'goteo'] },
  { id: 'combustible', nombre: 'Combustible', palabras: ['gasolina', 'gasoil', 'diesel', 'gasoleo', 'carburante', 'repsol', 'cepsa', 'galp', 'bp ', 'shell', 'adblue'] },
  { id: 'transporte', nombre: 'Transporte y envíos', palabras: ['transporte', 'envio', 'mensajeria', 'porte', 'peaje', 'autopista', 'seur', 'mrw', 'correos'] },
  { id: 'herramientas', nombre: 'Herramientas y maquinaria', palabras: ['herramienta', 'tijera', 'pala', 'azada', 'motosierra', 'desbrozadora', 'maquina', 'carretilla'] },
  { id: 'mantenimiento', nombre: 'Reparaciones y mantenimiento', palabras: ['reparacion', 'taller', 'recambio', 'mantenimiento', 'ferreteria', 'tornill'] },
  { id: 'suministros', nombre: 'Luz, agua y teléfono', palabras: ['electricidad', 'iberdrola', 'endesa', 'naturgy', 'agua', 'telefono', 'movistar', 'vodafone', 'orange', 'fibra'] },
  { id: 'oficina', nombre: 'Oficina y papelería', palabras: ['papel', 'papeleria', 'tinta', 'impresora', 'oficina', 'sobre'] },
  { id: 'comidas', nombre: 'Comidas y dietas', palabras: ['restaurante', 'menu', 'cafe', 'bar ', 'comida', 'bocadillo'] },
  { id: 'otros', nombre: 'Otros', palabras: [] },
];
