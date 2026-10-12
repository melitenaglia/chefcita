import { chromium,webkit } from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

let browser=await chromium.launch({headless:true});

async function testViewport(name,viewport){
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error'&&!(name.startsWith('webkit-')&&m.text()==='Viewport argument key "interactive-widget" not recognized and ignored.'))errors.push('console: '+m.text())});
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
 const sharedItems=[],sharedStores=[],storePreferences=new Map();let homeFail=false;
 const testToken=[{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'test-signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
 await page.addInitScript(({uid,testToken})=>{
  localStorage.setItem('sb-yfhiqdpohixsvzuudivw-auth-token',JSON.stringify({access_token:testToken,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:uid,email:'test@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{}}}));
 },{uid,testToken});
 const ownRecipe={id:recipeId,owner_id:uid,title:'Receta propia de prueba',created_at:'2026-10-12T10:00:00Z',review_status:'recipe',recipe_library_shares:[],servings:2,recipe_ingredients:[{id:'ingredient-1',original_name:'Arroz',quantity:200,quantity_text:'200',unit:'g',sort_order:1},{id:'ingredient-2',original_name:'Sal',quantity_text:'al gusto',sort_order:2}],recipe_tags:[],recipe_steps:[{id:'step-1',step_number:1,instruction:'Cociná el arroz.'},{id:'step-2',step_number:2,instruction:'Serví y disfrutá.'}],recipe_sources:[{source_url:'https://www.instagram.com/p/test/',is_primary:true,original_copy:'Texto original de prueba.'}],user_recipes:[]};
 const sharedRecipe={...ownRecipe,id:'44444444-4444-4444-8444-444444444444',owner_id:'other-user',title:'Receta de Sofi',recipe_library_shares:[{household_id:libraryId,households:{name:'Con Sofi'}}]};
 await page.route('https://*.supabase.co/**',async route=>{
  const url=new URL(route.request().url());
  const table=url.pathname.split('/').pop();let data=[];
  if(table==='user')data={id:uid,email:'test@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{}};
  if(table==='household_members'){data=[{household_id:libraryId,user_id:uid,role:'member',joined_at:'2026-10-12',profiles:{display_name:'Melisa'}},{household_id:libraryId,user_id:'other-user',role:'member',profiles:{display_name:'Sofi'}}];if(url.searchParams.has('user_id'))data=data.filter(x=>x.user_id===uid)};
  if(table==='households')data=[{id:libraryId,name:'Con Sofi',created_by:uid}];
  if(table==='recipes'&&homeFail&&url.searchParams.get('limit')==='4'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Test unavailable'})});return}
  if(table==='recipes'){if(route.request().method()==='PATCH')Object.assign(ownRecipe,route.request().postDataJSON());data=route.request().headers().accept?.includes('object')?ownRecipe:[ownRecipe,sharedRecipe]};
  if(table==='recover-recipe-photo')data=route.request().postDataJSON()?.batch?{updates:[],failed:[],scanned:0}:{image_url:`https://yfhiqdpohixsvzuudivw.supabase.co/storage/v1/object/public/recipe-thumbnails/${uid}/recovered.jpg`};
  if(url.pathname.includes('/storage/v1/object/')&&route.request().method()==='POST')data={Key:'uploaded'};
  if(url.pathname.includes('/storage/v1/object/')&&route.request().method()==='GET'){await route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGOs2NLEwMDAxMDAwMDAAAAUSAGyF1ko3gAAAABJRU5ErkJggg==','base64')});return}
  if(table==='recipe_library_shares')data=[ownRecipe,sharedRecipe].filter(r=>!url.searchParams.has('recipe_id')||url.searchParams.get('recipe_id')===`eq.${r.id}`).flatMap(r=>r.recipe_library_shares.map(x=>({...x,recipe_id:r.id,recipes:r})));
  if(table==='categories')data=[{id:libraryId,name:'Merienda'}];
  if(table==='household_shopping_items'){
   const id=url.searchParams.get('id')?.replace('eq.','');
   if(route.request().method()==='PATCH'){const row=sharedItems.find(r=>r.id===id);if(row)Object.assign(row,route.request().postDataJSON());data=row?{id:row.id}:null}
   else if(route.request().method()==='DELETE'){for(let i=sharedItems.length-1;i>=0;i--)if(sharedItems[i].id===id||url.searchParams.get('done')==='eq.true'&&sharedItems[i].done)sharedItems.splice(i,1);data=[]}
   else data=sharedItems;
  }
  if(table==='household_shopping_stores'){
   if(route.request().method()==='POST'){data={id:crypto.randomUUID(),name:route.request().postDataJSON().name};sharedStores.push(data)}else data=sharedStores;
  }
  if(table==='set_household_product_store'){const body=route.request().postDataJSON();storePreferences.set(body.p_product,body.p_store);data=null}
  if(table==='add_household_shopping_items'){
   const body=route.request().postDataJSON();
   for(const item of body.p_items){let row=sharedItems.find(r=>r.item_key===item.id);if(row){row.quantity=item.quantity;row.note=item.note;row.portions=item.portions}else sharedItems.push({id:crypto.randomUUID(),household_id:body.p_household,item_key:item.id,recipe_id:item.recipeId,recipe_title:item.recipeTitle,name:item.name,quantity:item.quantity||'',note:item.note||'',portions:item.portions,done:false,added_by:uid,store_id:storePreferences.get(item.productKey)||null})}
   data=body.p_items.length;
  }
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
  await page.getByRole('button',{name:'Opciones de Receta propia de prueba',exact:true}).click();
  await page.getByRole('button',{name:'Añadir a biblioteca',exact:true}).click();
  await page.locator('.share-library-list button').click();
  await page.locator('.share-library-list button.active').waitFor();
  if(shareCalls.length!==1||shareCalls[0].p_household_id!==libraryId||shareCalls[0].p_recipe_id!==recipeId||shareCalls[0].p_shared!==true)throw new Error('Share RPC used wrong destination');
  await page.locator('.share-panel').getByRole('button',{name:'Listo',exact:true}).click();
  if(await page.locator('.simple-recipe-row').getByRole('button',{name:'Añadir a biblioteca',exact:true}).count())throw new Error('Management action still fills recipe row');
  if(await page.locator('.recipe-quick-tabs').isVisible())throw new Error('Advanced state filters are not collapsed');
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  await page.getByRole('button',{name:'Favoritas',exact:true}).waitFor();
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  await page.emulateMedia({colorScheme:'dark'});
  await page.waitForFunction(()=>document.documentElement.dataset.appearance==='dark');
  const darkStyle=await page.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor,color:getComputedStyle(document.body).color,nav:[...document.querySelectorAll('.mobile-bottom-nav button')].map(x=>({active:x.classList.contains('active'),bg:getComputedStyle(x).backgroundColor}))}));
  if(darkStyle.bg!=='rgb(21, 24, 22)'||darkStyle.color!=='rgb(231, 235, 231)'||darkStyle.nav.some(x=>!x.active&&x.bg!=='rgba(0, 0, 0, 0)'))throw new Error('System dark mode or quiet navigation not applied');
  await page.screenshot({path:`artifacts/${browser.browserType().name()}-dark-list.png`});
  await page.locator('.mobile-menu-trigger').click();
  await page.locator('.drawer-group button').filter({hasText:'Configuración'}).click();
  await page.locator('.settings-submenu button').filter({hasText:'Pantalla'}).click();
  await page.locator('.appearance-options button').filter({hasText:'Claro'}).click();
  await page.waitForFunction(()=>document.documentElement.dataset.appearance==='light'&&localStorage.getItem('chefcita:appearance')==='light');
  await page.emulateMedia({colorScheme:'light'});
  await page.locator('.appearance-options button').filter({hasText:'Oscuro'}).click();
  await page.waitForFunction(()=>document.documentElement.dataset.appearance==='dark');
  await page.screenshot({path:`artifacts/${browser.browserType().name()}-dark-settings.png`});
  for(const theme of ['Salvia','Oliva','Tomate','Lavanda']){
   await page.locator('.theme-options button').filter({hasText:theme}).click();
   const colors=await page.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor,text:getComputedStyle(document.body).color}));
   if(colors.bg!=='rgb(21, 24, 22)'||colors.text!=='rgb(231, 235, 231)')throw new Error('Accent palette changed neutral dark surface');
  }
  await page.locator('.appearance-options button').filter({hasText:'Según el dispositivo'}).click();
  await page.waitForFunction(()=>document.documentElement.dataset.appearance==='light');
  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'Recetas',exact:true}).click();
  await page.getByRole('button',{name:'Abrir Receta propia de prueba',exact:true}).waitFor();
  const density=[];
  const engine=browser.browserType().name();
  for(const size of ['supercompact','compact','normal','large']){
   await page.evaluate(size=>{document.documentElement.dataset.uiSize=size;document.querySelector('.recipe-library').style.minHeight='2400px'},size);
   density.push(await page.evaluate(()=>({font:parseFloat(getComputedStyle(document.querySelector('.simple-recipe-copy>b')).fontSize),padding:parseFloat(getComputedStyle(document.querySelector('.simple-recipe-row')).paddingTop),thumb:parseFloat(getComputedStyle(document.querySelector('.mobile-menu-trigger')).height)})));
   await page.screenshot({path:`artifacts/${engine}-${size}.png`});
   const before=await page.locator('.mobile-bottom-nav').boundingBox();
   await page.evaluate(()=>document.querySelector('.content').scrollTo(0,1200));
   const after=await page.locator('.mobile-bottom-nav').boundingBox();
   if(Math.abs(before.y-after.y)>1||Math.abs(after.y+after.height-844)>1)throw new Error('Navigation moved during internal scroll: '+size);
   const state=await page.evaluate(()=>({contentScroll:document.querySelector('.content').scrollTop,documentScroll:window.scrollY,overflow:document.documentElement.scrollWidth>innerWidth,fonts:[...document.querySelectorAll('input,select,textarea')].map(x=>parseFloat(getComputedStyle(x).fontSize))}));
   if(state.contentScroll<100||state.documentScroll!==0||state.overflow||state.fonts.some(x=>x<16))throw new Error('Mobile scroll or zoom regression: '+size);
   await page.evaluate(()=>document.querySelector('.content').scrollTo(0,0));
  }
  for(let i=1;i<density.length;i++)if(density[i].font<=density[i-1].font||density[i].padding<10||density[i].thumb<density[i-1].thumb)throw new Error('Density changes only text, not layout');
  await page.evaluate(()=>document.documentElement.dataset.uiSize='supercompact');
  await page.getByRole('button',{name:'Abrir Receta propia de prueba',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Porciones',exact:true}).fill('4');
  await page.locator('.ingredient-quantity').filter({hasText:'400'}).waitFor();
  await page.getByRole('button',{name:'Cocinar esta receta',exact:true}).click();
  await page.setViewportSize({width:390,height:620});
  const footer=await page.locator('.cooking-footer').boundingBox();
  if(!footer||footer.y+footer.height>621)throw new Error('Cooking actions clipped on small phone');
  await page.locator('.cooking-checks button').first().click();
  if(await page.locator('.cooking-checks button[aria-pressed="true"]').count()!==1)throw new Error('Ingredient checklist failed');
  await page.getByRole('button',{name:'Empezar preparación',exact:true}).click();
  await page.locator('.cooking-mode').getByText('Cociná el arroz.',{exact:true}).waitFor();
  await page.screenshot({path:`artifacts/${engine}-cooking.png`});
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await page.locator('.cooking-mode').getByText('Serví y disfrutá.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Terminé',exact:true}).click();
  await page.getByText('¡Listo!',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Volver a la receta',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Añadir a la compra',exact:true}).click();
  await page.getByRole('button',{name:'Opciones de la receta',exact:true}).click();
  await page.getByRole('button',{name:'Recuperar foto original',exact:true}).click();
  await page.locator('.detail-image img').waitFor();
  await page.getByRole('button',{name:'Opciones de la receta',exact:true}).click();
  await page.getByRole('button',{name:'Cambiar foto desde galería',exact:true}).click();
  await page.locator('.photo-file-input').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGOs2NLEwMDAxMDAwMDAAAAUSAGyF1ko3gAAAABJRU5ErkJggg==','base64')});
  await page.getByText('Foto guardada.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Volver a recetas',exact:true}).click();
  ownRecipe.recipe_steps=[];
  await page.getByRole('button',{name:'Abrir Receta propia de prueba',exact:true}).click();
  await page.locator('.video-source-cta').waitFor();
  await page.emulateMedia({colorScheme:'dark'});
  await page.waitForFunction(()=>document.documentElement.dataset.appearance==='dark');
  const checkContrast=async selectors=>page.evaluate(selectors=>{
   const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
   const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   return selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length).map(el=>{
    let parent=el,bg='rgba(0, 0, 0, 0)';while(parent&&bg==='rgba(0, 0, 0, 0)'){bg=getComputedStyle(parent).backgroundColor;parent=parent.parentElement}
    const a=lum(rgb(getComputedStyle(el).color)),b=lum(rgb(bg));return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
   }));
  },selectors);
  let contrasts=await checkContrast(['.video-source-cta p','.video-source-cta a','.ingredient-quantity','.ingredient-list b','.detail-source>a','.detail-source summary']);
  if(contrasts.some(x=>x.ratio<4.5))throw new Error('Dark recipe contrast failed: '+JSON.stringify(contrasts));
  await page.locator('.recipe-detail').evaluate(el=>el.scrollTo(0,el.scrollHeight));
  await page.screenshot({path:`artifacts/${engine}-dark-detail.png`});
  await page.getByRole('button',{name:'Volver a recetas',exact:true}).click();
  await page.locator('.mobile-menu-trigger').click();
  await page.locator('.drawer-group button').filter({hasText:'Lista de compra'}).click();
  await page.locator('.shopping-item b').filter({hasText:'400'}).waitFor();
  await page.getByRole('button',{name:'Marcar comprado: Arroz',exact:true}).click();
  await page.getByRole('button',{name:'Quitar productos comprados',exact:true}).click();
  if(await page.locator('.shopping-item b').filter({hasText:'Arroz'}).count())throw new Error('Shopping clear purchased failed');
  await page.getByRole('textbox',{name:'Añadir un producto',exact:true}).fill('Leche');
  await page.locator('.shopping-add button').click();
  await page.screenshot({path:`artifacts/${engine}-shopping.png`});
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Lista de compra',exact:true}).click();
  await page.getByText('Leche',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Elegir tienda',exact:false}).last().click();
  await page.locator('.store-picker').getByRole('button',{name:'Aldi',exact:true}).click();
  await page.locator('.store-picker').waitFor({state:'detached'});
  await page.locator('.shopping-group h2').filter({hasText:'Aldi'}).waitFor();
  await page.getByRole('button',{name:'Compartir con casa',exact:true}).click();
  await page.getByRole('button',{name:'Compartir con Con Sofi',exact:true}).click();
  await page.locator('.shopping-members').filter({hasText:'Sofi'}).waitFor();
  await page.locator('.shopping-item b').filter({hasText:'Leche'}).waitFor();
  await page.locator('.shopping-item').filter({hasText:'Leche'}).getByRole('button',{name:'Elegir tienda',exact:false}).click();
  await page.locator('.store-picker').getByRole('button',{name:'Aldi',exact:true}).click();
  await page.locator('.store-picker').waitFor({state:'detached'});
  await page.getByRole('textbox',{name:'Añadir un producto',exact:true}).fill('Leche');
  await page.locator('.shopping-add button').click();
  await page.waitForFunction(()=>document.querySelectorAll('.shopping-group').length>=2);
  await page.waitForFunction(()=>[...document.querySelectorAll('.shopping-item b')].filter(el=>el.textContent==='Leche').length===2);
  const milk=sharedItems.filter(r=>r.name==='Leche');
  if(milk.length!==2||milk.some(r=>!r.store_id))throw new Error('Shared product did not remember its store');
  await page.getByRole('button',{name:'Por receta',exact:true}).click();
  await page.locator('.shopping-group h2').filter({hasText:'Receta propia de prueba'}).waitFor();
  await page.screenshot({path:`artifacts/${engine}-shared-shopping-recipes.png`});
  await page.getByRole('button',{name:'Por tienda',exact:true}).click();
  await page.screenshot({path:`artifacts/${engine}-shared-shopping-stores.png`});
  await page.getByRole('combobox',{name:'Lista de compra',exact:true}).selectOption('');
  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'Sugerime una receta',exact:true}).click();
  await page.getByRole('combobox',{name:'Tipo de comida',exact:true}).selectOption('Merienda');
  await page.getByRole('button',{name:'Dame una idea',exact:true}).click();
  await page.getByRole('button',{name:'Ver receta',exact:true}).waitFor();
  await page.locator('.content').evaluate(el=>el.scrollTo(0,el.scrollHeight));
  const ideaAction=await page.getByRole('button',{name:'Ver receta',exact:true}).boundingBox();
  const navBox=await page.locator('.mobile-bottom-nav').boundingBox();
  if(ideaAction.y+ideaAction.height>navBox.y)throw new Error('Idea actions clipped by navigation');
  await page.screenshot({path:`artifacts/${engine}-ideas.png`});
  homeFail=true;
  await page.locator('.mobile-bottom-nav').getByRole('button',{name:'Inicio',exact:true}).click();
  await page.locator('.home-empty').getByRole('button',{name:'Volver a intentar',exact:true}).waitFor();
  contrasts=await checkContrast(['.home-empty p','.home-empty button']);
  if(contrasts.some(x=>x.ratio<4.5))throw new Error('Dark home error contrast failed: '+JSON.stringify(contrasts));
  await page.screenshot({path:`artifacts/${engine}-home-unavailable.png`});
  homeFail=false;


  await page.locator('.mobile-menu-trigger').click();
  await page.locator('.drawer-group button').filter({hasText:'Guardar receta'}).click();
  contrasts=await checkContrast(['.instagram-guide p','.simple-import-paste']);
  if(contrasts.some(x=>x.ratio<4.5))throw new Error('Dark import contrast failed: '+JSON.stringify(contrasts));
  await page.screenshot({path:`artifacts/${engine}-dark-import.png`});
  await page.locator('.form-head>button').click();
  await page.locator('.mobile-menu-trigger').click();
  await page.locator('.drawer-group button').filter({hasText:'Bibliotecas'}).click();
  await page.locator('.playlist-card').filter({hasText:'Con Sofi'}).click();
  await page.getByRole('button',{name:'Opciones de Receta propia de prueba',exact:true}).click();
  await page.getByRole('button',{name:'Quitar de esta biblioteca',exact:true}).click();
  await page.locator('.recipe-actions-sheet').waitFor({state:'detached'});
  await page.locator('.simple-recipe-list').getByText('Receta propia de prueba',{exact:true}).waitFor({state:'detached'});
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
  await page.screenshot({path:`artifacts/${engine}-review-large.png`});
  console.log('Signed-in mobile density, playlists and non-sticky review actions OK');
 }catch(error){console.error('Signed-in test DOM:',await page.locator('body').innerText());throw error}finally{await page.close()}
}

