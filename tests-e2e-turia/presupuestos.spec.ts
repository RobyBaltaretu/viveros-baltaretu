import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Creaciones Turia: presupuestos a cliente con anticipo, IVA del 21 % fijo y paso a factura.
test('presupuestos: alta con extra, anticipo, envío, aceptación y factura de anticipo', async ({ page }) => {
  test.setTimeout(90_000);
  const p = test.info().project.name;
  await page.goto('/panel/facturas/clientes/nuevo');
  await page.getByLabel('Razón social o nombre completo').fill(`Cliente ${p}`);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await page.goto('/panel/presupuestos-cliente');
  await auditar(page);
  await page.getByRole('link', { name: 'Nuevo presupuesto' }).click();
  await expect(page.getByText('IVA: 21 %')).toBeVisible();
  await expect(page.getByLabel('IVA', { exact: true })).toHaveCount(0);
  await auditar(page);
  await controlesGrandes(page);
  await page.getByRole('combobox', { name: /^Cliente/ }).selectOption({ label: `Cliente ${p}` });
  await page.getByLabel('Qué se presupuesta').fill(`Armario ${p}`);
  const lineas = page.locator('fieldset', { has: page.getByText('Líneas', { exact: true }) });
  await lineas.getByLabel('Concepto').nth(0).fill('Armario de dos puertas');
  await lineas.getByLabel('Precio por unidad (€, sin IVA)').nth(0).fill('1.250');
  await lineas.getByLabel('Concepto').nth(1).fill('Montaje');
  await lineas.getByLabel('Precio por unidad (€, sin IVA)').nth(1).fill('180');
  await lineas.getByLabel('Concepto').nth(2).fill('Iluminación LED');
  await lineas.getByLabel('Precio por unidad (€, sin IVA)').nth(2).fill('95');
  await lineas.getByLabel('Extra opcional (no suma)').nth(2).check();
  await page.getByLabel('Anticipo (% del total con IVA)').fill('40');
  await page.getByRole('button', { name: 'Guardar el presupuesto' }).click();

  await expect(page.getByRole('status').first()).toContainText('Presupuesto guardado');
  // Los importes llevan un espacio duro antes del €: se buscan solo las cifras.
  await expect(page.getByText(/^1\.730,30/).first()).toBeVisible();
  await expect(page.getByText(/692,12.*\+.*1\.038,18/)).toBeVisible();
  await expect(page.getByText(/Extras opcionales .*Iluminación LED/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=.*1\.730%2C30/);
  await auditar(page);
  await controlesGrandes(page);

  await page.getByRole('link', { name: 'Imprimir o guardar en PDF' }).click();
  await expect(page.getByRole('heading', { name: 'Presupuesto' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Anticipo al aceptar \(40 %\)/ })).toContainText('692,12');
  await auditar(page);
  await page.getByRole('link', { name: 'Volver' }).click();

  await page.getByRole('button', { name: 'Marcar como enviado' }).click();
  await expect(page.getByText('Enviado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'El cliente lo acepta' }).click();
  await page.getByRole('button', { name: 'Hacer la factura de anticipo' }).click();
  await expect(page).toHaveURL(/\/panel\/facturas\/[^/]+$/);
  await expect(page.locator('[name="l0.concepto"]')).toHaveValue(/^Anticipo del 40 % del presupuesto P\d{4}-\d{4}/);
});
