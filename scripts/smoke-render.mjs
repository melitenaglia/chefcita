import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
try{
  const response=await page.goto('http://127.0.0.1:4173/chefcita/',{waitUntil:'networkidle',timeout:30000});
  if(!response||!response.ok())throw new Error('Preview HTTP failed');
  const text=(await page.locator('body').innerText()).trim();
  if(!text.includes('Chefcita'))throw new Error('Chefcita did not render');
  if(text==='Cargando Chefcita…')throw new Error('React did not replace boot fallback');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Chefcita render smoke test OK');
}finally{await browser.close()}
