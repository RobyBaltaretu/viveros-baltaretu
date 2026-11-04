/**
 * Restricciones verificadas visualmente en Maderas Colomba, catálogo técnico 2026,
 * páginas 6 y 7. No contienen precios ni restricciones inferidas.
 */
const materiales = ['Melamina 16 mm', 'DM lacado'];
const acabados = ['Blanco mate', 'Negro', 'Roble natural', 'Ceniza'];
const apertura = ['Tirador metálico', 'Push-to-open'];

const baseCajonera = [
  { id:'ancho', nombre:'Ancho', tipo:'medida', unidad:'cm', min:40, max:100, paso:5, requerido:true },
  { id:'alto', nombre:'Alto', tipo:'medida', unidad:'cm', min:40, max:60, paso:5, requerido:true },
  { id:'cajones', nombre:'Número de cajones', tipo:'numero', min:1, max:8, paso:1, requerido:true },
  { id:'altura_cajon', nombre:'Altura de cajón', tipo:'numero', unidad:'cm', min:8, max:32, requerido:true },
  { id:'material', nombre:'Material', tipo:'opcion', opciones:materiales, requerido:true },
  { id:'acabado', nombre:'Acabado', tipo:'opcion', opciones:acabados, requerido:true },
  { id:'apertura', nombre:'Apertura', tipo:'opcion', opciones:apertura, requerido:true },
] as const;

export const MODELOS_CAJONERA_COLOMBA = [
  ['01','Barco',[10,16,20,32]], ['02','Postformado',[8,16,20,32]], ['03','Inox',[10,16,20,32]],
  ['04','Box',[8,16,20,32]], ['05','Capri',[16,20]], ['06','Atenas bandeja',[16,20]],
  ['07','Atenas tablex',[10,16,20,32]], ['08','Atenas tablex con cristal mate o transparente',[10,16,20,32]],
  ['09','Liso con tiradores',[8,16,20,32]], ['10','Solapado',[8,16,20,32]],
  ['11','Baldas extraíbles',[10,16,20,32]], ['12','Bandeja',null], ['13','Media luna',[10,16,20,32]],
  ['14','Góndola',[10,16,20,32]], ['15','Con tapa de cristal',null],
] as const;

const candidatoBase = (nombre:string,pagina:number) => ({
  categoria:'mobiliario', nombre, referencia:'', codigoDecor:'', acabado:'', soporte:'Mueble terminado', espesorMm:null,
  formato:'', unidad:'ud', colorHex:null, veta:null, brillo:null, unidadesPaquete:null, pagina,
  familia:nombre, codigoFamilia:'', subcategoria:'Cajoneras', tipoProducto:'configurable', coleccion:'', codigoVariante:'',
  tratamiento:'', calidad:'', formatoUnidad:'', unidadCompra:'ud', unidadConsumo:'ud', unidadPresupuesto:'ud',
  factorConversion:1, disponibilidad:'bajo-pedido', propiedades:{guias:'Telescópicas con cierre suave integrado',entrega:'Montado'},
  aplicaciones:[], confianza:1, revision:'verificado', evidencia:'Maderas Colomba 2026, página 6', metodo:'pdfjs',
});

export function candidatosConfigurablesColomba(texto:string,pagina:number): Array<Record<string,unknown>> {
  const normal=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (normal.includes('cajoneras') && normal.includes('fabricacion propia a medida')) return MODELOS_CAJONERA_COLOMBA.map(([codigo,nombre,alturas]) => ({
    ...candidatoBase(nombre,pagina), codigoFamilia:`CAJ-${codigo}`, codigoVariante:`CAJ-${codigo}`,
    configuracion:{parametros:[...baseCajonera],reglas:alturas ? [{parametro:'altura_cajon',operador:'in',valor:[...alturas],mensaje:`${nombre}: altura de cajón admitida ${alturas.join(', ')} cm.`}] : [],bajoProyecto:alturas===null},
  }));
  if (normal.includes('zapateros') && normal.includes('baldas extraibles')) {
    const comunes=[
      {id:'material',nombre:'Material',tipo:'opcion',opciones:materiales,requerido:true},
      {id:'acabado',nombre:'Acabado',tipo:'opcion',opciones:acabados,requerido:true},
    ];
    const modelos=[
      ['ZAP-CAJ','Zapatero con cajones',30,100,30,60],
      ['ZAP-BAL','Zapatero con baldas extraíbles',30,100,30,100],
      ['ZAP-ABA','Zapatero abatible',40,100,25,25],
    ] as const;
    const zapateros = modelos.map(([codigo,nombre,anchoMin,anchoMax,fondoMin,fondoMax])=>({
      ...candidatoBase(nombre,pagina),subcategoria:'Zapateros',familia:nombre,codigoFamilia:codigo,codigoVariante:codigo,
      propiedades:{entrega:'Montado',...(codigo==='ZAP-CAJ'?{guias:'Telescópicas con cierre suave integrado'}:codigo==='ZAP-BAL'?{baldas:'Regulables en altura, paso 32 mm'}:{apertura:'Abre hacia delante para acceso frontal'})},
      evidencia:'Maderas Colomba 2026, página 7',
      configuracion:{parametros:[
        {id:'ancho',nombre:'Ancho',tipo:'medida',unidad:'cm',min:anchoMin,max:anchoMax,paso:5,requerido:true},
        {id:'fondo',nombre:'Fondo',tipo:'medida',unidad:'cm',min:fondoMin,max:fondoMax,paso:fondoMin===fondoMax?undefined:5,requerido:true},
        ...comunes,
      ],reglas:[],bajoProyecto:false},
    }));
    const proyectos=['Armario empotrado','Vestidor abierto','Librería pared','Mueble TV','Cabecero a medida','Banco con almacenaje','Mesa abatible','Mostrador comercio','Mueble baño'];
    const bajoProyecto=proyectos.map((nombre,indice)=>({
      ...candidatoBase(nombre,pagina),subcategoria:'Muebles a medida',familia:nombre,codigoFamilia:`PROY-${String(indice+1).padStart(2,'0')}`,
      codigoVariante:'',tipoProducto:'a-medida',evidencia:'Maderas Colomba 2026, página 7. Fabricación bajo proyecto; no se infieren límites.',
      configuracion:{parametros:[
        {id:'ancho',nombre:'Ancho',tipo:'medida',unidad:'cm',requerido:false},
        {id:'alto',nombre:'Alto',tipo:'medida',unidad:'cm',requerido:false},
        {id:'fondo',nombre:'Fondo',tipo:'medida',unidad:'cm',requerido:false},
        {id:'fotos',nombre:'Fotos',tipo:'archivo',requerido:false},
        {id:'planos',nombre:'Planos',tipo:'archivo',requerido:false},
        {id:'notas',nombre:'Necesidades del proyecto',tipo:'texto',requerido:true},
      ],reglas:[],bajoProyecto:true},
    }));
    return [...zapateros,...bajoProyecto];
  }
  return [];
}
