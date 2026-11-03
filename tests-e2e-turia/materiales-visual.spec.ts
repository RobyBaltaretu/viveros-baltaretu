import {expect,test} from '@playwright/test';
import {auditar} from '../tests-e2e/ayudas';

test('Turia Studio: material visual por zona, búsqueda y confirmación en móvil',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/panel/simulador');
  await page.getByRole('button',{name:/3 · Materiales/}).click();
  const trigger=page.getByRole('button',{name:'Elegir material para Material Muebles Superiores / Columnas'});
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:/Elige material/});
  await expect(dialog).toBeVisible();
  const cards=dialog.locator('#studio-material-results [data-material-option]');
  await expect(cards.first()).toBeVisible();
  const before=await trigger.locator('[data-current-name]').innerText();
  const all=await cards.allTextContents();
  expect(all.length).toBeGreaterThan(0);
  await dialog.getByRole('button',{name:'Lacados'}).click();
  await dialog.getByRole('button',{name:'Todos'}).click();
  await dialog.getByRole('searchbox').fill('no-existe-este-material-9081');
  await expect(dialog.getByText('No hay artículos compatibles con estos filtros.')).toBeVisible();
  await dialog.getByRole('searchbox').fill('');
  const choices=dialog.locator('#studio-material-results [data-material-option]');
  if(await choices.count()>1){
    const second=choices.nth(1);
    const selected=await second.getAttribute('data-name');
    await second.click();
    await dialog.getByRole('button',{name:'Aplicar material'}).click();
    await expect(dialog).toBeHidden();
    await expect(trigger.locator('[data-current-name]')).toHaveText(selected!);
    expect(await trigger.locator('[data-current-name]').innerText()).not.toBe(before);
    await expect(page.locator('input[name="upperMaterial"]:checked')).toHaveAttribute('value',await second.getAttribute('data-id')!);
  } else {
    await dialog.getByRole('button',{name:'Cancelar'}).click();
    await expect(trigger.locator('[data-current-name]')).toHaveText(before);
  }
  await auditar(page);
});
