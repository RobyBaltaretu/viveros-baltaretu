import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Creaciones Turia: presupuestos a cliente con anticipo, IVA del 21 % fijo y paso a factura.
test('presupuestos: alta con extra, anticipo, envío, aceptación y factura de anticipo', async ({ page }) => {
  test.setTimeout(90_000);
  const p = test.info().project.name;
  await page.goto('/panel/facturas/clientes/nuevo');
  await page.getByLabel('Razón social o nombre completo').fill(`Cliente ${p}`);
  await page.getByRole('button', { name: 'Guardar el cliente' }).click();

  await page.goto('/panel/presupuestos-cliente');
  await auditar(page);
  await page.getByRole('link', { name: 'Nuevo presupuesto' }).click();
  await expect(page.getByText('IVA: 21 %')).toBeVisible();
  await expect(page.getByLabel('IVA', { exact: true })).toHaveCount(0);
  await auditar(page);
  await controlesGrandes(page);
  await page.getByRole('combobox', { name: /^Cliente/ }).selectOption({ label: `Cliente ${p}` });
  await page.getByLabel('Qué se presupuesta').fill(`Armario ${p}`);
  await page.getByLabel('Concepto de la línea 1').fill('Armario de dos puertas');
  await page.getByLabel('Precio por unidad de la línea 1, en euros sin IVA').fill('1.250');
  await page.getByLabel('Concepto de la línea 2').fill('Montaje');
  await page.getByLabel('Precio por unidad de la línea 2, en euros sin IVA').fill('180');
  await page.getByLabel('Concepto de la línea 3').fill('Iluminación LED');
  await page.getByLabel('Precio por unidad de la línea 3, en euros sin IVA').fill('95');
  await page.getByLabel('La línea 3 es un extra opcional (no suma)').check();
  // El total se ve al escribir, antes de guardar; el anticipo, con un toque.
  await expect(page.locator('[data-total]')).toHaveText(/^1\.730,30/);
  await page.getByRole('button', { name: '30 %' }).click();
  await expect(page.getByLabel('Anticipo (% del total con IVA)')).toHaveValue('30');
  await page.getByRole('button', { name: '40 %' }).click();
  await expect(page.locator('[data-pago-anticipo]')).toHaveText(/^692,12/);
  // Una línea más sin recargar, y quitarla.
  await page.getByRole('button', { name: 'Añadir una línea' }).click();
  await expect(page.getByLabel('Concepto de la línea 4')).toBeFocused();
  await page.getByRole('button', { name: 'Quitar la línea 4' }).click();
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
  await expect(page.locator('.nv-titulo .nv-chip')).toHaveText('Enviado');
  await page.getByRole('button', { name: 'El cliente lo acepta' }).click();
  await page.getByRole('button', { name: 'Hacer la factura de anticipo' }).click();
  await expect(page).toHaveURL(/\/panel\/facturas\/[^/]+$/);
  await expect(page.locator('[name="l0.concepto"]')).toHaveValue(/^Anticipo del 40 % del presupuesto P\d{4}-\d{4}/);
});

test('factura desde un presupuesto: desde «Nueva factura» (el enviado se da por aceptado) y después la final', async ({ page }) => {
  test.setTimeout(90_000);
  const p = `${test.info().project.name} ${Date.now()}`;
  await page.goto('/panel/facturas/clientes/nuevo');
  await page.getByLabel('Razón social o nombre completo').fill(`Cliente desde ${p}`);
  await page.getByRole('button', { name: 'Guardar el cliente' }).click();
  await page.goto('/panel/presupuestos-cliente/nuevo');
  await page.getByRole('combobox', { name: /^Cliente/ }).selectOption({ label: `Cliente desde ${p}` });
  await page.getByLabel('Qué se presupuesta').fill(`Cocina ${p}`);
  await page.getByLabel('Concepto de la línea 1').fill('Muebles de cocina');
  await page.getByLabel('Precio por unidad de la línea 1, en euros sin IVA').fill('1000');
  await page.getByRole('button', { name: 'Guardar el presupuesto' }).click();
  await page.getByRole('button', { name: 'Marcar como enviado' }).click();
  await expect(page.getByRole('button', { name: 'Aceptado: hacer la factura de anticipo' })).toBeVisible();

  await page.goto('/panel/facturas/nueva');
  await expect(page.getByRole('heading', { name: 'Desde un presupuesto' })).toBeVisible();
  const boton = page.getByRole('button', { name: new RegExp(`^Facturar Cocina ${p}, de Cliente desde ${p}: anticipo del 40 %, 484,00.€\\. Se dará por aceptado$`) });
  await expect(boton).toBeVisible();
  await auditar(page);
  await controlesGrandes(page);
  await boton.click();
  await expect(page).toHaveURL(/\/panel\/facturas\/[^/]+$/);
  await expect(page.locator('[name="l0.concepto"]')).toHaveValue(/^Anticipo del 40 % del presupuesto/);
  await expect(page.locator('[data-total]').first()).toHaveText(/^484,00/);

  // La lista avisa de lo que queda por facturar; la siguiente es la final, que descuenta el anticipo.
  await page.goto('/panel/facturas');
  await expect(page.getByText(/presupuestos? aceptados? por facturar/)).toBeVisible();
  await page.getByRole('link', { name: 'Facturarlos' }).click();
  await page.getByRole('button', { name: new RegExp(`^Facturar Cocina ${p}, .*factura final \\(descuenta el anticipo\\), 726,00`) }).click();
  await expect(page.locator('[name="l0.concepto"]')).toHaveValue('Muebles de cocina');
  await expect(page.locator('[name="l1.concepto"]')).toHaveValue(/^Anticipo ya facturado/);
  await expect(page.locator('[data-total]').first()).toHaveText(/^726,00/);
  // Ya no queda nada de este presupuesto por facturar.
  await page.goto('/panel/facturas/nueva');
  await expect(page.getByRole('button', { name: new RegExp(`^Facturar Cocina ${p},`) })).toHaveCount(0);
});
