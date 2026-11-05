import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

test('Gubia: si Groq Free falla al inicio, conserva candidatos del PDF local sin más llamadas a IA', async ({ page }) => {
  let llamadas = 0;
  await page.route('**/api/panel/catalogo-importar', async route => {
    llamadas++;
    await route.fulfill({
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ok:false,error:'Groq Free ha alcanzado el límite de tokens.'}),
    });
  });
  await page.goto('/panel/catalogo/importar');
  await page.getByLabel('Proveedor').fill('ONESTA');
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  for (let i=0;i<4;i++){
    const p=pdf.addPage([595,842]);
    p.drawText('Melamina roble natural DEC-0'+(i+1)+' formato 2800 x 2070 mm',{x:55,y:690,size:11,font});
  }
  await page.getByLabel('PDF del catálogo').setInputFiles({
    name:'onesta.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save()),
  });
  await page.getByRole('button',{name:'Analizar PDF con Gubia'}).click();
  await expect(page.locator('#gubia-estado')).toContainText('Groq no ha podido analizar el documento',{timeout:30000});
  await expect(page.locator('#gubia-estado')).toContainText('Groq Free ha alcanzado el límite');
  await expect(page.locator('.gubia-item')).toHaveCount(4);
  expect(llamadas).toBe(1);
  await expect(page.getByRole('heading',{name:'2. Revisa los materiales'})).toBeVisible();
});
