/**
 * Mide la precisión del asistente con el banco de frases y escribe
 * docs/panel-propio/precision-asistente.md.
 *   npm run asistente:banco                  → intérprete local (reglas)
 *   npm run asistente:banco -- --workers-ai  → Workers AI real (necesita CLOUDFLARE_ACCOUNT_ID y
 *                                              CLOUDFLARE_API_TOKEN con permiso "Workers AI: Read")
 * Usa una D1 local en memoria con el contenido del repositorio: no toca datos reales.
 */
import { writeFile } from 'node:fs/promises';
import frases from '../tests/asistente/frases.json' with { type: 'json' };
import control from '../tests/asistente/frases-control.json' with { type: 'json' };
import { medirBanco } from '../src/server/asistente/banco.ts';
import { crearInterpreteWorkersAI, interpreteLocal, MODELO_WORKERS_AI, type BindingAI } from '../src/server/asistente/interprete.ts';
import type { EntradaImportada } from '../src/server/contenido/importacion.ts';
import { importarContenido } from '../src/server/contenido/importacion.ts';
import { leerContenido } from './contenido/archivos.mjs';
import { reposLocales } from './contenido/plataforma.ts';

const conIA = process.argv.includes('--workers-ai');
let interprete = interpreteLocal;
if (conIA) {
  const cuenta = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!cuenta || !token) throw new Error('Faltan CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN');
  const rest: BindingAI = {
    async run(modelo, entrada) {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/ai/run/${modelo}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(entrada),
      });
      const j = (await r.json()) as { result?: unknown; errors?: unknown };
      if (!r.ok) throw new Error(JSON.stringify(j.errors));
      return j.result;
    },
  };
  interprete = crearInterpreteWorkersAI(rest);
}

const { repos, cerrar } = await reposLocales({ persistir: false });
try {
  const { entradas, fotos } = await leerContenido(process.cwd());
  for (const f of fotos) await repos.fotos.guardar({ ruta: f.ruta, tipo: 'image/jpeg', bytes: f.bytes }, 'banco');
  const lista = entradas.map((e) => ({ coleccion: e.coleccion, id: e.id, documento: { datos: e.datos, cuerpo: e.cuerpo } })) as EntradaImportada[];
  await importarContenido(repos, lista, new Set(fotos.map((f) => f.ruta)), 'banco');
  const a = await medirBanco(repos, [interprete], frases);
  const b = await medirBanco(repos, [interprete], control);
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const informe = [
    `# Precisión del asistente (${conIA ? `Workers AI, ${MODELO_WORKERS_AI}` : 'intérprete local por reglas'})`,
    '',
    `Medido el ${new Date().toISOString().slice(0, 10)} con \`npm run asistente:banco${conIA ? ' -- --workers-ai' : ''}\`.`,
    '',
    '| Banco | Aciertos | Precisión | Frases fuera de tema que acaban en un cambio |',
    '|---|---|---|---|',
    `| Frases de ajuste (\`tests/asistente/frases.json\`) | ${a.aciertos}/${a.total} | ${pct(a.precision)} | ${a.peligrosas.length} |`,
    `| Frases de control, no usadas para ajustar (\`frases-control.json\`) | ${b.aciertos}/${b.total} | ${pct(b.precision)} | ${b.peligrosas.length} |`,
    '',
    '## Fallos',
    ...[...a.fallos, ...b.fallos].map((f) => `- «${f.frase}»: esperado ${f.esperado}; obtenido ${f.obtenido}`),
    '',
  ].join('\n');
  const destino = `docs/panel-propio/precision-asistente${conIA ? '-workers-ai' : ''}.md`;
  await writeFile(destino, informe);
  console.log(informe);
  console.log(`→ ${destino}`);
} finally {
  await cerrar();
}
