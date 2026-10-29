import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Catálogo de la carpintería: catálogo de partida, precios, calculadora de un trabajo y paso a presupuesto.
test.describe.configure({ mode: 'serial' });

test('catálogo: partida, precios, calculadora que se recalcula y paso a un presupuesto nuevo', async ({ page }) => {
  await page.goto('/panel/catalogo');
  const cargar = page.getByRole('button', { name: 'Cargar el catálogo de partida' });
  if (await cargar.isVisible()) await cargar.click();
  await expect(page.getByRole('link', { name: /^Trabajos/ })).toBeVisible();
  await auditar(page);
  await controlesGrandes(page);

  // Precios: todos a 10 € (los que aún no tienen).
  await page.goto('/panel/catalogo/precios');
  const costes = page.locator('input[name^="coste."]');
  if ((await costes.count()) > 0) {
    await auditar(page);
    for (const c of await costes.all()) await c.fill('10');
    await page.getByRole('button', { name: 'Guardar los precios' }).click();
    await expect(page.getByRole('status')).toContainText('Precios guardados');
  }

  // Calculadora del armario de correderas: el precio cambia al cambiar el ancho.
  await page.goto('/panel/catalogo/plantillas/armario-correderas');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Armario empotrado de puertas correderas');
  const precio = page.locator('[data-resultado="resumen"] [data-precio]');
  // Nada se sale por los lados (en el móvil, los desplegables con nombres largos).
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const antes = await precio.textContent();
  expect(antes).toMatch(/€$/);
  await page.getByLabel('Ancho').fill('300');
  await expect(precio).not.toHaveText(antes!);
  await expect(page).toHaveURL(/m\.ancho=300/);
  await expect(page.getByRole('table', { name: /Escandallo/ })).toContainText('Kit de correderas');
  await auditar(page);
  await controlesGrandes(page);

  // A un presupuesto nuevo, en una línea con sus medidas.
  await page.getByRole('button', { name: 'Llevar al presupuesto' }).click();
  await expect(page).toHaveURL(/\/panel\/presupuestos-cliente\/nuevo/);
  await expect(page.locator('[name="l0.concepto"]')).toHaveValue(/^Armario empotrado de puertas correderas \(300 × 240 × 60 cm/);
  await expect(page.locator('[name="l0.precio"]')).not.toHaveValue('');
});

test('artículo nuevo: el precio de venta se ve mientras se escribe', async ({ page }) => {
  await page.goto('/panel/catalogo/articulos/nuevo');
  await page.getByLabel('Categoría').selectOption('herrajes');
  await expect(page.getByLabel('Unidad')).toHaveValue('ud');
  await page.getByLabel('Nombre').fill(`Bisagra de prueba ${test.info().project.name}`);
  await page.getByLabel(/^Coste por/).fill('10');
  await page.getByLabel(/^Margen/).fill('50');
  await expect(page.locator('[data-precio]')).toHaveText(/^15,00\s€$/);
  await auditar(page);
  await controlesGrandes(page);
  await page.getByRole('button', { name: 'Guardar el artículo' }).click();
  await expect(page).toHaveURL(/ver=articulos&categoria=herrajes/);
  await expect(page.getByRole('link', { name: `Bisagra de prueba ${test.info().project.name}` })).toBeVisible();
});

test('editar un trabajo: duplicar, una fórmula mal escrita se explica, guardar, probar y archivar', async ({ page }) => {
  await page.goto('/panel/catalogo/plantillas/armario-correderas/editar');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editar «Armario empotrado de puertas correderas»');
  await page.getByRole('button', { name: 'Duplicar para hacer otro parecido' }).click();
  await expect(page).toHaveURL(/\/panel\/catalogo\/plantillas\/[a-z0-9-]+\/editar$/);
  const nombre = `Armario de prueba ${test.info().project.name}`;
  await page.getByLabel('Nombre', { exact: true }).fill(nombre);
  await page.getByLabel('Cantidad de la parte 9 (fórmula)').fill('puertas * profundo');
  await page.getByRole('button', { name: 'Guardar y probar' }).click();
  await expect(page.getByRole('alert')).toContainText('No hay ninguna medida que se llame «profundo»');
  await auditar(page);
  await page.getByLabel('Cantidad de la parte 9 (fórmula)').fill('puertas * 2');
  await page.getByRole('button', { name: 'Guardar y probar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nombre);
  await expect(page.getByRole('status')).toContainText('Trabajo guardado');
  await page.getByRole('link', { name: 'Editar el trabajo' }).click();
  await page.getByRole('button', { name: 'Archivar este trabajo' }).click();
  await expect(page).toHaveURL(/\/panel\/catalogo$/);
  await expect(page.getByText(nombre)).toHaveCount(0);
});
