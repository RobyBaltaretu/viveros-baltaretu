import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Presupuestos y facturas enganchados al catálogo: artículos y trabajos a un clic, y líneas a mano.
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  // Catálogo de partida con precios (si aún no los tiene) para poder añadir.
  const page = await browser.newPage();
  await page.goto('http://localhost:4339/panel/catalogo');
  const cargar = page.getByRole('button', { name: 'Cargar el catálogo de partida' });
  if (await cargar.isVisible()) await cargar.click();
  await page.goto('http://localhost:4339/panel/catalogo/precios');
  const costes = page.locator('input[name^="coste."]');
  if ((await costes.count()) > 0) {
    for (const c of await costes.all()) await c.fill('10');
    await page.getByRole('button', { name: 'Guardar los precios' }).click();
  }
  await page.close();
});

test('presupuesto: un artículo y un trabajo del catálogo, y una línea a mano', async ({ page }) => {
  await page.goto('/panel/presupuestos-cliente/nuevo');
  await page.getByRole('button', { name: 'Añadir del catálogo' }).click();
  const d = page.getByRole('dialog', { name: 'Añadir del catálogo' });
  await expect(d).toBeVisible();
  await auditar(page);
  await d.getByRole('tab', { name: /Artículos/ }).click();
  await d.getByRole('searchbox').fill('hora de taller');
  await d.getByRole('button', { name: /^Añadir Hora de taller, / }).click();
  await expect(d.getByRole('status')).toContainText('Hora de taller añadido');
  await d.getByRole('searchbox').fill('');
  await d.getByRole('tab', { name: /Trabajos/ }).click();
  await d.getByRole('button', { name: /^Puerta de paso(?! \(prueba\))/ }).click();
  await expect(d.getByRole('heading', { name: 'Puerta de paso' })).toBeVisible();
  await d.getByLabel('Puertas').fill('3');
  await expect(d.getByRole('button', { name: 'Añadir al presupuesto' })).toBeEnabled();
  await d.getByRole('button', { name: 'Añadir al presupuesto' }).click();
  await expect(d).toBeHidden();
  await expect(page.getByLabel('Concepto de la línea 1')).toHaveValue('Hora de taller');
  await expect(page.getByLabel('Precio por unidad de la línea 1, en euros sin IVA')).toHaveValue('13');
  await expect(page.getByLabel('Concepto de la línea 2')).toHaveValue(/^Puerta de paso \(82 × 203 cm, 3 puertas\)$/);
  // Y a mano, en la siguiente fila libre.
  await page.getByLabel('Concepto de la línea 3').fill('Ajuste en obra');
  await page.getByLabel('Precio por unidad de la línea 3, en euros sin IVA').fill('50');
  await expect(page.locator('[data-total]')).not.toHaveText('0,00 €');
  await controlesGrandes(page);
});

test('factura: editor nuevo con el catálogo, IVA fijo y total al escribir', async ({ page }) => {
  const p = `${test.info().project.name} ${Date.now()}`;
  await page.goto('/panel/facturas/clientes/nuevo');
  await page.getByLabel('Razón social o nombre completo').fill(`Cliente factura ${p}`);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.goto('/panel/facturas/nueva');
  await page.getByRole('button', { name: new RegExp(`^Cliente factura ${p}`) }).click();
  await expect(page).toHaveURL(/\/panel\/facturas\/[^/]+$/);
  await expect(page.locator('input[name="l0.iva"]')).toHaveValue('21');
  await page.getByLabel('Concepto de la línea 1').fill('Montaje en obra');
  await page.getByLabel('Precio de la línea 1, en euros sin IVA').fill('100');
  await expect(page.locator('[data-total]')).toHaveText(/^121,00/);
  await page.getByRole('button', { name: 'Añadir del catálogo' }).click();
  const d = page.getByRole('dialog', { name: 'Añadir del catálogo' });
  await d.getByRole('tab', { name: /Artículos/ }).click();
  await d.getByRole('searchbox').fill('transporte');
  await d.getByRole('button', { name: /^Añadir Transporte y descarga, / }).click();
  await d.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByLabel('Concepto de la línea 2')).toHaveValue('Transporte y descarga');
  await expect(page.locator('[data-total]')).toHaveText(/^136,73/);
  await page.getByRole('button', { name: 'Añadir una línea' }).click();
  await page.getByRole('button', { name: 'Quitar la línea 3' }).click();
  await auditar(page);
  await controlesGrandes(page);
  await page.getByRole('button', { name: 'Guardar el borrador' }).click();
  await expect(page.getByRole('status').first()).toContainText('Borrador guardado');
  await expect(page.getByLabel('Concepto de la línea 2')).toHaveValue('Transporte y descarga');
  await expect(page.locator('[data-total]')).toHaveText(/^136,73/);
});
