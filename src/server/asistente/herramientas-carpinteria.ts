import { z } from 'astro/zod';
import { clienteActual } from '../../plataforma/actual.ts';
import { CATEGORIAS as CATEGORIAS_CATALOGO, guardarArticulo, precioVenta, sinPrecio, UNIDADES } from '../catalogo/catalogo.ts';
import type { ArticuloCatalogo, EstadoPedido, EstadoPresupuestoCliente, PedidoProveedor, PresupuestoCliente, Proveedor, Repositorios } from '../data/tipos.ts';
import { ajustesFacturacion } from '../panel/facturacion.ts';
import { dinero } from '../facturas/importes.ts';
import { cambiarEstadoPedido, costeDe, crearPedido } from '../pedidos/pedidos.ts';
import { facturarLoQueToca, porFacturar } from '../presupuestos-cliente/facturar.ts';
import { apuntarCobro, cambiarEstado, crearPresupuesto, estadoEfectivo, pasosDesde } from '../presupuestos-cliente/presupuestos.ts';
import { proveedorVacio } from '../proveedores/proveedores.ts';
import { nifValido } from '../facturas/nif.ts';
import { normalizar } from './coincidencia.ts';
import type { Cambio, Consulta, Herramienta } from './herramientas.ts';

/**
 * Herramientas de la carpintería (Gubia, en Turia): presupuestos a cliente,
 * catálogo, proveedores y pedidos de material. Mismas reglas que las demás:
 * las consultas leen; los cambios preparan una propuesta que solo se aplica con
 * «Sí», volviendo a validar con las reglas de cada pantalla. Su módulo está en
 * `DE_LA_CARPINTERIA` (src/plataforma/modulos.ts): en un cliente sin esos
 * módulos (Baltaretu) no existen.
 */
const consulta = <A>(h: Omit<Consulta<A>, 'tipo'>) => ({ ...h, tipo: 'consulta' as const }) as unknown as Herramienta;
const cambio = <A>(h: Omit<Cambio<A>, 'tipo'>) => ({ ...h, tipo: 'cambio' as const }) as unknown as Herramienta;
const opcional = <T extends z.ZodType>(t: T) => t.optional().nullable();
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('AAAA-MM-DD');
const contiene = (t: string, q?: string | null) => !q || normalizar(t).includes(normalizar(q));
const ivaFijo = () => (clienteActual().iva.fijo ? clienteActual().iva.general : null);
const sumarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Uno por id, código o nombre; si hay varios, se pide elegir. */
function elegir<T>(lista: T[], texto: string, claves: (x: T) => string[], que: string, nombre: (x: T) => string): { ok: true; uno: T } | { ok: false; error: string } {
  const n = normalizar(texto);
  const exacto = lista.find((x) => claves(x).some((k) => normalizar(k) === n));
  if (exacto) return { ok: true, uno: exacto };
  const parecidos = lista.filter((x) => claves(x).some((k) => normalizar(k).includes(n)));
  if (parecidos.length === 1) return { ok: true, uno: parecidos[0]! };
  if (parecidos.length > 1) return { ok: false, error: `Hay varios ${que}: ${parecidos.slice(0, 8).map(nombre).join(', ')}. Pregunta cuál.` };
  return { ok: false, error: `No encuentro ${que === 'clientes' ? 'el cliente' : que === 'proveedores' ? 'el proveedor' : que === 'artículos' ? 'el artículo' : que === 'pedidos' ? 'el pedido' : 'el presupuesto'} «${texto}».` };
}

