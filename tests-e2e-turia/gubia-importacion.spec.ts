import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { auditar } from '../tests-e2e/ayudas';

test('Gubia: subir PDF, revisar materiales y confirmar sin guardar antes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let analizados = 0, guardados = 0;
  await page.route('**/api/panel/catalogo-importar', async route => {
    const raw = route.request().postData() ?? '';
    if (raw.includes('name="accion"') && raw.includes('analizar')) {
      analizados++;
      await route.fulfill({ status:200, contentType:'application/json',body:JSON.stringify({
        ok:true,paginas:7,inicio:analizados===1?1:6,fin:analizados===1?6:7,
        articulos:[{
          categoria:'tableros',nombre:'Roble natural',referencia:'DEC-01',codigoDecor:'DEC-01',
          acabado:'Mate',soporte:'Melamina',espesorMm:19,formato:'2800 x 2070 mm',
          unidad:'m²',colorHex:'#b69a72',veta:'direccional',brillo:'mate',pagina:2,
        }],
      }) });return;
    }
    guardados++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,creados:1,duplicados:0,rechazados:0})});
  });
  await page.goto('/panel/catalogo/importar');
  await expect(page.getByRole('heading',{name:'Importar catálogo con Gubia'})).toBeVisible();
  await page.getByLabel('Proveedor').fill('ONESTA');
  const pdf = await PDFDocument.create(); pdf.addPage();
  await page.getByLabel('PDF del catálogo').setInputFiles({
    name:'onesta.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save()),
  });
  await page.getByRole('button',{name:'Analizar PDF con Gubia'}).click();
  await expect(page.getByRole('heading',{name:'2. Revisa los materiales'})).toBeVisible();
  expect(analizados).toBe(2);
  expect(guardados).toBe(0);
  await expect(page.locator('.gubia-item')).toHaveCount(1);
  await page.getByRole('textbox',{name:'Nombre',exact:true}).fill('Roble natural seleccionado');
  await auditar(page);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Crear artículos seleccionados'}).click();
  await expect(page.getByRole('status')).toContainText('1 nuevos');
  expect(guardados).toBe(1);
});
