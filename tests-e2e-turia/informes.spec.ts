import {expect,test} from '@playwright/test';
import {auditar,controlesGrandes} from '../tests-e2e/ayudas';

test('informes: periodos estables, gráficos y cifras con IVA',async({page})=>{
 await page.goto('/panel/informes');
 await expect(page.getByRole('heading',{level:1,name:'Informes'})).toBeVisible();
 await expect(page.getByRole('img',{name:/últimos 12 meses/})).toBeVisible();
 await expect(page.locator('.rep-kpis')).toContainText('con IVA');
 await expect(page.getByText('Cobrado con IVA')).toBeVisible();
 const anterior=page.getByRole('link',{name:/Periodo anterior/});
 const antes=await anterior.boundingBox();await anterior.click();
 const despues=await page.getByRole('link',{name:/Periodo anterior/}).boundingBox();
 expect(Math.abs(antes!.x-despues!.x)).toBeLessThan(1);
 await page.getByRole('link',{name:/Periodo siguiente/}).click();
 await expect(page.getByRole('link',{name:'Trimestre',exact:true})).toBeVisible();
 await auditar(page);await controlesGrandes(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
