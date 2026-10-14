/** Genera docs/panel-propio/guia-gerente.md a partir de la ayuda del panel (una sola fuente). */
import { writeFile } from 'node:fs/promises';
import { TEMAS } from '../src/server/panel/ayuda.ts';

const md = [
  '# Guía rápida del panel del vivero',
  '',
  'Una página para imprimir o guardar en el móvil. La misma ayuda está dentro del panel, en «Ayuda».',
  'Nada de lo que hagas en el panel puede romper la web: si algo está mal, el panel te lo dice antes de guardar, y todo se puede deshacer.',
  '',
  ...TEMAS.flatMap((t) => [`## ${t.titulo}`, ...t.pasos.map((p, i) => `${i + 1}. ${p}`), '']),
].join('\n');
await writeFile('docs/panel-propio/guia-gerente.md', md);
console.log('docs/panel-propio/guia-gerente.md');
