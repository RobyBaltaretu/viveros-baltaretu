import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Factura } from '../data/tipos.ts';
import { dinero, importeLinea } from './importes.ts';

/**
 * PDF de una factura (A4), con las letras estándar de PDF para no cargar
 * fuentes. Colores de la marca: oliva para títulos y líneas, tinta para el texto.
 */
const OLIVA = rgb(0x2f / 255, 0x4a / 255, 0x2c / 255);
const TINTA = rgb(0x1f / 255, 0x2a / 255, 0x1c / 255);
const GRIS = rgb(0x5a / 255, 0x63 / 255, 0x4f / 255);
const VERDOR = rgb(0xe9 / 255, 0xee / 255, 0xdc / 255);
const LINEA = rgb(0xdc / 255, 0xd4 / 255, 0xc2 / 255);

const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 48;

const fechaEs = (iso: string) => iso.split('-').reverse().join('/');
const numeroEs = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3, useGrouping: 'always' }).format(n);

/** Las letras estándar solo tienen WinAnsi: se cambia lo que no se puede dibujar. */
const limpio = (t: string) =>
  t
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s/g, ' ')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u20AC]/g, '?');

function partir(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of limpio(texto).split(/\n/)) {
    let actual = '';
    for (const palabra of parrafo.split(' ')) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(prueba, tamano) <= ancho) actual = prueba;
      else {
        if (actual) lineas.push(actual);
        actual = palabra;
        while (fuente.widthOfTextAtSize(actual, tamano) > ancho && actual.length > 1) {
          let corte = actual.length - 1;
          while (corte > 1 && fuente.widthOfTextAtSize(actual.slice(0, corte), tamano) > ancho) corte--;
          lineas.push(actual.slice(0, corte));
          actual = actual.slice(corte);
        }
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

export async function pdfFactura(f: Factura): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const emisor = f.emisor;
  const titulo = f.tipo === 'rectificativa' ? 'Factura rectificativa' : 'Factura';
  doc.setTitle(`${titulo} ${f.codigo ?? 'borrador'}`);
  doc.setAuthor(emisor?.nombre ?? '');
  doc.setCreator('Panel del vivero');
  doc.setLanguage('es-ES');

  let pagina: PDFPage = doc.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const texto = (t: string, x: number, yy: number, o: { fuente?: PDFFont; tamano?: number; color?: typeof TINTA; derecha?: boolean } = {}) => {
    const fuente = o.fuente ?? normal;
    const tamano = o.tamano ?? 9.5;
    const s = limpio(t);
    const xx = o.derecha ? x - fuente.widthOfTextAtSize(s, tamano) : x;
    pagina.drawText(s, { x: xx, y: yy, size: tamano, font: fuente, color: o.color ?? TINTA });
  };
  const bloque = (lineas: string[], x: number, yy: number, ancho: number, tamano = 9.5) => {
    let alto = yy;
    for (const l of lineas.filter(Boolean))
      for (const p of partir(l, normal, tamano, ancho)) {
        texto(p, x, alto, { tamano });
        alto -= tamano + 3.5;
      }
    return alto;
  };

  // Cabecera: emisor a la izquierda, título y número a la derecha.
  texto(emisor?.nombre ?? '', MARGEN, y, { fuente: negrita, tamano: 16, color: OLIVA });
  texto(titulo.toUpperCase(), ANCHO - MARGEN, y, { fuente: negrita, tamano: 16, color: OLIVA, derecha: true });
  y -= 18;
  const yEmisor = bloque(
    [
      emisor ? `NIF ${emisor.nif}` : '',
      emisor?.direccion ?? '',
      emisor ? `${emisor.codigoPostal} ${emisor.poblacion} (${emisor.provincia})` : '',
      [emisor?.telefono, emisor?.email].filter(Boolean).join(' · '),
    ],
    MARGEN,
    y,
    260,
  );
  const datos: [string, string][] = [
    ['Número', f.codigo ?? 'BORRADOR (sin validez)'],
    ['Fecha', fechaEs(f.fecha)],
    ...(f.estado !== 'borrador' || f.vencimiento ? ([['Vencimiento', fechaEs(f.vencimiento)]] as [string, string][]) : []),
    ...(f.rectificaCodigo ? ([['Rectifica a', f.rectificaCodigo]] as [string, string][]) : []),
  ];
  let yDatos = y;
  for (const [k, v] of datos) {
    texto(k, ANCHO - MARGEN - 150, yDatos, { color: GRIS });
    texto(v, ANCHO - MARGEN, yDatos, { fuente: negrita, derecha: true });
    yDatos -= 13;
  }
  y = Math.min(yEmisor, yDatos) - 14;

  // Cliente.
  const c = f.cliente;
  const altoCliente = 74;
  pagina.drawRectangle({ x: MARGEN, y: y - altoCliente, width: ANCHO - 2 * MARGEN, height: altoCliente, color: VERDOR });
  texto('CLIENTE', MARGEN + 12, y - 16, { fuente: negrita, tamano: 8, color: OLIVA });
  texto(c.nombre, MARGEN + 12, y - 30, { fuente: negrita, tamano: 11 });
  bloque([`NIF ${c.nif}`, c.direccion, `${c.codigoPostal} ${c.poblacion}${c.provincia ? ` (${c.provincia})` : ''}${c.pais && !/^españa$/i.test(c.pais) ? ` · ${c.pais}` : ''}`], MARGEN + 12, y - 44, ANCHO - 2 * MARGEN - 24);
  y -= altoCliente + 22;

  // Tabla de líneas.
  const columnas = [
    { titulo: 'Concepto', x: MARGEN, ancho: 215, derecha: false },
    { titulo: 'Cant.', x: MARGEN + 262, ancho: 0, derecha: true },
    { titulo: 'Precio', x: MARGEN + 330, ancho: 0, derecha: true },
    { titulo: 'Dto.', x: MARGEN + 368, ancho: 0, derecha: true },
    { titulo: 'IVA', x: MARGEN + 403, ancho: 0, derecha: true },
    { titulo: 'Importe', x: ANCHO - MARGEN, ancho: 0, derecha: true },
  ];
  const cabeceraTabla = () => {
    for (const col of columnas) texto(col.titulo, col.x, y, { fuente: negrita, tamano: 8.5, color: OLIVA, derecha: col.derecha });
    y -= 6;
    pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 1, color: OLIVA });
    y -= 14;
  };
  const nuevaPagina = () => {
    pagina = doc.addPage([ANCHO, ALTO]);
    y = ALTO - MARGEN;
    texto(`${titulo} ${f.codigo ?? 'borrador'} (continuación)`, MARGEN, y, { color: GRIS });
    y -= 24;
    cabeceraTabla();
  };
  cabeceraTabla();
  for (const l of f.lineas.filter((x) => x.concepto)) {
    const conceptos = partir(l.concepto, normal, 9.5, columnas[0].ancho);
    if (y - conceptos.length * 13 < MARGEN + 40) nuevaPagina();
    texto(numeroEs(l.cantidad), columnas[1].x, y, { derecha: true });
    texto(dinero(l.precio), columnas[2].x, y, { derecha: true });
    texto(l.descuento ? `${numeroEs(l.descuento)} %` : '', columnas[3].x, y, { derecha: true });
    texto(`${l.iva} %`, columnas[4].x, y, { derecha: true });
    texto(dinero(importeLinea(l)), columnas[5].x, y, { derecha: true });
    for (const p of conceptos) {
      texto(p, MARGEN, y);
      y -= 13;
    }
    pagina.drawLine({ start: { x: MARGEN, y: y + 6 }, end: { x: ANCHO - MARGEN, y: y + 6 }, thickness: 0.5, color: LINEA });
    y -= 8;
  }

  // Totales y desglose de IVA.
  const t = f.totales;
  const filas: [string, string][] = [];
  for (const d of t.desglose) {
    filas.push([`Base imponible al ${d.iva} %`, dinero(d.base)]);
    filas.push([`IVA ${d.iva} %`, dinero(d.cuota)]);
    if (d.recargo) filas.push([`Recargo de equivalencia ${numeroEs(d.recargo)} %`, dinero(d.cuotaRecargo)]);
  }
  if (y - (filas.length + 3) * 14 < MARGEN + 60) nuevaPagina();
  y -= 8;
  const xEtiqueta = ANCHO - MARGEN - 230;
  for (const [k, v] of filas) {
    texto(k, xEtiqueta, y, { color: GRIS });
    texto(v, ANCHO - MARGEN, y, { derecha: true });
    y -= 14;
  }
  y -= 8;
  pagina.drawRectangle({ x: xEtiqueta - 10, y: y - 10, width: ANCHO - MARGEN - xEtiqueta + 10, height: 26, color: OLIVA });
  texto('TOTAL', xEtiqueta, y - 1, { fuente: negrita, tamano: 11, color: rgb(1, 1, 1) });
  texto(dinero(t.total), ANCHO - MARGEN - 8, y - 1, { fuente: negrita, tamano: 12, color: rgb(1, 1, 1), derecha: true });
  y -= 40;

  // Pago, menciones y notas.
  const notas = [
    f.formaPago ? `Forma de pago: ${f.formaPago}${f.formaPago === 'Transferencia bancaria' && emisor?.iban ? `. IBAN ${emisor.iban.replace(/(.{4})/g, '$1 ').trim()}` : ''}.` : '',
    f.exencion ? `Operación sin IVA: ${f.exencion}` : '',
    f.tipo === 'rectificativa' && f.motivoRectificacion ? `Motivo de la rectificación: ${f.motivoRectificacion}` : '',
    f.notas,
  ].filter(Boolean);
  for (const n of notas) {
    const partes = partir(n, normal, 9, ANCHO - 2 * MARGEN);
    if (y - partes.length * 12 < MARGEN + 20) nuevaPagina();
    for (const p of partes) {
      texto(p, MARGEN, y, { tamano: 9 });
      y -= 12;
    }
    y -= 4;
  }

  // Pie en todas las páginas: datos legales y número de página.
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    pagina = p;
    if (emisor?.pie) bloque([emisor.pie], MARGEN, MARGEN - 10, ANCHO - 2 * MARGEN - 80, 7.5);
    texto(`Página ${i + 1} de ${paginas.length}`, ANCHO - MARGEN, MARGEN - 10, { tamano: 7.5, color: GRIS, derecha: true });
    const deprueba = f.prueba || f.serie?.startsWith('PRUEBA-');
    if (f.estado === 'borrador' || deprueba) {
      const marca = deprueba ? 'PRUEBA · SIN VALIDEZ' : 'BORRADOR · SIN VALIDEZ';
      texto(marca, (ANCHO - negrita.widthOfTextAtSize(marca, 36)) / 2, ALTO / 2, { fuente: negrita, tamano: 36, color: LINEA });
    }
  });
  return doc.save();
}
