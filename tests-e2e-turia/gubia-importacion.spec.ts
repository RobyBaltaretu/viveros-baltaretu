import {expect,test} from '@playwright/test';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {auditar} from '../tests-e2e/ayudas';

test('Gubia: PDF local se convierte en texto para Groq y no se envía el PDF completo',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  let interpretados=0,guardados=0;
  await page.route('**/api/panel/catalogo-importar',async route=>{
    const body=route.request().postDataJSON() as {accion:string;paginas?:Array<{pagina:number;texto:string}>;articulos?:unknown[]};
    if(body.accion==='interpretar'){
      interpretados++;
      expect(body.paginas).toHaveLength(1);
      expect(body.paginas?.[0]?.texto).toContain('Melamina');
      expect(JSON.stringify(body)).not.toContain('%PDF-');
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        ok:true,paginasProcesadas:[1],
        articulos:[{categoria:'tableros',nombre:'Melamina roble natural',referencia:'DEC-01',codigoDecor:'DEC-01',
          acabado:'Mate',soporte:'Melamina',espesorMm:19,formato:'2800 x 2070 mm',
          unidad:'m²',colorHex:null,veta:null,brillo:'mate',pagina:1}],
      })});
      return;
    }
    if(body.accion==='confirmar'){
      guardados++;
      expect(body.articulos).toHaveLength(1);
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,creados:1,duplicados:0,rechazados:0})});
      return;
    }
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,error:'Acción inesperada'})});
  });
  await page.goto('/panel/catalogo/importar');
  await expect(page.getByRole('heading',{name:'Importar catálogo con Gubia'})).toBeVisible();
  await page.getByLabel('Proveedor').fill('ONESTA');
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const pagina=pdf.addPage([595,842]);
  pagina.drawText('Melamina roble natural DEC-01 19 mm 2800 x 2070 mm',{x:55,y:680,size:11,font});
  await page.getByLabel('PDF del catálogo').setInputFiles({
    name:'onesta.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save()),
  });
  await page.getByRole('button',{name:'Analizar PDF con Gubia'}).click();
  await expect(page.getByRole('heading',{name:'2. Revisa los materiales'})).toBeVisible({timeout:30000});
  await expect(page.locator('.gubia-item')).toHaveCount(1);
  expect(interpretados).toBe(1);
  expect(guardados).toBe(0);
  await page.getByRole('textbox',{name:'Nombre',exact:true}).fill('Roble natural validado');
  for (const width of [390,1200]) {
    await page.setViewportSize({width,height:844});
    const card=page.locator('.gubia-item').first();
    await expect(card).toHaveCSS('display','grid');
    await expect(card.locator('.gubia-item-campos label').first()).toHaveCSS('display','grid');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await card.screenshot({path:testInfo.outputPath('revision-catalogo-'+width+'.png')});
  }
  await auditar(page);
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Crear artículos seleccionados'}).click();
  await expect(page.getByRole('status')).toContainText('1 nuevos');
  expect(guardados).toBe(1);
});
