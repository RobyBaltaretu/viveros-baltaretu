import type { ArticuloCatalogo } from '../data/tipos';
import type { MaterialOption } from './materiales';

/** Solo datos descriptivos: nunca enviamos costes, márgenes o contactos al proveedor de IA. */
export function materialesDelTaller(articulos: ArticuloCatalogo[]): MaterialOption[] {
  return articulos.filter(a => !a.archivado).flatMap(a => {
    const categorias: MaterialOption['categoria'][] = a.visual?.uso?.length ? a.visual.uso : a.categoria === 'encimeras' ? ['encimera'] : ['tableros','macizos','chapas','acabados'].includes(a.categoria) ? ['mueble', ...(/suelo|tarima|parquet/i.test(a.nombre) || a.categoria === 'macizos' ? ['suelo' as const] : [])] : [];
    return categorias.map(categoria => ({id:`catalogo:${a.id}`,nombre:a.nombre,descripcion:[a.referencia,a.acabado,a.espesor ? `${a.espesor} mm` : ''].filter(Boolean).join(' · '),promptDescriptor:JSON.stringify({material:a.nombre,referencia:a.referencia,acabado:a.acabado,espesorMm:a.espesor,visual:a.visual}),finish:a.acabado || 'Acabado no especificado: no inventar textura de fabricante',categoria,previewTexture:a.visual?.textura,previewColor: a.visual?.colorHex ?? (/blanc/i.test(a.acabado+' '+a.nombre) ? '#eeeae1' : /negr|antracita/i.test(a.acabado+' '+a.nombre) ? '#383835' : /nogal/i.test(a.nombre) ? '#70523d' : '#bda17c')}));
  });
}
export const DISTRIBUCIONES = ['Conservar distribución', 'Lineal', 'En L', 'En U', 'Con isla', 'Frente de armario', 'Mueble independiente'] as const;
export const APERTURAS = ['Conservar apertura', 'Abatible', 'Corredera', 'Plegable', 'Cajones'] as const;
export const ACABADOS = ['Según catálogo', 'Mate', 'Satinado', 'Brillo'] as const;
export const VETAS = ['Según catálogo', 'Vertical', 'Horizontal'] as const;
export interface DetallesProyecto { ancho: number | null; alto: number | null; fondo: number | null; puertas: number | null; cajones: number | null; distribucion: string; apertura: string; acabado: string; veta: string }
export function detallesProyecto(valor: unknown): DetallesProyecto {
 const p = (valor && typeof valor === 'object' ? valor : {}) as Record<string,unknown>;
 const numero = (k:string,max:number,entero=false) => {const v=p[k]; if(v===undefined||v===null||v==='')return null; if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max||(entero&&!Number.isInteger(v)))throw Error('Medida no válida');return v;};
 const opcion = (k:string,lista:readonly string[]) => {if(p[k]===undefined)return lista[0];if(!lista.includes(p[k] as string))throw Error('Opción no válida');return p[k] as string;};
 return {ancho:numero('ancho',3000),alto:numero('alto',1000),fondo:numero('fondo',300),puertas:numero('puertas',30,true),cajones:numero('cajones',50,true),distribucion:opcion('distribucion',DISTRIBUCIONES),apertura:opcion('apertura',APERTURAS),acabado:opcion('acabado',ACABADOS),veta:opcion('veta',VETAS)};
}
