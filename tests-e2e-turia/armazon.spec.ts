import { expect, test } from '@playwright/test';
import { auditar, controlesGrandes } from '../tests-e2e/ayudas';

// Diseño nuevo del panel: barra lateral (ordenador) o barra de abajo (móvil) y «Crear».
test('«Crear» abre el menú y lleva a un presupuesto nuevo', async ({ page, isMobile }) => {
  await page.goto('/panel/facturas');
  const crear = isMobile ? page.locator('.nv-inferior').getByRole('button', { name: 'Crear' }) : page.locator('header').getByRole('button', { name: 'Crear' });
  await crear.click();
  const menu = page.getByRole('dialog', { name: '¿Qué quieres crear?' });
  await expect(menu).toBeVisible();
  await auditar(page);
  await menu.getByRole('link', { name: /Presupuesto/ }).click();
  await expect(page).toHaveURL(/\/panel\/presupuestos-cliente\/nuevo$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nuevo presupuesto');
});

test('la sección actual se marca y todas están a mano', async ({ page, isMobile }) => {
  await page.goto('/panel/facturas');
  if (isMobile) {
    await expect(page.locator('.nv-inferior').getByRole('link', { name: 'Documentos' })).toHaveAttribute('aria-current', 'page');
  } else {
    const lateral = page.locator('.nv-lateral');
    await expect(lateral.getByRole('link', { name: 'Facturas' })).toHaveAttribute('aria-current', 'page');
    for (const s of ['Presupuestos', 'Clientes', 'Portafolio', 'Compras y gastos', 'Informes']) await expect(lateral.getByRole('link', { name: s })).toBeVisible();
  }
  await auditar(page);
  await controlesGrandes(page);
});

test('inicio del diseño: resumen, atajos y proyectos conectados', async ({ page }) => {
  await page.goto('/panel');
  const expandir = page.getByRole('button', {name:'Ver todas las cifras'});
  if (await expandir.isVisible()) await expandir.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creaciones Turia');
  for (const k of ['Presupuestos', 'Facturado', 'Gastos', 'Cobros']) await expect(page.locator('.ux-metricas').getByText(k, {exact:true})).toBeVisible();
  await expect(page.getByRole('heading', {name:'Proyectos en curso'})).toBeVisible();
  await page.getByLabel('Periodo del resumen').selectOption('anterior');
  await expect(page).toHaveURL(/periodo=anterior/);
  await auditar(page);
  await controlesGrandes(page);
  await page.getByRole('navigation', {name:'Acciones rápidas'}).getByRole('link', {name:/factura/i}).click();
  await expect(page).toHaveURL(/facturas\/nueva/);
});

test('avisos reales y proyectos con filtros, sin datos ficticios', async ({ page }) => {
  await page.goto('/panel');
  await page.getByRole('button', {name:/Notificaciones/}).click();
  await expect(page.getByRole('dialog', {name:'Notificaciones'})).toBeVisible();
  await page.getByRole('dialog', {name:'Notificaciones'}).getByRole('button', {name:'Cerrar',exact:true}).click();
  await page.locator('.ux-proyectos').getByRole('link', {name:/Ver todos/}).click();
  await expect(page.getByRole('heading', {name:'Proyectos',exact:true})).toBeVisible();
  await page.getByRole('link', {name:'Finalizados',exact:true}).click();
  await expect(page).toHaveURL(/ver=finalizados/);
  await auditar(page);
  await controlesGrandes(page);
});

test('buscar encuentra secciones y no desborda en móvil', async ({page,isMobile}) => {
  await page.goto('/panel/buscar?q=presupuesto');
  await expect(page.locator('main').getByRole('link',{name:/Presupuestos/}).first()).toBeVisible();
  await expect(page.locator('main')).toContainText('resultados');
  await auditar(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (!isMobile) {
    await page.keyboard.press('Control+k');
    await expect(page.locator('#ux-buscar')).toBeFocused();
  }
});