const unCliente = async (repos: Repositorios, t: string) => {
  const r = elegir(await repos.clientes.listar({ incluirArchivados: true }), t, (c) => [c.id, c.nombre, c.nif], 'clientes', (c) => `${c.nombre} (id ${c.id})`);
  return r.ok ? ({ ok: true, cliente: r.uno } as const) : ({ ok: false, error: `${r.error} Puedes proponer crearlo con guardar_cliente.` } as const);
};
const unPresupuesto = async (repos: Repositorios, t: string) => elegir(await repos.presupuestosCliente.listar({ limite: 2000 }), t, (p) => [p.id, p.codigo, `${p.cliente.nombre} ${p.concepto}`], 'presupuestos', (p) => `${p.codigo} ${p.cliente.nombre}: ${p.concepto}`);
const unProveedor = async (repos: Repositorios, t: string) => elegir(await repos.proveedores.listar({ incluirArchivados: true }), t, (p) => [p.id, p.nombre, p.nif], 'proveedores', (p) => `${p.nombre} (id ${p.id})`);
const unArticulo = (lista: ArticuloCatalogo[], t: string) => elegir(lista, t, (a) => [a.id, a.nombre, a.referencia], 'artículos', (a) => `${a.nombre} (id ${a.id})`);
const unPedido = async (repos: Repositorios, t: string) => elegir(await repos.pedidosProveedor.listar({ limite: 2000 }), t, (p) => [p.id, p.codigo ?? ''], 'pedidos', (p) => `${p.codigo ?? 'borrador'} a ${p.proveedor.nombre}`);

const presupuestoCorto = (p: PresupuestoCliente, hoy: string) => ({
  id: p.id,
  codigo: p.codigo,
  cliente: p.cliente.nombre,
  concepto: p.concepto,
  estado: estadoEfectivo(p, hoy),
  fecha: p.fecha,
  validez: p.validez,
  total: p.totales.total,
  anticipo: p.totales.anticipo,
  anticipoCobrado: p.cobroAnticipo,
  restoCobrado: p.cobroResto,
  porFacturar: porFacturar(p),
  siguientesEstados: pasosDesde(estadoEfectivo(p, hoy)),
});
const articuloCorto = (a: ArticuloCatalogo) => ({
  id: a.id,
  nombre: a.nombre,
  categoria: a.categoria,
  unidad: a.unidad,
  coste: a.coste,
  margen: a.margen,
  precioVenta: sinPrecio(a) ? null : precioVenta(a),
  proveedor: a.proveedor,
  referencia: a.referencia,
});
const pedidoCorto = (p: PedidoProveedor) => ({
  id: p.id,
  codigo: p.codigo ?? 'borrador',
  proveedor: p.proveedor.nombre,
  estado: p.estado,
  fecha: p.fecha,
  entrega: p.entrega,
  coste: p.coste,
  lineas: p.lineas.map((l) => `${l.cantidad} ${l.unidad} ${l.concepto}`).slice(0, 12),
});
const proveedorCorto = (p: Proveedor) => ({ id: p.id, nombre: p.nombre, contacto: p.contacto, telefono: p.telefono, email: p.email, plazoDias: p.plazoDias, formaPago: p.formaPago, oculto: p.archivado });

const LINEA_PRESUPUESTO = z.object({
  concepto: z.string().min(1).max(200),
  cantidad: z.number().positive(),
  precio: z.number().min(0).describe('Por unidad, sin IVA'),
  material: opcional(z.string().max(120)),
  extra: opcional(z.boolean()).describe('Opcional que se ofrece aparte y no suma'),
});
type LineaP = z.infer<typeof LINEA_PRESUPUESTO>;
interface NuevoPresupuesto {
  cliente: string;
  concepto: string;
  lineas: LineaP[];
  validezDias?: number | null;
  anticipoPct?: number | null;
  formaPago?: string | null;
  notas?: string | null;
}

const ESTADOS_A: EstadoPresupuestoCliente[] = ['borrador', 'enviado', 'aceptado', 'rechazado'];
const LINEA_PEDIDO = z.object({
  concepto: z.string().min(1).max(200),
  cantidad: z.number().positive(),
  unidad: opcional(z.string().max(10)),
  coste: opcional(z.number().min(0)).describe('Coste por unidad sin IVA, si se sabe'),
  articulo: opcional(z.string()).describe('Id o nombre del artículo del catálogo, si sale de él'),
  detalle: opcional(z.string().max(200)).describe('Medidas, acabado…'),
});
type LineaPe = z.infer<typeof LINEA_PEDIDO>;