async function testOfflineShopping(){
 // Playwright WebKit kills even cached requests with setOffline (#42775).
 // Stop a dedicated origin instead to exercise the real service-worker fallback.
 const isWebKit=browser.browserType().name()==='webkit';
 const preview=isWebKit?spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4180'],{stdio:'ignore'}):null;
 const base=isWebKit?'http://127.0.0.1:4180/':'http://127.0.0.1:4173/';
 if(preview){let ready=false;for(let i=0;i<30;i++){try{ready=(await fetch(base)).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,200))}if(!ready){preview.kill();throw new Error('Dedicated offline origin failed')}}
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
 const page=await context.newPage();
 await page.addInitScript(()=>{localStorage.setItem('chefcita:shopping:last-user','offline-test');localStorage.setItem('chefcita:shopping:offline-test',JSON.stringify([{id:'1',name:'Pan',quantity:'',done:false}]))});
 try{
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(async()=>{if(!await caches.match('/'))throw new Error('App shell not cached')});
  if(preview){await context.addInitScript(()=>Object.defineProperty(Navigator.prototype,'onLine',{get:()=>false,configurable:true}));const exited=once(preview,'exit');preview.kill();await exited}else await context.setOffline(true);
  const response=await page.reload({waitUntil:'domcontentloaded'});
  if(!response?.fromServiceWorker())throw new Error('Offline navigation was not served by the cached worker');
  await page.getByText('Sin conexión · lista guardada en este dispositivo',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Marcar comprado: Pan',exact:true}).click();
  await page.getByRole('button',{name:'Volver a pendiente: Pan',exact:true}).waitFor();
  console.log('Shopping app shell and saved products work offline');
 }finally{await context.close();if(preview&&preview.exitCode===null)preview.kill()}
}

try{
  await testViewport('desktop',{width:1280,height:900});
  await testViewport('mobile-small',{width:360,height:800});
  await testViewport('mobile',{width:390,height:844});
  await testViewport('mobile-large',{width:430,height:932});
  await testSignedInMobile();
  await testOfflineShopping();
  await browser.close();
  browser=await webkit.launch({headless:true});
  await testViewport('webkit-mobile',{width:390,height:844});
  await testSignedInMobile();
  await testOfflineShopping();
}finally{
  await browser.close();
}
