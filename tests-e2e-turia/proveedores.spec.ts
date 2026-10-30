import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Proveedores de la carpintería (módulo proveedores): alta con errores junto al campo, qué sirve,
// sus artículos del catálogo, lista con buscador, ocultar y CSV.
test('proveedor: alta, artículos del catálogo, lista, ocultar y CSV', async ({ page }) => {
  const p = `${test.info().project.name} ${Date.now()}`;
  await page.goto('/panel/proveedores');
  await expect(page.getByRole('heading', { name: 'Proveedores', level: 1 })).toBeVisible();
  await auditar(page);
  await page.getByRole('link', { name: 'Añadir un proveedor' }).click();
  await auditar(page);
  await controlesGrandes(page);
  await page.getByLabel('Nombre', { exact: true }).fill(`Maderas ${p} SL`);
  await page.getByLabel('NIF').fill('B12345670');
  await page.getByLabel('Plazo de entrega habitual').fill('tres');
  await page.getByRole('button', { name: 'Guardar el proveedor' }).click();
  await expect(page.getByLabel('NIF')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Plazo de entrega habitual')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('NIF').fill('B12345674');
  await page.getByLabel('Plazo de entrega habitual').fill('3');
  await page.getByLabel(/^Persona de contacto/).fill('Comercial de prueba');
  await page.getByLabel('Teléfono').fill('+34 600 000 077');
  await page.getByLabel('Tableros', { exact: true }).check();
  await page.getByLabel('Cantos', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar el proveedor' }).click();
  await expect(page.getByRole('status').first()).toContainText('Guardado');
  await expect(page.getByText('Ningún artículo del catálogo lleva su nombre')).toBeVisible();
  const ficha = page.url();

  // Un artículo del catálogo con su nombre (el campo lo propone) sale en su ficha.
  await page.goto('/panel/catalogo/articulos/nuevo');
  await page.getByLabel('Categoría').selectOption('tableros');
  await page.getByLabel('Nombre').fill(`Tablero de ${p}`);
  await page.getByLabel(/^Coste por/).fill('20');
  await expect(page.locator(`#lista-proveedores option[value="Maderas ${p} SL"]`)).toHaveCount(1);
  await page.getByLabel('Proveedor', { exact: true }).fill(`maderas ${p}`);
  await page.getByRole('button', { name: 'Guardar el artículo' }).click();
  await page.goto(ficha);
  await expect(page.getByRole('link', { name: `Tablero de ${p}` })).toBeVisible();
  await auditar(page);

  // En la lista, con lo que sirve; al buscar por lo que sirve; ocultarlo.
  await page.goto(`/panel/proveedores?q=${encodeURIComponent(p)}`);
  await expect(page.getByRole('row', { name: new RegExp(`Maderas ${p} SL.*Tableros, Cantos.*1 artículo del catálogo`) })).toBeVisible();
  await controlesGrandes(page);
  await page.getByRole('link', { name: `Maderas ${p} SL` }).click();
  await page.getByRole('button', { name: 'Ocultarlo (ya no le compras)' }).click();
  await expect(page.getByRole('status').first()).toContainText('Hecho');
  await page.goto(`/panel/proveedores?ver=ocultos&q=${encodeURIComponent(p)}`);
  await expect(page.getByRole('link', { name: `Maderas ${p} SL` })).toBeVisible();

  const csv = await page.request.get('/api/panel/proveedores.csv');
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain(`"Maderas ${p} SL";"B12345674";"Comercial de prueba"`);
});
