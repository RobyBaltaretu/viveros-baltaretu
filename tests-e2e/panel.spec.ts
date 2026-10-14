import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from './ayudas';

// El build de los e2e usa el entorno `desarrollo`: D1 local con el contenido importado
// y entrada al panel sin Access desde localhost como propietario@example.com.
const PANTALLAS = ['/panel', '/panel/personas', '/panel/plantas', '/panel/plantas/nueva', '/panel/plantas/washingtonia-robusta', '/panel/plantas/washingtonia-robusta/precio', '/panel/plantas/washingtonia-robusta/disponibilidad', '/panel/plantas/washingtonia-robusta/datos', '/panel/plantas/washingtonia-robusta/archivar', '/panel/plantas/phoenix-canariensis/fotos', '/panel/fotos', '/panel/textos', '/panel/ayuda', '/panel/presupuestos'];

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

test('alta guiada de una planta, paso a paso', async ({ page }) => {
  const nombre = `Olivo prueba ${test.info().project.name}`;
  await page.goto('/panel/plantas/nueva');
  await page.getByLabel('Nombre en la web').fill(nombre);
  await page.getByLabel('Nombre científico').fill('Olea europaea');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Olivos').check();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel(/Altura más baja/).fill('1,5');
  await page.getByLabel(/Altura más alta/).fill('5');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('alert')).toContainText('hasta 4 m');
  await page.getByLabel(/Altura más alta/).fill('3');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel(/Precio al por mayor/).fill('25');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Disponible', { exact: true }).check();
  await page.getByLabel('Contenedor').check();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Descripción', { exact: true }).fill('Olivo joven en contenedor.');
  await page.getByLabel('Nombre en inglés').fill('Olive tree');
  await page.getByLabel('Descripción en inglés').fill('Young olive tree in a container.');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Origen de la planta').fill('Valencia');
  await auditar(page);
  await page.getByRole('button', { name: 'Guardar la planta' }).click();
  // Tras el alta, el panel lleva a añadir fotos.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Fotos de ${nombre}`);
  await expect(page.getByRole('status').first()).toContainText('Ahora añade una foto');
  await page.getByLabel('Añadir una foto').setInputFiles('src/assets/catalogo/phoenix-canariensis/foto-prueba-1.jpg');
  await page.getByRole('button', { name: 'Subir la foto' }).click();
  await expect(page.getByRole('status').first()).toContainText('Foto subida');
  await expect(page.getByRole('img', { name: `${nombre} en el vivero` })).toBeVisible();
  await expect.poll(() => page.getByRole('img').first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  await page.getByLabel('Qué se ve en la foto').fill('Olivo joven en maceta');
  await page.getByRole('button', { name: 'Guardar el texto' }).click();
  await expect(page.getByRole('img', { name: 'Olivo joven en maceta' })).toBeVisible();
  await auditar(page);
  await page.getByRole('link', { name: '← Volver' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nombre);
  await expect(page.getByText('Falta marcarla como revisada')).toBeVisible();

  await page.getByRole('link', { name: 'Cambiar el precio' }).click();
  await page.getByLabel(/Precio de una planta suelta/).fill('40');
  await page.getByRole('button', { name: 'Guardar el precio' }).click();
  await expect(page.getByRole('alert')).toContainText('solo se usa si la planta también se vende por unidad');
  await page.getByLabel('También se vende por unidad, con envío').check();
  await page.getByRole('button', { name: 'Guardar el precio' }).click();
  await expect(page.getByText('sí, desde 40 €')).toBeVisible();

  await page.getByRole('link', { name: 'Quitar de la web (archivar)' }).click();
  await page.getByRole('button', { name: 'Sí, quitarla' }).click();
  await expect(page.getByRole('status')).toContainText('Planta quitada');
  await expect(page.getByRole('link', { name: new RegExp(nombre) })).toHaveCount(0);
});
