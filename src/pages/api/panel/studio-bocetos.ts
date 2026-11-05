import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clienteActual } from '../../../plataforma/actual.ts';
import { sesionCon } from '../../../server/panel/pagina.ts';
import { cuerpoLimitado } from '../../../server/panel/cuerpo.ts';
import { asegurarEsquema } from '../../../server/data/d1/migraciones.ts';
import type { BaseD1 } from '../../../server/data/d1/base.ts';
import { compatibilidadPieza } from '../../../server/simulador/compatibilidad-materiales.ts';
import { validarInterpretacion, type InterpretacionBoceto } from '../../../server/simulador/boceto.ts';
import { sentenciasStudio } from '../../../server/data/d1/studio.ts';

export const prerender = false;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
const db = () => (env as unknown as { DB: BaseD1 }).DB;
const tenant = () => clienteActual().id;
const esTuria = () => tenant() === 'turia';
const validoId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(v);
const ahora = () => new Date().toISOString();
type Fila = { id: string; titulo: string; estado: string; interpretacion: string; revision: number; actualizado: string };
const mapear = (f: Fila) => ({...f, interpretacion: JSON.parse(f.interpretacion) as InterpretacionBoceto});
function interpretar(v: unknown): InterpretacionBoceto | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const b=v as InterpretacionBoceto;
  if (!Array.isArray(b.modulos) || !Array.isArray(b.obstaculos) || !Array.isArray(b.preguntas) || typeof b.categoria !== 'string' || typeof b.fotoEspacioId !== 'string' || typeof b.fotoBocetoId !== 'string') return null;
  if (b.modulos.some(m=>!m || typeof m !== 'object' || !Array.isArray(m.piezas) || !m.ancho || !m.alto || !m.fondo)) return null;
  return b;
}
export const GET: APIRoute = async ({locals,url}) => {
  if (!esTuria()) return json(404,{ok:false});
  if (!sesionCon(locals,'editar')) return json(403,{ok:false});
  await asegurarEsquema(db());
  const id=url.searchParams.get('id');
  if (id && !validoId(id)) return json(400,{ok:false,error:'ID inválido'});
  if (id) {
    const f=await sentenciasStudio(db()).leerBoceto2().bind(id,tenant()).first<Fila>();
    return f ? json(200,{ok:true,boceto:mapear(f)}) : json(404,{ok:false});
  }
  const filas=await sentenciasStudio(db()).leerBoceto3().bind(tenant()).all<Omit<Fila,'interpretacion'>>();
  return json(200,{ok:true,bocetos:filas.results});
};
export const POST: APIRoute = async ({locals,request}) => {
  if (!esTuria()) return json(404,{ok:false});
  const sesion=sesionCon(locals,'editar');if(!sesion)return json(403,{ok:false});
  const limitado=await cuerpoLimitado(request,100_000);if(!limitado)return json(413,{ok:false});
  let entrada: {titulo?:unknown;interpretacion?:unknown};
  try {entrada=await limitado.json();} catch {return json(400,{ok:false,error:'JSON inválido'});}
  const b=interpretar(entrada?.interpretacion);
  if (!b) return json(400,{ok:false,error:'Boceto inválido'});
  const errores=validarInterpretacion(b);
  if (errores.length) return json(400,{ok:false,errores});
  if (b.estado==='validada') return json(400,{ok:false,error:'La validación debe hacerse tras guardar y revisar el borrador'});
  const titulo=typeof entrada.titulo==='string'?entrada.titulo.trim().slice(0,120):'';
  if (!titulo)return json(400,{ok:false,error:'Falta título'});
  await asegurarEsquema(db());
  const id='studio_'+crypto.randomUUID(),fecha=ahora(),texto=JSON.stringify(b),email=sesion.usuario.email;
  await db().batch([
    sentenciasStudio(db()).insertarBoceto()
      .bind(id,tenant(),titulo,'borrador',texto,fecha,fecha,email),
    sentenciasStudio(db()).insertarVersion()
      .bind(id,texto,fecha,email)
  ]);
  return json(201,{ok:true,id,revision:1});
};
export const PATCH: APIRoute = async ({locals,request}) => {
  if (!esTuria())return json(404,{ok:false});
  const sesion=sesionCon(locals,'editar');if(!sesion)return json(403,{ok:false});
  const limitado=await cuerpoLimitado(request,100_000);if(!limitado)return json(413,{ok:false});
  let entrada: {id?:unknown;revision?:unknown;interpretacion?:unknown;titulo?:unknown};
  try {entrada=await limitado.json();}catch{return json(400,{ok:false,error:'JSON inválido'});}
  if (!validoId(entrada.id) || !Number.isSafeInteger(entrada.revision) || Number(entrada.revision)<1)return json(400,{ok:false,error:'ID o revisión inválida'});
  const b=interpretar(entrada.interpretacion);if(!b)return json(400,{ok:false,error:'Boceto inválido'});
  if(b.estado==='validada'){
    b.confirmadaPor=sesion.usuario.email;
    b.confirmadaEn=ahora();
    if(b.modulos.some(m=>[m.ancho,m.alto,m.fondo].some(c=>c.precision==='aproximada'&&!c.confirmada)))return json(400,{ok:false,error:'Confirma las cotas aproximadas antes de validar'});
  }
  const errores=validarInterpretacion(b);if(errores.length)return json(400,{ok:false,errores});
  const seleccionadas=b.modulos.flatMap(m=>m.piezas).filter(p=>p.catalogoVarianteId);
  if(seleccionadas.length){
    const [variantes,articulos]=await Promise.all([sesion.repos.catalogo.variantes?.()??Promise.resolve([]),sesion.repos.catalogo.articulos()]);
    const porId=new Map(variantes.map(v=>[v.id,v]));
    const porArticulo=new Map(articulos.map(a=>[a.id,a]));
    for(const pieza of seleccionadas){
      const variante=porId.get(pieza.catalogoVarianteId!);
      const articulo=variante?porArticulo.get(variante.articuloId):undefined;
      if(!variante||!articulo)return json(400,{ok:false,error:'La referencia del material no existe en el catálogo'});
      const resultado=compatibilidadPieza(pieza,articulo,variante);
      if(!resultado.compatible)return json(400,{ok:false,error:'Material incompatible con '+pieza.tipo,detalles:resultado.errores});
    }
  }
  await asegurarEsquema(db());
  if(b.estado==='validada' && (b.fotoEspacioId.startsWith('pendiente-') || b.fotoBocetoId.startsWith('pendiente-')))return json(409,{ok:false,error:'Guarda las dos fotografías antes de validar'});
  if(b.estado==='validada'){
    const fotos=await sentenciasStudio(db()).leerArchivo2()
      .bind(entrada.id,tenant(),b.fotoEspacioId,b.fotoBocetoId).all<{id:string;clase:string}>();
    if(!fotos.results.some(f=>f.id===b.fotoEspacioId&&f.clase==='espacio')||
       !fotos.results.some(f=>f.id===b.fotoBocetoId&&f.clase==='boceto'))
      return json(409,{ok:false,error:'Las dos fotografías deben pertenecer al boceto y tener el tipo correcto'});
  }
  const anterior=await sentenciasStudio(db()).leerBoceto4().bind(entrada.id,tenant()).first<{revision:number;estado:string}>();
  if(!anterior)return json(404,{ok:false});
  if(anterior.estado==='validada')return json(409,{ok:false,error:'El diseño validado es inmutable; crea una nueva versión de trabajo'});
  if(anterior.revision!==entrada.revision)return json(409,{ok:false,error:'Otro cambio ha actualizado el boceto. Recarga antes de guardar.',revision:anterior.revision});
  const revision=anterior.revision+1,fecha=ahora(),texto=JSON.stringify(b);
  const titulo=typeof entrada.titulo==='string' && entrada.titulo.trim()?entrada.titulo.trim().slice(0,120):null;
  // El historial y la actualización se confirman en un mismo lote transaccional.
  // La versión (inserción con selección) solo se crea si la actualización optimista tuvo éxito.
  const resultados=await db().batch([
    sentenciasStudio(db()).actualizarBoceto()
      .bind(texto,b.estado==='validada'?'validada':'borrador',revision,titulo,fecha,sesion.usuario.email,entrada.id,tenant(),anterior.revision,'validada'),
    sentenciasStudio(db()).insertarVersion2()
      .bind(fecha,sesion.usuario.email,entrada.id,tenant(),revision)
  ]);
  if(!resultados[0]?.meta?.changes)return json(409,{ok:false,error:'Conflicto de edición'});
  return json(200,{ok:true,id:entrada.id,revision});
};
