// Arranca `astro dev` en Node, sin el adaptador de Cloudflare, para editar el
// contenido con el modo local de Keystatic (no funciona en el runtime workerd).
import { spawn } from 'node:child_process';

const proceso = spawn('npx', ['astro', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, KEYSTATIC_LOCAL: '1', PUBLIC_KEYSTATIC_CLOUD_PROJECT: '' },
});
proceso.on('exit', (codigo) => process.exit(codigo ?? 0));
