import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Presupuestos y facturas enganchados al catálogo: buscando en la línea o en la ventana, y líneas a mano.
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

test('presupuesto: materiales y un trabajo desde la ventana del catálogo, y una línea a mano', async ({ page }) => {
  await page.goto('/panel/presupuestos-cliente/nuevo');
  await page.getByRole('button', { name: 'Añadir del catálogo' }).click();
  const d = page.getByRole('dialog', { name: 'Añadir del catálogo' });
  await expect(d).toBeVisible();
  await auditar(page);
  // Todo en una lista, con filtros por categoría; dos toques suman dos.
  await d.getByRole('button', { name: /^Mano de obra/ }).click();
  await expect(d.getByRole('button', { name: /^Mano de obra/ })).toHaveAttribute('aria-pressed', 'true');
  await d.getByRole('searchbox').fill('hora de taller');
  await d.getByRole('button', { name: /^Añadir Hora de taller, / }).click();
  await expect(d.getByRole('status')).toContainText('Hora de taller añadido');
  await d.getByRole('button', { name: /^Añadir Hora de taller, / }).click();
  await expect(d.getByRole('status')).toContainText('van 2');
  await d.getByRole('searchbox').fill('');
  await d.getByRole('button', { name: 'Todo', exact: true }).click();
  await d.getByRole('button', { name: /^Puerta de paso: poner medidas/ }).click();
  await expect(d.getByRole('heading', { name: 'Puerta de paso' })).toBeVisible();
  await d.getByRole('textbox', { name: 'Puertas', exact: true }).fill('3');
  await expect(d.getByRole('button', { name: 'Añadir al presupuesto' })).toBeEnabled();
  // Lo que lleva el trabajo, con sus cantidades (sin costes).
  await d.getByText('Qué lleva').click();
  await expect(d.locator('[data-lleva-lista] li').first()).toBeVisible();
  await auditar(page);
  await d.getByRole('button', { name: 'Añadir al presupuesto' }).click();
  await expect(d).toBeHidden();
  await expect(page.getByLabel('Concepto de la línea 1')).toHaveValue('Hora de taller');
  await expect(page.getByLabel('Cantidad de la línea 1')).toHaveValue('2');
  await expect(page.getByLabel('Precio por unidad de la línea 1, en euros sin IVA')).toHaveValue('13');
  await expect(page.getByLabel('Concepto de la línea 2')).toHaveValue(/^Puerta de paso \(82 × 203 cm, 3 puertas\)$/);
  // Y a mano, en la siguiente fila libre.
  await page.getByLabel('Concepto de la línea 3').fill('Ajuste en obra');
  await page.getByLabel('Precio por unidad de la línea 3, en euros sin IVA').fill('50');
  await expect(page.locator('[data-total]')).not.toHaveText('0,00 €');
  await controlesGrandes(page);
});

test('presupuesto: buscar en la propia línea, materiales sin precio y un trabajo material a material', async ({ page }) => {
  const nombre = `Tirador sin precio ${test.info().project.name}`;
  await page.goto('/panel/catalogo/articulos/nuevo');
  await page.getByLabel('Categoría').selectOption('herrajes');
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByLabel(/^Coste por/).fill('0');
  await page.getByRole('button', { name: 'Guardar el artículo' }).click();
  await expect(page).toHaveURL(/ver=articulos/);

  await page.goto('/panel/presupuestos-cliente/nuevo');
  const concepto = page.getByLabel('Concepto de la línea 1');
  await concepto.fill('bisagra');
  const sug = page.getByRole('listbox', { name: 'Del catálogo' });
  await expect(sug).toBeVisible();
  await expect(concepto).toHaveAttribute('aria-expanded', 'true');
  await auditar(page);
  // Con el teclado: flecha abajo e Intro rellenan la línea y llevan a la cantidad.
  await concepto.press('ArrowDown');
  await expect(sug.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await concepto.press('Enter');
  await expect(sug).toBeHidden();
  await expect(concepto).toHaveValue(/bisagra/i);
  await expect(page.getByLabel('Cantidad de la línea 1')).toBeFocused();
  await expect(page.getByLabel('Precio por unidad de la línea 1, en euros sin IVA')).not.toHaveValue('');

  // Un material sin precio también sale: el precio queda en blanco para escribirlo.
  const concepto2 = page.getByLabel('Concepto de la línea 2');
  await concepto2.fill(nombre.slice(0, 18));
  await sug.getByRole('option', { name: new RegExp(nombre) }).click();
  await expect(concepto2).toHaveValue(nombre);
  await expect(page.getByLabel('Precio por unidad de la línea 2, en euros sin IVA')).toBeFocused();
  await expect(page.getByLabel('Precio por unidad de la línea 2, en euros sin IVA')).toHaveValue('');

  // Un trabajo desde la línea: medidas en la ventana y material a material.
  await page.getByRole('button', { name: 'Añadir una línea' }).click();
  const concepto3 = page.getByLabel('Concepto de la línea 3');
  await concepto3.fill('puerta de paso');
  await sug.getByRole('option', { name: /^Puerta de paso(?! \(prueba\))/ }).first().click();
  const d = page.getByRole('dialog', { name: 'Añadir del catálogo' });
  await expect(d.getByRole('heading', { name: 'Puerta de paso' })).toBeVisible();
  await d.getByLabel('Material a material, con sus cantidades').check();
  await expect(d.getByRole('button', { name: 'Añadir al presupuesto' })).toBeEnabled();
  await d.getByRole('button', { name: 'Añadir al presupuesto' }).click();
  await expect(d).toBeHidden();
  await expect(concepto3).not.toHaveValue('puerta de paso');
  await expect(page.getByLabel('Concepto de la línea 4')).not.toHaveValue('');
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
  await d.getByRole('searchbox').fill('transporte');
  await d.getByRole('button', { name: /^Añadir Transporte y descarga, / }).click();
  await d.getByRole('button', { name: 'Listo' }).click();
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
  // La lista nueva: cifras de cobro, pestañas con su número y búsqueda.
  await page.goto(`/panel/facturas?estado=borrador&q=${encodeURIComponent(p)}`);
  for (const k of ['Por cobrar', 'Vencido', 'Cobrado este mes', 'Borradores']) await expect(page.locator('.nv-kpis').getByText(k, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Cliente factura ${p}` })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`Cliente factura ${p}.*Borrador.*136,73`) })).toBeVisible();
  await auditar(page);
  await controlesGrandes(page);
});
