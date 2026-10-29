import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Creaciones Turia: sin web pública, panel con su vocabulario y su portafolio privado.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

test('sin web pública: la portada lleva al panel y no hay nada del vivero', async ({ page, request }) => {
  expect((await request.get('/robots.txt')).ok()).toBe(true);
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /');
  expect((await request.get('/catalogo/')).status()).toBe(404);
  expect((await request.get('/panel/plantas')).status()).toBe(404);
  expect((await request.get('/panel/textos')).status()).toBe(404);
  await page.goto('/');
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page).toHaveTitle(/Panel de la carpintería/);
  // En el móvil el nombre va en el menú lateral (oculto) y arriba solo salen las iniciales.
  expect(await page.getByText('Creaciones Turia').count()).toBeGreaterThan(0);
  await expect(page.locator('body')).not.toContainText(/Baltaretu|AgricolAI|vivero/i);
  await auditar(page);
  await controlesGrandes(page);
});

for (const ruta of ['/panel/portafolio', '/panel/portafolio/nuevo']) {
  test(`accesibilidad: ${ruta}`, async ({ page }) => {
    await page.goto(ruta);
    await auditar(page);
    await controlesGrandes(page);
  });
}

test('portafolio: alta, fotos de antes y después, comparador con teclado y quitar una foto', async ({ page }) => {
  const titulo = `Armario ${test.info().project.name}`;
  await page.goto('/panel/portafolio');
  await page.getByRole('link', { name: 'Añadir un proyecto' }).click();
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Tipo de trabajo').fill('Armarios');
  await page.getByLabel('Año').fill('2025');
  await page.getByRole('button', { name: 'Guardar y añadir fotos' }).click();
  await expect(page.getByRole('status').first()).toContainText('Ahora añade las fotos');

  await page.getByLabel('Añadir una foto de antes').setInputFiles({ name: 'antes.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.getByRole('button', { name: 'Subir la foto' }).first().click();
  await expect(page.getByRole('status').first()).toContainText('Foto de antes añadida');
  await page.getByLabel('Añadir una foto de después').setInputFiles({ name: 'despues.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.getByRole('button', { name: 'Subir la foto' }).last().click();
  await expect(page.getByRole('status').first()).toContainText('Foto de después añadida');
  await auditar(page);
  await controlesGrandes(page);

  await page.getByRole('link', { name: 'Ver el proyecto' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);
  const control = page.getByLabel('Desliza para comparar el antes y el después');
  await control.focus();
  await page.keyboard.press('ArrowRight');
  await expect(control).toHaveValue('51');
  await expect(control).toHaveAttribute('aria-valuetext', '51 % después');
  await page.keyboard.press('End');
  await expect(control).toHaveAttribute('aria-valuetext', 'Todo después');
  expect(await page.locator('figure.comparador').evaluate((f) => (f as HTMLElement).style.getPropertyValue('--corte'))).toBe('100%');
  await auditar(page);
  await controlesGrandes(page);

  await page.getByRole('link', { name: 'Fotos de antes y después' }).click();
  await page.getByRole('button', { name: 'Quitar la foto 1 de antes' }).click();
  await expect(page.getByRole('status').first()).toContainText('Foto quitada');
  await expect(page.getByRole('heading', { name: /Antes de la reforma/ })).toContainText('0 de 8');
});

test('datos de prueba: tres proyectos de ejemplo con su antes y después y filtro por tipo', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'Los datos de prueba se cargan una vez (son comunes).');
  await page.goto('/panel/pruebas');
  await page.getByRole('button', { name: /[Cc]argar.*datos de prueba/ }).click();
  await page.goto('/panel/portafolio');
  await expect(page.getByRole('link', { name: /Armario empotrado \(prueba\)/ })).toBeVisible();
  await page.getByRole('link', { name: 'Cocinas', exact: true }).click();
  await expect(page.getByRole('link', { name: /Frentes de cocina \(prueba\)/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Armario empotrado \(prueba\)/ })).toHaveCount(0);
  await auditar(page);
  await page.getByRole('link', { name: /Frentes de cocina \(prueba\)/ }).click();
  await expect(page.getByLabel('Desliza para comparar el antes y el después')).toBeVisible();
  await auditar(page);
});
