/** Clave compartida entre la revisión y el alta. Un mismo decor puede vestir varios soportes. */
const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ');
interface Ficha {categoria:string; nombre:string; referencia:string; codigoDecor:string; acabado:string; formato:string; espesorMm:number|null; soporte?:string}
export function identidadProveedor(c: Ficha, proveedor = '') {
  const base = [normal(proveedor), c.categoria, normal(c.referencia || c.codigoDecor || c.nombre), String(c.espesorMm ?? ''), normal(c.formato), normal(c.acabado)];
  const soporte = normal(c.soporte || (c.nombre.match(/\b(?:MDF|aglomerado|contrachapado)\b/i)?.[0] ?? ''));
  const tratamiento = normal(c.nombre).match(/\b(hidrofug|ignifug)\w*/)?.[1];
  if (soporte || tratamiento) base.push(soporte,tratamiento || '');
  return base.join('|');
}
