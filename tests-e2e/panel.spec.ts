import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from './ayudas';

// El build de los e2e usa el entorno `desarrollo`: D1 local con el contenido importado
// y entrada al panel sin Access desde localhost como propietario@example.com.
const PANTALLAS = ['/panel', '/panel/personas', '/panel/plantas', '/panel/fotos', '/panel/textos', '/panel/ayuda', '/panel/presupuestos'];

test.describe('panel: accesibilidad y tamaño de los controles', () => {
  for (const ruta of PANTALLAS) {
    test(ruta, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.locator('h1')).toBeVisible();
      await auditar(page);
      await controlesGrandes(page);
    });
  }
});

test('inicio con las tarjetas principales', async ({ page }) => {
  await page.goto('/panel');
  for (const nombre of ['Mis plantas', 'Presupuestos recibidos', 'Fotos', 'Textos de la web', 'Ayuda']) {
    await expect(page.getByRole('link', { name: new RegExp(nombre) })).toBeVisible();
  }
});

test('el propietario da y quita acceso con el teclado', async ({ page }) => {
  await page.goto('/panel/personas');
  const email = `gerente-${test.info().project.name}@example.com`;
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Nombre', { exact: true }).fill('Gerente');
  await page.getByLabel('Nombre', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Dar acceso' }).press('Enter');
  await expect(page.getByRole('status')).toHaveText('Hecho.');
  const fila = page.getByRole('listitem').filter({ hasText: email });
  await fila.getByRole('button', { name: 'Quitar acceso' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: email })).toContainText('sin acceso');
});

test('las peticiones de otra web se rechazan', async ({ request }) => {
  const r = await request.post('/panel/personas', { headers: { Origin: 'https://malo.example.com' }, form: { accion: 'alta', email: 'x@example.com' } });
  expect(r.status()).toBe(403);
});
