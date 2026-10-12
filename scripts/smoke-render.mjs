import { chromium,webkit } from 'playwright';

let browser=await chromium.launch({headless:true});

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

async function testSignedInMobile(){
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 const uid='11111111-1111-4111-8111-111111111111';
 const libraryId='22222222-2222-4222-8222-222222222222';
 const recipeId='33333333-3333-4333-8333-333333333333';
 const shareCalls=[];
 const testToken=[{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'test-signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
 await page.addInitScript(({uid,testToken})=>{
  localStorage.setItem('sb-yfhiqdpohixsvzuudivw-auth-token',JSON.stringify({access_token:testToken,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:uid,email:'test@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{}}}));
 },{uid,testToken});
 const ownRecipe={id:recipeId,owner_id:uid,title:'Receta propia de prueba',created_at:'2026-10-12T10:00:00Z',review_status:'recipe',recipe_library_shares:[],recipe_ingredients:[],recipe_tags:[],recipe_steps:[],recipe_sources:[],user_recipes:[]};
 const sharedRecipe={...ownRecipe,id:'44444444-4444-4444-8444-444444444444',owner_id:'other-user',title:'Receta de Sofi',recipe_library_shares:[{household_id:libraryId,households:{name:'Con Sofi'}}]};
 await page.route('https://*.supabase.co/**',async route=>{
  const url=new URL(route.request().url());
  const table=url.pathname.split('/').pop();let data=[];
  if(table==='user')data={id:uid,email:'test@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{}};
  if(table==='household_members')data=[{household_id:libraryId,user_id:uid,role:'member',joined_at:'2026-10-12'}];
  if(table==='households')data=[{id:libraryId,name:'Con Sofi',created_by:uid}];
  if(table==='recipes')data=route.request().headers().accept?.includes('object')?ownRecipe:[ownRecipe,sharedRecipe];
  if(table==='recipe_library_shares')data=[ownRecipe,sharedRecipe].filter(r=>!url.searchParams.has('recipe_id')||url.searchParams.get('recipe_id')===`eq.${r.id}`).flatMap(r=>r.recipe_library_shares.map(x=>({...x,recipe_id:r.id,recipes:r})));
  if(table==='set_recipe_library_share'){
   const call=route.request().postDataJSON();shareCalls.push(call);
   ownRecipe.recipe_library_shares=call.p_shared?[{household_id:libraryId,households:{name:'Con Sofi'}}]:[];data=null;
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 try{
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'Recetas',exact:true}).click();
  await page.getByText('Receta propia de prueba',{exact:true}).waitFor();
  if(await page.getByText('Receta de Sofi',{exact:true}).count())throw new Error('Shared recipe leaked into Propias');
  await page.getByRole('button',{name:'Compartidas',exact:true}).click();
  await page.getByText('Receta de Sofi',{exact:true}).waitFor();
  if(await page.getByText('Receta propia de prueba',{exact:true}).count())throw new Error('Unshared recipe leaked into Compartidas');
  await page.getByRole('button',{name:'Propias',exact:true}).click();
  await page.getByRole('button',{name:'Añadir a biblioteca',exact:true}).click();
  await page.locator('.share-library-list button').click();
  await page.locator('.share-library-list button.active').waitFor();
  if(shareCalls.length!==1||shareCalls[0].p_household_id!==libraryId||shareCalls[0].p_recipe_id!==recipeId||shareCalls[0].p_shared!==true)throw new Error('Share RPC used wrong destination');
  await page.locator('.share-panel').getByRole('button',{name:'Listo',exact:true}).click();
  const density=[];
  for(const size of ['supercompact','compact','normal','large']){
   await page.evaluate(size=>{document.documentElement.dataset.uiSize=size;document.querySelector('.recipe-library').style.minHeight='2400px'},size);
   density.push(await page.evaluate(()=>({font:parseFloat(getComputedStyle(document.querySelector('.recipe-card-body h3')).fontSize),padding:parseFloat(getComputedStyle(document.querySelector('.recipe-card-body')).paddingTop),thumb:parseFloat(getComputedStyle(document.querySelector('.mobile-menu-trigger')).height)})));
   const before=await page.locator('.mobile-bottom-nav').boundingBox();
   await page.evaluate(()=>document.querySelector('.content').scrollTo(0,1200));
   const after=await page.locator('.mobile-bottom-nav').boundingBox();
   if(Math.abs(before.y-after.y)>1||Math.abs(after.y+after.height-844)>1)throw new Error('Navigation moved during internal scroll: '+size);
   const state=await page.evaluate(()=>({contentScroll:document.querySelector('.content').scrollTop,documentScroll:window.scrollY,overflow:document.documentElement.scrollWidth>innerWidth,fonts:[...document.querySelectorAll('input,select,textarea')].map(x=>parseFloat(getComputedStyle(x).fontSize))}));
   if(state.contentScroll<100||state.documentScroll!==0||state.overflow||state.fonts.some(x=>x<16))throw new Error('Mobile scroll or zoom regression: '+size);
   await page.evaluate(()=>document.querySelector('.content').scrollTo(0,0));
  }
  for(let i=1;i<density.length;i++)if(density[i].font<=density[i-1].font||density[i].padding<=density[i-1].padding||density[i].thumb<density[i-1].thumb)throw new Error('Density changes only text, not layout');
  await page.locator('.mobile-menu-trigger').click();
  await page.locator('.drawer-group button').filter({hasText:'Bibliotecas'}).click();
  await page.locator('.playlist-card').filter({hasText:'Con Sofi'}).click();
  await page.getByRole('button',{name:'Quitar de esta biblioteca',exact:true}).click();
  await page.getByText('Receta propia de prueba',{exact:true}).waitFor({state:'detached'});
  if(!shareCalls.some(x=>x.p_shared===false))throw new Error('Removing from library did not change membership');
  await page.getByRole('button',{name:'Añadir recetas guardadas',exact:true}).click();
  await page.locator('.picker-recipes button').filter({hasText:'Receta propia de prueba'}).click();
  await page.locator('.picker-recipes button.added').waitFor();
  await page.locator('.recipe-picker').getByRole('button',{name:'Listo',exact:true}).click();
  await page.getByText('Receta propia de prueba',{exact:true}).waitFor();
  await page.locator('.mobile-menu-trigger').click();
  await page.locator('.drawer-group button').filter({hasText:'Guardar receta'}).click();
  if(await page.locator('#recipe-destination').count())throw new Error('Import form still asks for library destination');
  await page.locator('.form-head>button').click();
  await page.locator('.mobile-menu-trigger').click();
  await page.locator('.drawer-group button').filter({hasText:'Recetas por revisar'}).click();
  await page.getByRole('button',{name:'Revisar recetas',exact:true}).click();
  await page.locator('.review-card').first().click();
  await page.getByRole('button',{name:'Eliminar receta',exact:true}).waitFor();
  const review=await page.evaluate(()=>({actions:getComputedStyle(document.querySelector('.review-actions')).position,top:getComputedStyle(document.querySelector('.review-top-actions')).position,overflow:document.documentElement.scrollWidth>innerWidth}));
  if(review.actions!=='static'||review.top!=='static'||review.overflow)throw new Error('Review actions obscure content or overflow');
  console.log('Signed-in mobile density, playlists and non-sticky review actions OK');
 }catch(error){console.error('Signed-in test DOM:',await page.locator('body').innerText());throw error}finally{await page.close()}
}

try{
  await testViewport('desktop',{width:1280,height:900});
  await testViewport('mobile-small',{width:360,height:800});
  await testViewport('mobile',{width:390,height:844});
  await testViewport('mobile-large',{width:430,height:932});
  await testSignedInMobile();
  await browser.close();
  browser=await webkit.launch({headless:true});
  await testViewport('webkit-mobile',{width:390,height:844});
  await testSignedInMobile();
}finally{
  await browser.close();
}
