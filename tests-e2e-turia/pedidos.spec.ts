import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Pedidos de material a proveedor: del catálogo (lo del proveedor primero) y de un trabajo con sus medidas,
// mensaje y PDF sin precios, enviado → recibido y apuntado como gasto.
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  // Catálogo de partida con costes, para tener material que pedir.
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

test('pedido: de un trabajo del catálogo, del catálogo y a mano; enviar sin precios, recibir y apuntar el gasto', async ({ page }) => {
  test.setTimeout(90_000);
  const p = `${test.info().project.name} ${Date.now()}`;
  // Un proveedor que sirve herrajes, con un artículo del catálogo a su nombre.
  await page.goto('/panel/proveedores/nuevo');
  await page.getByLabel('Nombre', { exact: true }).fill(`Herrajes ${p}`);
  await page.getByLabel(/^Persona de contacto/).fill('Ana');
  await page.getByLabel('Teléfono').fill('600000088');
  await page.getByRole('button', { name: 'Guardar el proveedor' }).click();
  await page.goto('/panel/catalogo/articulos/nuevo');
  await page.getByLabel('Categoría').selectOption('herrajes');
  await page.getByLabel('Nombre').fill(`Pomo ${p}`);
  await page.getByLabel(/^Coste por/).fill('3,5');
  await page.getByLabel('Proveedor', { exact: true }).fill(`Herrajes ${p}`);
  await page.getByLabel('Referencia del proveedor').fill('POMO-1');
  await page.getByRole('button', { name: 'Guardar el artículo' }).click();

  // Desde la calculadora de un trabajo: «Pedir el material» trae sus materiales con las medidas.
  await page.goto('/panel/catalogo/plantillas/puerta-paso?m.puertas=2');
  await page.getByRole('link', { name: 'Pedir el material' }).click();
  await expect(page.getByRole('heading', { name: 'Pedido nuevo' })).toBeVisible();
  await expect(page.getByLabel('Qué pides en la línea 1')).not.toHaveValue('');
  await expect(page.getByLabel('Qué pides en la línea 1')).not.toHaveValue(/hora|montaje|transporte/i);
  await auditar(page);
  await controlesGrandes(page);

  // Proveedor: el nuestro; del catálogo sale primero lo suyo.
  await page.getByRole('combobox', { name: 'Proveedor', exact: true }).selectOption({ label: `Herrajes ${p}` });
  await page.getByRole('button', { name: 'Añadir del catálogo' }).click();
  const d = page.getByRole('dialog', { name: 'Añadir del catálogo' });
  await expect(d.locator('.nv-lista-grupo').first()).toHaveText(`De Herrajes ${p}`);
  await d.getByRole('button', { name: new RegExp(`^Añadir Pomo ${p}, 3,50`) }).click();
  await d.getByRole('button', { name: new RegExp(`^Añadir Pomo ${p}, `) }).click();
  await expect(d.getByRole('status')).toContainText('van 2');
  await auditar(page);
  await d.getByRole('button', { name: 'Listo' }).click();
  // Y una línea a mano.
  await page.getByRole('button', { name: 'Añadir una línea' }).click();
  const filas = await page.locator('[data-linea]:not([hidden])').count();
  await page.getByLabel(`Qué pides en la línea ${filas}`).fill('Tornillos de 4 × 30');
  await page.getByLabel(`Cantidad de la línea ${filas}`).fill('200');
  await page.getByRole('button', { name: 'Mañana' }).click();
  await page.getByRole('button', { name: 'Guardar el pedido' }).click();

  await expect(page.getByRole('heading', { name: `Pedido a Herrajes ${p}` })).toBeVisible();
  await expect(page.getByText(/PE\d{4}-\d{4} · del/).first()).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`Pomo ${p}.*ref\\. POMO-1.*2 ud.*7,00`) })).toBeVisible();
  await auditar(page);
  await controlesGrandes(page);
  // El mensaje para el proveedor no lleva precios.
  const wa = decodeURIComponent((await page.getByRole('link', { name: 'Enviar por WhatsApp' }).first().getAttribute('href')) ?? '');
  expect(wa).toContain('https://wa.me/34600000088?text=Hola Ana');
  expect(wa).toContain(`2 ud · Pomo ${p} (ref. POMO-1)`);
  expect(wa).toContain('200 ud · Tornillos de 4 × 30');
  expect(wa).not.toMatch(/€|3,5/);
  // El PDF tampoco.
  await page.getByRole('link', { name: 'Imprimir o guardar en PDF' }).click();
  await expect(page.getByRole('heading', { name: 'Pedido de material' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('€');
  await auditar(page);
  await page.getByRole('link', { name: 'Volver' }).click();

  await page.getByRole('button', { name: 'Ya se lo he enviado' }).click();
  await expect(page.getByRole('status').first()).toContainText('enviado');
  await expect(page.getByRole('link', { name: 'Cambiar el pedido' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ha llegado: recibido' }).click();
  await page.getByRole('button', { name: 'Apuntarlo como gasto' }).click();
  await expect(page).toHaveURL(/\/panel\/gastos\/[^/]+$/);
  // El tipo es el de lo que más pesa en el pedido: el tablero de la puerta.
  await expect(page.getByLabel('Tipo de gasto')).toHaveValue('tableros');

  // En la lista de pedidos, recibido.
  await page.goto(`/panel/pedidos?ver=recibido&q=${encodeURIComponent(p)}`);
  await expect(page.getByRole('row', { name: new RegExp(`Herrajes ${p}.*Recibido`) })).toBeVisible();
  await auditar(page);
});
