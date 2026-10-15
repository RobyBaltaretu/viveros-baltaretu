/**
 * Texto del asistente → HTML seguro: se escapa todo y solo se admiten negrita
 * (**así**), listas con «- » y saltos de línea. Nada de enlaces ni HTML del modelo.
 */
const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enLinea = (t: string) => escapar(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

export function textoSeguro(texto: string): string {
  const bloques: string[] = [];
  let lista: string[] = [];
  const cerrar = () => {
    if (lista.length) bloques.push(`<ul>${lista.map((l) => `<li>${l}</li>`).join('')}</ul>`);
    lista = [];
  };
  for (const linea of texto.replace(/\r/g, '').split('\n')) {
    const item = linea.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) lista.push(enLinea(item[1]));
    else {
      cerrar();
      if (linea.trim()) bloques.push(`<p>${enLinea(linea.trim())}</p>`);
    }
  }
  cerrar();
  return bloques.join('');
}

export const SUGERENCIAS = [
  '¿Qué tengo pendiente hoy?',
  '¿Cuánto hemos facturado este mes?',
  '¿Qué presupuestos están sin responder?',
  'Sube un 5 % el precio de todas las palmeras',
  'Marca como cobradas las facturas vencidas de un cliente',
  'Archiva los presupuestos de hace más de 3 meses',
  'Hazle una factura a un cliente',
  '¿En qué hemos gastado más este trimestre?',
];