export const HERRAMIENTAS_CARPINTERIA: Herramienta[] = [
  consulta({
    nombre: 'ver_presupuestos_cliente',
    descripcion: 'Presupuestos a cliente (de obras y trabajos): estado, total, anticipo, cobros y qué falta por facturar. Filtra por estado, cliente o texto.',
    permiso: 'facturas',
    esquema: z.object({ estado: opcional(z.enum(['borrador', 'enviado', 'aceptado', 'rechazado', 'caducado'])), cliente: opcional(z.string()), texto: opcional(z.string()) }),
    async consultar({ repos, hoy }, a: { estado?: EstadoPresupuestoCliente | null; cliente?: string | null; texto?: string | null }) {
      const lista = (await repos.presupuestosCliente.listar({ limite: 500 })).filter((p) => (!a.estado || estadoEfectivo(p, hoy) === a.estado) && contiene(p.cliente.nombre, a.cliente) && contiene(`${p.codigo} ${p.concepto} ${p.notas}`, a.texto));
      return { total: lista.length, presupuestos: lista.slice(0, 30).map((p) => presupuestoCorto(p, hoy)) };
    },
  }),
  cambio({
    nombre: 'crear_presupuesto_cliente',
    descripcion: 'Crea un presupuesto a cliente en borrador, con sus líneas (precios sin IVA; el IVA es el del negocio). Para precios del catálogo, consulta antes buscar_catalogo.',
    permiso: 'facturas',
    esquema: z.object({
      cliente: z.string().describe('Nombre, NIF o id del cliente'),
      concepto: z.string().min(1).max(200).describe('Qué se presupuesta, p. ej. «Armario empotrado del dormitorio»'),
      lineas: z.array(LINEA_PRESUPUESTO).min(1).max(100),
      validezDias: opcional(z.number().int().min(0).max(365)).describe('Días que vale (por defecto 30)'),
      anticipoPct: opcional(z.number().min(0).max(100)).describe('Anticipo en % (por defecto 0)'),
      formaPago: opcional(z.string().max(80)),
      notas: opcional(z.string().max(1000)),
    }),
    async preparar({ repos }, a: NuevoPresupuesto) {
      const c = await unCliente(repos, a.cliente);
      if (!c.ok) return c;
      const base = a.lineas.filter((l) => !l.extra).reduce((t, l) => t + l.cantidad * l.precio, 0);
      return { ok: true, resumen: `Presupuesto en borrador para ${c.cliente.nombre}: «${a.concepto}», ${a.lineas.length} ${a.lineas.length === 1 ? 'línea' : 'líneas'}, ${dinero(base)} sin IVA${a.anticipoPct ? ` y anticipo del ${a.anticipoPct} %` : ''}.`, argumentos: { ...a, cliente: c.cliente.id } };
    },
    async aplicar(ctx, a: NuevoPresupuesto) {
      const r = await crearPresupuesto(
        ctx.repos,
        {
          clienteId: a.cliente,
          concepto: a.concepto,
          fecha: ctx.hoy,
          validez: sumarDias(ctx.hoy, a.validezDias ?? 30),
          lineas: a.lineas.map((l) => ({ concepto: l.concepto, cantidad: l.cantidad, precio: l.precio, material: l.material ?? '', extra: !!l.extra })),
          iva: ivaFijo() ?? clienteActual().iva.general,
          anticipoPct: a.anticipoPct ?? 0,
          formaPago: a.formaPago ?? '',
          notas: a.notas ?? '',
        },
        ctx.usuario.email,
        ivaFijo(),
      );
      return r.ok ? { ok: true, texto: `Presupuesto ${r.presupuesto.codigo} creado en borrador (${dinero(r.presupuesto.totales.total)} con IVA). Revísalo y envíalo desde «Presupuestos».` } : { ok: false, texto: r.error };
    },
  }),
  cambio({
    nombre: 'gestionar_presupuesto_cliente',
    descripcion: 'Sobre un presupuesto a cliente: cambiar su estado («enviado», «aceptado», «rechazado», «borrador»), apuntar un cobro («cobro_anticipo», «cobro_resto») o «facturar» lo que toca (anticipo o factura final, como borrador).',
    permiso: 'facturas',
    esquema: z.object({ presupuesto: z.string().describe('Código (P2026-0001), id o cliente y concepto'), accion: z.enum(['enviado', 'aceptado', 'rechazado', 'borrador', 'cobro_anticipo', 'cobro_resto', 'facturar']), fecha: opcional(fecha).describe('Día del cobro') }),
    async preparar({ repos, hoy }, a: { presupuesto: string; accion: string; fecha?: string | null }) {
      const r = await unPresupuesto(repos, a.presupuesto);
      if (!r.ok) return r;
      const p = r.uno;
      const nombre = `${p.codigo} de ${p.cliente.nombre} (${dinero(p.totales.total)})`;
      if (ESTADOS_A.includes(a.accion as EstadoPresupuestoCliente)) {
        if (!pasosDesde(estadoEfectivo(p, hoy)).includes(a.accion as EstadoPresupuestoCliente)) return { ok: false, error: `Está «${estadoEfectivo(p, hoy)}» y de ahí solo puede pasar a: ${pasosDesde(estadoEfectivo(p, hoy)).join(', ') || 'nada'}.` };
        return { ok: true, resumen: `Marcar como ${a.accion} el presupuesto ${nombre}.`, argumentos: { ...a, presupuesto: p.id } };
      }
      if (a.accion === 'facturar') {
        const que = porFacturar(p);
        if (!que) return { ok: false, error: 'Ese presupuesto ya está facturado del todo.' };
        return { ok: true, resumen: `Hacer la factura ${que === 'anticipo' ? 'de anticipo' : 'final'} (borrador) del presupuesto ${nombre}.`, argumentos: { ...a, presupuesto: p.id } };
      }
      return { ok: true, resumen: `Apuntar el cobro del ${a.accion === 'cobro_anticipo' ? 'anticipo' : 'resto'} del presupuesto ${nombre}${a.fecha ? ` el ${a.fecha}` : ' hoy'}.`, argumentos: { ...a, presupuesto: p.id } };
    },
    async aplicar(ctx, a: { presupuesto: string; accion: string; fecha?: string | null }) {
      const { repos, usuario, hoy } = ctx;
      if (a.accion === 'facturar') {
        const r = await facturarLoQueToca(repos, a.presupuesto, usuario.email, await ajustesFacturacion(repos), hoy);
        return r.ok ? { ok: true, texto: 'Factura creada en borrador: revísala y emítela en «Facturas».' } : { ok: false, texto: 'error' in r ? String(r.error) : 'No se ha podido facturar.' };
      }
      const r =
        a.accion === 'cobro_anticipo' || a.accion === 'cobro_resto'
          ? await apuntarCobro(repos, a.presupuesto, a.accion === 'cobro_anticipo' ? 'anticipo' : 'resto', a.fecha ?? hoy, usuario.email)
          : await cambiarEstado(repos, a.presupuesto, a.accion as EstadoPresupuestoCliente, usuario.email, hoy);
      return r.ok ? { ok: true, texto: `Presupuesto ${r.presupuesto.codigo} actualizado.` } : { ok: false, texto: r.error };
    },
  }),
  consulta({
    nombre: 'buscar_catalogo',
    descripcion: 'Catálogo de la carpintería: artículos (materiales, herrajes, mano de obra…) con coste, margen y precio de venta sin IVA, y los trabajos (plantillas de muebles). Filtra por texto o categoría.',
    permiso: 'facturas',
    esquema: z.object({ texto: opcional(z.string()), categoria: opcional(z.enum(CATEGORIAS_CATALOGO.map((c) => c.id) as [string, ...string[]])), sinPrecio: opcional(z.boolean()).describe('Solo los que no tienen precio') }),
    async consultar({ repos }, a: { texto?: string | null; categoria?: string | null; sinPrecio?: boolean | null }) {
      const articulos = (await repos.catalogo.articulos()).filter((x) => (!a.categoria || x.categoria === a.categoria) && contiene(`${x.nombre} ${x.referencia} ${x.proveedor} ${x.acabado}`, a.texto) && (!a.sinPrecio || sinPrecio(x)));
      const trabajos = a.categoria || a.sinPrecio ? [] : (await repos.catalogo.plantillas()).filter((p) => contiene(p.nombre, a.texto));
      return { articulos: articulos.slice(0, 40).map(articuloCorto), totalArticulos: articulos.length, trabajos: trabajos.slice(0, 20).map((p) => ({ id: p.id, nombre: p.nombre })), aviso: 'El precio de un trabajo depende de sus medidas: se calcula en «Catálogo», en su calculadora.' };
    },
  }),
  cambio({
    nombre: 'cambiar_articulos',
    descripcion: 'Cambia uno o varios artículos del catálogo a la vez (coste, margen, precio fijo, proveedor, referencia) o crea uno nuevo (con «nuevo»: categoría, nombre y unidad). Una sola propuesta.',
    permiso: 'facturas',
    esquema: z.object({
      cambios: z
        .array(
          z.object({
            articulo: opcional(z.string()).describe('Id o nombre del artículo que se cambia'),
            nuevo: opcional(z.object({ categoria: z.enum(CATEGORIAS_CATALOGO.map((c) => c.id) as [string, ...string[]]), nombre: z.string().min(1).max(120), unidad: z.enum(UNIDADES) })),
            coste: opcional(z.number().min(0)),
            margen: opcional(z.number().min(0).max(1000)).describe('En %'),
            precioFijo: opcional(z.number().min(0)).describe('Precio de venta fijo sin IVA (en vez de coste + margen)'),
            proveedor: opcional(z.string().max(80)),
            referencia: opcional(z.string().max(60)),
          }),
        )
        .min(1)
        .max(100),
    }),
    async preparar({ repos }, a: { cambios: { articulo?: string | null; nuevo?: { categoria: string; nombre: string; unidad: string } | null; coste?: number | null; margen?: number | null; precioFijo?: number | null }[] }) {
      const lista = await repos.catalogo.articulos({ incluirArchivados: true });
      const lineas: string[] = [];
      const cambios = [];
      for (const c of a.cambios) {
        if (c.nuevo) {
          lineas.push(`nuevo «${c.nuevo.nombre}»${c.coste != null ? ` a ${dinero(c.coste)}` : ''}`);
          cambios.push({ ...c, articulo: null });
          continue;
        }
        if (!c.articulo) return { ok: false, error: 'Falta qué artículo cambiar (o «nuevo» para crearlo).' };
        const r = unArticulo(lista, c.articulo);
        if (!r.ok) return r;
        const que = [c.coste != null && `coste ${dinero(c.coste)}`, c.margen != null && `margen ${c.margen} %`, c.precioFijo != null && `precio ${dinero(c.precioFijo)}`].filter(Boolean).join(', ');
        lineas.push(`${r.uno.nombre}${que ? `: ${que}` : ''}`);
        cambios.push({ ...c, articulo: r.uno.id });
      }
      return { ok: true, resumen: `Catálogo (${cambios.length}): ${lineas.slice(0, 10).join('; ')}${lineas.length > 10 ? '…' : ''}.`, argumentos: { cambios } };
    },
    async aplicar(ctx, a: { cambios: { articulo?: string | null; nuevo?: { categoria: string; nombre: string; unidad: string } | null; coste?: number | null; margen?: number | null; precioFijo?: number | null; proveedor?: string | null; referencia?: string | null }[] }) {
      const errores: string[] = [];
      let hechos = 0;
      for (const c of a.cambios) {
        const previo = c.articulo ? await ctx.repos.catalogo.articulo(c.articulo) : null;
        if (c.articulo && !previo) {
          errores.push(`${c.articulo} ya no está.`);
          continue;
        }
        const base = previo ?? { categoria: c.nuevo!.categoria, nombre: c.nuevo!.nombre, unidad: c.nuevo!.unidad, coste: 0, merma: 0, margen: 0, precioFijo: null, referencia: '', proveedor: '', espesor: null, acabado: '', notas: '' };
        const r = await guardarArticulo(
          ctx.repos,
          {
            ...(previo ? { id: previo.id } : {}),
            categoria: base.categoria,
            nombre: base.nombre,
            unidad: base.unidad as (typeof UNIDADES)[number],
            coste: c.coste ?? base.coste,
            merma: base.merma,
            margen: c.margen ?? base.margen,
            precioFijo: c.precioFijo !== undefined && c.precioFijo !== null ? c.precioFijo : base.precioFijo,
            referencia: c.referencia ?? base.referencia,
            proveedor: c.proveedor ?? base.proveedor,
            espesor: base.espesor,
            acabado: base.acabado,
            notas: base.notas,
          },
          ctx.usuario.email,
        );
        if (r.ok) hechos++;
        else errores.push(`${base.nombre}: ${'errores' in r ? (r.errores as { mensaje: string }[]).map((e) => e.mensaje).join(' ') : 'no se ha podido guardar'}`);
      }
      return { ok: hechos > 0, texto: `${hechos} ${hechos === 1 ? 'artículo guardado' : 'artículos guardados'}.${errores.length ? ` No se pudo: ${errores.join(' ')}` : ''}` };
    },
  }),
  consulta({
    nombre: 'ver_proveedores',
    descripcion: 'Proveedores de material: contacto, teléfono, plazo de entrega y forma de pago.',
    permiso: 'facturas',
    esquema: z.object({ texto: opcional(z.string()), ocultos: opcional(z.boolean()) }),
    async consultar({ repos }, a: { texto?: string | null; ocultos?: boolean | null }) {
      const lista = (await repos.proveedores.listar({ incluirArchivados: !!a.ocultos })).filter((p) => contiene(`${p.nombre} ${p.contacto} ${p.poblacion} ${p.nif}`, a.texto));
      return { total: lista.length, proveedores: lista.slice(0, 40).map(proveedorCorto) };
    },
  }),
  cambio({
    nombre: 'guardar_proveedor',
    descripcion: 'Da de alta un proveedor o cambia sus datos (si se indica «proveedor», el que ya existe). También ocultarlo (ya no se le compra) o recuperarlo.',
    permiso: 'facturas',
    esquema: z.object({
      proveedor: opcional(z.string()).describe('Id o nombre de uno que ya existe; vacío = alta'),
      nombre: opcional(z.string().min(1).max(120)),
      contacto: opcional(z.string().max(120)),
      telefono: opcional(z.string().max(40)),
      email: opcional(z.email().max(120)),
      nif: opcional(z.string().max(20)),
      poblacion: opcional(z.string().max(80)),
      plazoDias: opcional(z.number().int().min(0).max(365)),
      formaPago: opcional(z.string().max(80)),
      notas: opcional(z.string().max(1000)),
      oculto: opcional(z.boolean()),
    }),
    async preparar({ repos }, a: Partial<Record<'proveedor' | 'nombre' | 'nif', string | null>> & Record<string, unknown>) {
      if (a.nif && !nifValido(String(a.nif))) return { ok: false, error: 'Ese NIF no es válido.' };
      if (!a.proveedor) return a.nombre ? { ok: true, resumen: `Dar de alta el proveedor «${a.nombre}».`, argumentos: a } : { ok: false, error: 'Falta el nombre del proveedor.' };
      const r = await unProveedor(repos, a.proveedor);
      if (!r.ok) return r;
      const campos = Object.keys(a).filter((k) => k !== 'proveedor' && a[k] !== undefined && a[k] !== null);
      return { ok: true, resumen: `Cambiar ${campos.join(', ') || 'nada'} del proveedor ${r.uno.nombre}.`, argumentos: { ...a, proveedor: r.uno.id } };
    },
    async aplicar(ctx, a: Record<string, unknown> & { proveedor?: string | null }) {
      const previo = a.proveedor ? await ctx.repos.proveedores.obtener(a.proveedor) : null;
      if (a.proveedor && !previo) return { ok: false, texto: 'Ese proveedor ya no está.' };
      const p = { ...(previo ?? proveedorVacio()) };
      for (const k of ['nombre', 'contacto', 'telefono', 'email', 'nif', 'poblacion', 'formaPago', 'notas'] as const) if (typeof a[k] === 'string') p[k] = (a[k] as string).trim();
      if (typeof a.plazoDias === 'number') p.plazoDias = a.plazoDias;
      if (typeof a.oculto === 'boolean') p.archivado = a.oculto;
      p.nif = p.nif.toUpperCase();
      if (!p.nombre) return { ok: false, texto: 'Falta el nombre.' };
      await ctx.repos.proveedores.guardar(p, ctx.usuario.email);
      return { ok: true, texto: `Proveedor ${p.nombre} guardado.` };
    },
  }),
  consulta({
    nombre: 'ver_pedidos',
    descripcion: 'Pedidos de material a proveedores: estado (borrador = por enviar, enviado = esperando, recibido), fecha de entrega, coste y líneas.',
    permiso: 'facturas',
    esquema: z.object({ estado: opcional(z.enum(['borrador', 'enviado', 'recibido'])), proveedor: opcional(z.string()) }),
    async consultar({ repos }, a: { estado?: EstadoPedido | null; proveedor?: string | null }) {
      const lista = (await repos.pedidosProveedor.listar({ limite: 500, ...(a.estado ? { estado: a.estado } : {}) })).filter((p) => contiene(p.proveedor.nombre, a.proveedor));
      return { total: lista.length, pedidos: lista.slice(0, 30).map(pedidoCorto) };
    },
  }),
  cambio({
    nombre: 'crear_pedido',
    descripcion: 'Prepara un pedido de material a un proveedor (queda por enviar). Las líneas pueden salir del catálogo (artículo) o ser a mano. Opcional: el presupuesto de la obra.',
    permiso: 'facturas',
    esquema: z.object({ proveedor: z.string(), lineas: z.array(LINEA_PEDIDO).min(1).max(100), entrega: opcional(fecha).describe('Para cuándo hace falta'), presupuesto: opcional(z.string()).describe('Código del presupuesto de la obra'), notas: opcional(z.string().max(1000)).describe('Lo que lee el proveedor') }),
    async preparar({ repos, hoy }, a: { proveedor: string; lineas: LineaPe[]; entrega?: string | null; presupuesto?: string | null; notas?: string | null }) {
      const pr = await unProveedor(repos, a.proveedor);
      if (!pr.ok) return pr;
      if (a.entrega && a.entrega < hoy) return { ok: false, error: 'La fecha de entrega ya ha pasado.' };
      let presupuesto: string | null = null;
      if (a.presupuesto) {
        const p = await unPresupuesto(repos, a.presupuesto);
        if (!p.ok) return p;
        presupuesto = p.uno.id;
      }
      const articulos = await repos.catalogo.articulos();
      const lineas = [];
      for (const l of a.lineas) {
        const art = l.articulo ? unArticulo(articulos, l.articulo) : null;
        if (art && !art.ok) return art;
        const x = art?.ok ? art.uno : null;
        lineas.push({ articuloId: x?.id ?? null, concepto: l.concepto, referencia: x?.referencia ?? '', detalle: l.detalle ?? '', cantidad: l.cantidad, unidad: l.unidad || x?.unidad || 'ud', coste: l.coste ?? (x && x.coste > 0 ? x.coste : 0) });
      }
      return { ok: true, resumen: `Pedido a ${pr.uno.nombre} con ${lineas.length} ${lineas.length === 1 ? 'línea' : 'líneas'} (coste ${dinero(costeDe(lineas))}).`, argumentos: { proveedor: pr.uno.id, lineas, entrega: a.entrega ?? null, presupuesto, notas: a.notas ?? '' } };
    },
    async aplicar(ctx, a: { proveedor: string; lineas: PedidoProveedor['lineas']; entrega: string | null; presupuesto: string | null; notas: string }) {
      const r = await crearPedido(ctx.repos, { proveedorId: a.proveedor, presupuestoClienteId: a.presupuesto, entrega: a.entrega, lineas: a.lineas, notas: a.notas, notasInternas: 'Preparado con Gubia.' }, ctx.usuario.email, ctx.hoy);
      return r.ok ? { ok: true, texto: `Pedido ${r.pedido.codigo} preparado. Envíalo por WhatsApp o correo desde «Pedidos».` } : { ok: false, texto: r.errores.map((e) => e.mensaje).join(' ') };
    },
  }),
  cambio({
    nombre: 'gestionar_pedido',
    descripcion: 'Cambia el estado de un pedido: «enviado» (ya se le ha mandado), «recibido» (ha llegado) o «borrador» (volver a por enviar).',
    permiso: 'facturas',
    esquema: z.object({ pedido: z.string().describe('Código (PE2026-0001) o id'), estado: z.enum(['borrador', 'enviado', 'recibido']) }),
    async preparar({ repos }, a: { pedido: string; estado: EstadoPedido }) {
      const r = await unPedido(repos, a.pedido);
      if (!r.ok) return r;
      return { ok: true, resumen: `Marcar como ${a.estado} el pedido ${r.uno.codigo ?? ''} a ${r.uno.proveedor.nombre}.`, argumentos: { ...a, pedido: r.uno.id } };
    },
    async aplicar(ctx, a: { pedido: string; estado: EstadoPedido }) {
      const r = await cambiarEstadoPedido(ctx.repos, a.pedido, a.estado, ctx.usuario.email, ctx.hoy);
      return r.ok ? { ok: true, texto: `Pedido ${r.pedido.codigo} ${a.estado}.` } : { ok: false, texto: 'error' in r ? String(r.error) : 'No se ha podido cambiar.' };
    },
  }),
];

export const NOMBRES_CARPINTERIA = HERRAMIENTAS_CARPINTERIA.map((h) => h.nombre);

/** Temas para elegir qué herramientas se mandan al modelo (solo en la carpintería). */
export const TEMAS_CARPINTERIA: { palabras: RegExp; herramientas: string[] }[] = [
  { palabras: /presupuest|obra|trabajo|anticip|acept|rechaz|envi/, herramientas: ['ver_presupuestos_cliente', 'crear_presupuesto_cliente', 'gestionar_presupuesto_cliente', 'buscar_catalogo', 'ver_clientes'] },
  { palabras: /catalog|articul|material|tabler|herraj|canto|precio|coste|margen|melamin|madera|mano de obra/, herramientas: ['buscar_catalogo', 'cambiar_articulos'] },
  { palabras: /proveedor|suministr|comercial/, herramientas: ['ver_proveedores', 'guardar_proveedor'] },
  { palabras: /pedido|pedir|encarg|recibid|llegad|material/, herramientas: ['ver_pedidos', 'crear_pedido', 'gestionar_pedido', 'ver_proveedores', 'buscar_catalogo'] },
];

