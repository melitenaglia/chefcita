import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});

async function testViewport(name,viewport){
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
  try{
    const response=await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle',timeout:30000});
    if(!response||!response.ok())throw new Error(name+': Preview HTTP failed');
    const text=(await page.locator('body').innerText()).trim();
    if(!text.includes('Chefcita'))throw new Error(name+': Chefcita did not render');
    if(text==='Cargando Chefcita…')throw new Error(name+': React did not replace boot fallback');

    const layout=await page.evaluate(()=>({
      scrollWidth:document.documentElement.scrollWidth,
      clientWidth:document.documentElement.clientWidth,
      smallestControlFont:[...document.querySelectorAll('input,select,textarea')].reduce((min,el)=>{
        const size=parseFloat(getComputedStyle(el).fontSize)||999;
        return Math.min(min,size);
      },999),
      viewportMeta:document.querySelector('meta[name="viewport"]')?.content||''
    }));

    if(layout.scrollWidth>layout.clientWidth+2)throw new Error(name+': horizontal overflow detected');
    if(viewport.width<=430&&layout.smallestControlFont<16)throw new Error(name+': form controls below 16px can trigger mobile zoom');
    if(viewport.width<=430&&!layout.viewportMeta.includes('viewport-fit=cover'))throw new Error(name+': viewport-fit=cover missing');
    if(viewport.width<=430&&!layout.viewportMeta.includes('interactive-widget=resizes-content'))throw new Error(name+': interactive keyboard viewport mode missing');
    if(errors.length)throw new Error(errors.join('\n'));
    console.log('Chefcita '+name+' render smoke test OK');
  }finally{
    await page.close();
  }
}

try{
  await testViewport('desktop',{width:1280,height:900});
  await testViewport('mobile-small',{width:360,height:800});
  await testViewport('mobile',{width:390,height:844});
  await testViewport('mobile-large',{width:430,height:932});
}finally{
  await browser.close();
}
