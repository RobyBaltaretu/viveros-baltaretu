import {z} from 'astro/zod';
const url=z.string().max(1000).url().refine(v=>{try{return new URL(v).protocol==='https:';}catch{return false;}},'Usa una dirección HTTPS');
export const esquemaVisual=z.object({
 fabricante:z.string().max(100).optional(),coleccion:z.string().max(100).optional(),codigoDecor:z.string().max(80).optional(),
 fuente:url.optional(),textura:url.optional(),colorHex:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
 escalaAnchoMm:z.number().positive().max(100000).optional(),escalaAltoMm:z.number().positive().max(100000).optional(),
 veta:z.enum(['sin-veta','vertical','horizontal','direccional']).optional(),brillo:z.enum(['mate','satinado','brillante']).optional(),
 soporte:z.string().max(100).optional(),uso:z.array(z.enum(['mueble','encimera','suelo'])).max(3).optional(),
 reformas:z.array(z.enum(['cocina','bano','armario','vestidor','puertas','salon','oficina','lavadero'])).max(8).optional(),
 humedad:z.enum(['no-declarada','interior-seco','humedo-segun-ficha']).optional(),
 licencia:z.string().max(300).optional(),verificadoEl:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();
export type DatosVisuales=z.infer<typeof esquemaVisual>;
