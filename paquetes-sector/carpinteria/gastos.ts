import type { CategoriaGasto } from '../../src/server/gastos/gastos.ts';

/**
 * Tipos de gasto de la carpintería (T-20) y las palabras que los delatan en un
 * ticket. Las de siempre que valen igual (combustible, transporte, luz, oficina,
 * comidas, otros) conservan su id.
 */
export const categoriasGastoCarpinteria: CategoriaGasto[] = [
  { id: 'tableros', nombre: 'Tableros y madera', palabras: ['tablero', 'melamina', 'aglomerado', 'mdf', 'contrachapado', 'madera', 'roble', 'pino', 'haya', 'nogal', 'liston', 'finsa', 'tafisa', 'egger', 'kronospan', 'maderas'] },
  { id: 'herrajes', nombre: 'Herrajes y accesorios', palabras: ['bisagra', 'corredera', 'guia', 'tirador', 'herraje', 'blum', 'hettich', 'grass', 'emuca', 'cerradura', 'pomo', 'colgador', 'zapatero'] },
  { id: 'acabados', nombre: 'Barnices, lacas y colas', palabras: ['barniz', 'laca', 'pintura', 'cola ', 'tinte', 'aceite', 'lija', 'masilla', 'disolvente', 'sikkens', 'titan', 'renner'] },
  { id: 'cantos', nombre: 'Cantos y chapas', palabras: ['canto', 'chapa', 'laminado', 'formica', 'pvc'] },
  { id: 'cristal', nombre: 'Cristal y espejo', palabras: ['cristal', 'vidrio', 'espejo', 'cristaleria'] },
  { id: 'consumibles', nombre: 'Tornillería y consumibles', palabras: ['tornill', 'clavo', 'grapa', 'taco', 'cinta', 'silicona', 'espuma', 'ferreteria', 'spax'] },
  { id: 'maquinaria', nombre: 'Maquinaria y herramientas', palabras: ['sierra', 'fresadora', 'cepilladora', 'lijadora', 'taladro', 'atornillador', 'broca', 'fresa', 'disco', 'festool', 'makita', 'bosch', 'dewalt', 'herramienta', 'maquina'] },
  { id: 'subcontratas', nombre: 'Trabajos de otros', palabras: ['subcontrat', 'lacador', 'instalador', 'electricista', 'fontanero', 'montador', 'marmolista'] },
  { id: 'combustible', nombre: 'Combustible', palabras: ['gasolina', 'gasoil', 'diesel', 'gasoleo', 'carburante', 'repsol', 'cepsa', 'galp', 'bp ', 'shell', 'adblue'] },
  { id: 'transporte', nombre: 'Transporte y envíos', palabras: ['transporte', 'envio', 'mensajeria', 'porte', 'peaje', 'autopista', 'seur', 'mrw', 'correos'] },
  { id: 'mantenimiento', nombre: 'Furgoneta y reparaciones', palabras: ['reparacion', 'recambio', 'mantenimiento', 'itv', 'neumatico', 'furgoneta'] },
  { id: 'alquiler', nombre: 'Alquiler del taller', palabras: ['alquiler', 'arrendamiento', 'nave'] },
  { id: 'suministros', nombre: 'Luz, agua y teléfono', palabras: ['electricidad', 'iberdrola', 'endesa', 'naturgy', 'agua', 'telefono', 'movistar', 'vodafone', 'orange', 'fibra'] },
  { id: 'seguros', nombre: 'Seguros y gestoría', palabras: ['seguro', 'mapfre', 'axa', 'allianz', 'gestoria', 'asesoria'] },
  { id: 'oficina', nombre: 'Oficina y papelería', palabras: ['papel', 'papeleria', 'tinta', 'impresora', 'oficina', 'sobre'] },
  { id: 'comidas', nombre: 'Comidas y dietas', palabras: ['restaurante', 'menu', 'cafe', 'bar ', 'comida', 'bocadillo'] },
  { id: 'otros', nombre: 'Otros', palabras: [] },
];
