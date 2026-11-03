import {expect,test} from '@playwright/test';
import {auditar,controlesGrandes} from '../tests-e2e/ayudas';

test('informes: periodos estables, gráficos y cifras con IVA',async({page})=>{
 await page.goto('/panel/informes');
 await expect(page.getByRole('heading',{level:1,name:'Informes'})).toBeVisible();
 await expect(page.getByRole('img',{name:/Ingresos y gastos por mes/})).toBeVisible();
 await expect(page.locator('.rep-kpis')).toContainText('con IVA');
 await expect(page.getByText('Cobrado con IVA')).toBeVisible();
 for(const titulo of ['Antigüedad de cobros pendientes','Respuesta a presupuestos','Gastos por categoría']) await expect(page.getByRole('heading',{name:titulo,exact:true})).toBeVisible();
 await page.locator('.rep-kpis a').first().click();await expect(page.getByRole('heading',{name:'Detalle del informe'})).toBeVisible();await page.goBack();
 await page.locator('.rep-kpis a').nth(2).click();await expect(page).toHaveURL(/tipo=resultado/);await expect(page.getByRole('heading',{name:'Detalle del informe'})).toBeVisible();await page.goBack();
 await page.getByRole('link',{name:'Mes',exact:true}).click();
 const anterior=page.getByRole('link',{name:/Periodo anterior/});
 const antes=await anterior.boundingBox();await anterior.click();
 const despues=await page.getByRole('link',{name:/Periodo anterior/}).boundingBox();
 expect(Math.abs(antes!.x-despues!.x)).toBeLessThan(1);
 await page.getByRole('link',{name:/Periodo siguiente/}).click();
 await page.getByRole('link',{name:'Trimestre',exact:true}).click();await expect(page).toHaveURL(/periodo=trimestre/);
 await page.getByRole('link',{name:'Año',exact:true}).click();await expect(page).toHaveURL(/periodo=anio/);
 await auditar(page);await controlesGrandes(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('rango personalizado y CSV reflejan el periodo',async({page,request})=>{
 const qs='periodo=personalizado&desde=2026-01-15&hasta=2026-02-10';
 await page.goto('/panel/informes?'+qs);
 await expect(page.getByRole('heading',{name:'15/01/2026 – 10/02/2026'})).toBeVisible();
 await expect(page.locator('.rep-kpis')).toContainText('Sin datos suficientes');
 const csv=await request.get('/panel/informes?'+qs+'&exportar=csv');
 expect(csv.status()).toBe(200);expect(csv.headers()['content-type']).toContain('text/csv');
 const contenido=await csv.text();expect(contenido).toContain('2026-01-15 a 2026-02-10');expect(contenido).toContain('Ingresos 2026-01');expect(contenido).toContain('Sin datos suficientes');
 await page.getByRole('link',{name:'Rango anterior'}).click();
 await expect(page).toHaveURL(/periodo=personalizado/);
 const malo=await request.get('/panel/informes?periodo=personalizado&desde=2026-02-10&hasta=2026-01-15');expect(malo.status()).toBe(400);
});

test('un rango largo mantiene los meses legibles sin desbordar la página',async({page})=>{
 await page.goto('/panel/informes?periodo=personalizado&desde=2024-01-01&hasta=2026-10-31');
 const grafico=page.locator('.rep-chart figure');
 await expect(grafico.getByRole('img')).toBeVisible();
 expect(await grafico.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
