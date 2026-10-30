import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Clientes de la carpintería: contacto, dirección de la obra y forma de pago habitual (D-06),
// que se proponen en sus presupuestos; y los tipos de gasto del taller (T-20).
test('cliente con contacto, obra y forma de pago; su presupuesto la propone', async ({ page }) => {
  const p = `${test.info().project.name} ${Date.now()}`;
  await page.goto('/panel/facturas/clientes/nuevo');
  await expect(page.getByRole('heading', { name: 'Cliente nuevo', level: 1 })).toBeVisible();
  await auditar(page);
  await controlesGrandes(page);
  // Sin nombre no se guarda, y el error se ve junto al campo.
  await page.getByRole('button', { name: 'Guardar el cliente' }).click();
  await expect(page.getByLabel('Razón social o nombre completo')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Razón social o nombre completo').fill(`Reformas ${p}`);
  await page.getByLabel(/^Persona de contacto/).fill('Andrés (jefe de obra)');
  await page.getByLabel('Teléfono').fill('+34 600 000 099');
  await page.getByLabel('Dirección de facturación').fill('Calle de Prueba 1');
  await page.getByLabel('Código postal').fill('46001');
  await page.getByLabel('Población').fill('Valencia');
  await page.getByRole('button', { name: 'La misma que la de facturación' }).click();
  await expect(page.getByLabel(/^Dirección de la obra/)).toHaveValue('Calle de Prueba 1, 46001 Valencia');
  await page.getByLabel(/^Dirección de la obra/).fill('Calle Mayor de Prueba 5, Alfafar');
  await page.getByRole('button', { name: 'Bizum', exact: true }).click();
  await expect(page.getByLabel('Forma de pago habitual')).toHaveValue('Bizum');
  await expect(page.getByRole('button', { name: 'Bizum', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Guardar el cliente' }).click();
  await expect(page.getByRole('status').first()).toContainText('Guardado');
  await expect(page.getByRole('heading', { name: `Reformas ${p}`, level: 1 })).toBeVisible();
  await expect(page.getByText('Te debe')).toBeVisible();
  await auditar(page);

  // En la lista, con su contacto; y al buscar.
  await page.goto(`/panel/facturas/clientes?q=${encodeURIComponent(p)}`);
  await expect(page.getByRole('row', { name: new RegExp(`Reformas ${p}.*Andrés`) })).toBeVisible();
  await auditar(page);
  await controlesGrandes(page);

  // Su presupuesto propone su forma de pago y enseña la obra.
  await page.getByRole('link', { name: `Reformas ${p}` }).click();
  await page.getByRole('link', { name: 'Hacerle un presupuesto' }).click();
  await expect(page.getByLabel('Forma de pago')).toHaveValue('Bizum');
  await expect(page.getByText('Obra: Calle Mayor de Prueba 5, Alfafar')).toBeVisible();
  // Al quitar el cliente, la propuesta se quita con él (lo escrito a mano, no).
  await page.getByRole('combobox', { name: /^Cliente/ }).selectOption('');
  await expect(page.getByLabel('Forma de pago')).toHaveValue('');
  await expect(page.getByText(/^Obra:/)).toBeHidden();
});

test('gastos: los tipos son los del taller', async ({ page }) => {
  await page.goto('/panel/gastos/nuevo');
  await page.getByRole('button', { name: 'No tengo ticket: escribirlo a mano' }).click();
  await page.waitForURL(/\/panel\/gastos\/[^/]+$/);
  const tipo = page.getByLabel('Tipo de gasto');
  const opciones = await tipo.locator('option').allTextContents();
  expect(opciones).toEqual(expect.arrayContaining(['Tableros y madera', 'Herrajes y accesorios', 'Barnices, lacas y colas', 'Otros']));
  expect(opciones).not.toContain('Planta y semillas');
});
