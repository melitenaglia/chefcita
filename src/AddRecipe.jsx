import React,{useEffect,useState} from 'react';
import {X,Link as LinkIcon,PenLine,Sparkles,BookmarkPlus,ClipboardPaste,Trash2} from 'lucide-react';
import {supabase} from './supabase.js';

function isInstagramRecipeUrl(value){
 try{
  const url=new URL(value);
  const host=url.hostname.toLowerCase();
  const validHost=host==='instagram.com'||host==='www.instagram.com';
  const path=url.pathname.toLowerCase();
  return url.protocol==='https:'&&validHost&&(path.startsWith('/reel/')||path.startsWith('/p/')||path.startsWith('/tv/'));
 }catch{return false}
}

export default function AddRecipe({session,onClose,onSaved}){
 const [mode,setMode]=useState('link');
 const [sourceUrl,setSourceUrl]=useState('');
 const [pastedContent,setPastedContent]=useState('');
 const [importStrategy,setImportStrategy]=useState('smart');
 const [aiScope,setAiScope]=useState('quick');
 const [hintTitle,setHintTitle]=useState('');
 const [selectedTags,setSelectedTags]=useState([]);
 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [category,setCategory]=useState('');
 const [mealType,setMealType]=useState('');
 const [level,setLevel]=useState('');
 const [minutes,setMinutes]=useState('');
 const [categories,setCategories]=useState([]);
 const [mealTypes,setMealTypes]=useState([]);
 const [tags,setTags]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [pendingImportId,setPendingImportId]=useState(null);
 const [importStage,setImportStage]=useState('');
 const [importMessage,setImportMessage]=useState('');

 useEffect(()=>{
  Promise.all([
   supabase.from('categories').select('id,name').order('sort_order'),
   supabase.from('meal_types').select('id,name').order('sort_order'),
   supabase.from('tags').select('id,name').order('sort_order')
  ]).then(([c,m,t])=>{
   setCategories(c.data||[]);
   setMealTypes(m.data||[]);
   setTags(t.data||[]);
  });
 },[]);

 const getHousehold=async()=>{
  const {data}=await supabase.from('household_members').select('household_id').eq('user_id',session.user.id).limit(1).maybeSingle();
  return data?.household_id||null;
 };

 const toggleTag=name=>{
  setSelectedTags(list=>list.includes(name)?list.filter(x=>x!==name):[...list,name]);
 };

 const finishImportResponse=(importId,response)=>{
  const status=response?.status||'';
  if(status==='processed'||status==='processed_without_ai'){
   setBusy(false);
   onSaved('Por validar');
   return true;
  }
  if(status==='needs_input'){
   setPendingImportId(importId);
   setImportStage('needs_input');
   setImportMessage('Instagram no pudo entregar el caption. Pegalo acá y seguimos desde esta misma pantalla; todavía no se usó IA.');
   setBusy(false);
   return true;
  }
  if(status==='needs_choice'){
   setPendingImportId(importId);
   setImportStage('needs_choice');
   setImportMessage('El texto parece incompleto para una receta. Chefcita frenó antes de gastar IA. Elegí cómo seguir.');
   setBusy(false);
   return true;
  }
  if(status==='ready_for_ai'){
   setPendingImportId(importId);
   setImportStage('error');
   setImportMessage('El contenido está listo, pero la IA no está disponible en este momento.');
   setBusy(false);
   return true;
  }
  return false;
 };

 const invokeImport=async(importId,extra={})=>{
  const {data,error:invokeError}=await supabase.functions.invoke('process-recipe-import',{body:{import_id:importId,...extra}});
  if(invokeError){
   setPendingImportId(importId);
   setImportStage('error');
   setImportMessage('La importación quedó guardada, pero no pude terminar el procesamiento. Podés reintentar sin volver a crearla.');
   setError(invokeError.message);
   setBusy(false);
   return;
  }
  if(!finishImportResponse(importId,data)){
   setPendingImportId(importId);
   setImportStage('error');
   setImportMessage('La importación quedó guardada. Podés reintentarla desde acá.');
   setBusy(false);
  }
 };

 const queueImport=async e=>{
  e.preventDefault();
  const url=sourceUrl.trim();
  if(!url)return;
  if(!isInstagramRecipeUrl(url)){
   setError('Pegá un enlace válido de un Reel o post de Instagram.');
   return;
  }
  if(importStrategy==='manual'&&!hintTitle.trim()){
   setError('Para guardar sin IA, poné un nombre para reconocer la receta después.');
   return;
  }

  setBusy(true);setError('');setImportMessage('');
  const householdId=await getHousehold();
  const {data,error:insertError}=await supabase.from('imports').insert({
   user_id:session.user.id,
   household_id:householdId,
   source_type:'instagram',
   source_url:url,
   pasted_content:pastedContent.trim()||null,
   status:'queued',
   processing_mode:importStrategy,
   ai_scope:aiScope,
   user_hints:{
    title:hintTitle.trim()||null,
    tags:selectedTags
   }
  }).select('id').single();

  if(insertError){setBusy(false);setError(insertError.message);return}
  setPendingImportId(data.id);
  await invokeImport(data.id);
 };

 const continueWithCaption=async e=>{
  e?.preventDefault();
  if(!pendingImportId||!pastedContent.trim())return;
  setBusy(true);setError('');
  const {error:updateError}=await supabase.from('imports').update({
   pasted_content:pastedContent.trim(),
   status:'queued',
   needs_input:false,
   input_message:null,
   error_message:null,
   content_quality:'unknown',
   content_score:0
  }).eq('id',pendingImportId);
  if(updateError){setBusy(false);setError(updateError.message);return}
  await invokeImport(pendingImportId);
 };

 const forceAi=async()=>{
  if(!pendingImportId)return;
  setBusy(true);setError('');
  await invokeImport(pendingImportId,{force_ai:true});
 };

 const savePendingWithoutAi=async()=>{
  if(!pendingImportId)return;
  const fallbackTitle=hintTitle.trim()||'Receta para completar';
  setBusy(true);setError('');
  const {error:updateError}=await supabase.from('imports').update({
   processing_mode:'manual',
   user_hints:{title:fallbackTitle,tags:selectedTags},
   status:'queued',
   needs_input:false,
   error_message:null
  }).eq('id',pendingImportId);
  if(updateError){setBusy(false);setError(updateError.message);return}
  await invokeImport(pendingImportId);
 };

 const retryImport=async()=>{
  if(!pendingImportId)return;
  setBusy(true);setError('');
  await invokeImport(pendingImportId);
 };

 const discardPending=async()=>{
  if(!pendingImportId)return;
  setBusy(true);setError('');
  const {error:deleteError}=await supabase.from('imports').delete().eq('id',pendingImportId);
  setBusy(false);
  if(deleteError){setError(deleteError.message);return}
  setPendingImportId(null);setImportStage('');setImportMessage('');
 };

 const pasteClipboard=async()=>{
  try{
   const text=await navigator.clipboard.readText();
   if(text)setPastedContent(text);
  }catch{
   setError('El navegador no permitió leer el portapapeles. Podés pegar el texto manualmente.');
  }
 };

 const saveManual=async e=>{
  e.preventDefault();
  if(!title.trim())return;
  setBusy(true);setError('');
  const householdId=await getHousehold();
  const {data,error:saveError}=await supabase.from('recipes').insert({
   owner_id:session.user.id,
   household_id:householdId,
   title:title.trim(),
   description:description.trim()||null,
   category_id:category||null,
   meal_type_id:mealType||null,
   level:level||null,
   total_minutes:minutes?Number(minutes):null,
   review_status:'recipe',
   visibility:householdId?'household':'private'
  }).select('id').single();

  if(saveError){setBusy(false);setError(saveError.message);return}

  const {error:sourceError}=await supabase.from('recipe_sources').insert({
   recipe_id:data.id,source_type:'manual',is_primary:true
  });
  if(sourceError){setBusy(false);setError(sourceError.message);return}

  const tagIds=tags.filter(t=>selectedTags.includes(t.name)).map(t=>t.id);
  if(tagIds.length){
   const {error:tagError}=await supabase.from('recipe_tags').insert(tagIds.map(tag_id=>({recipe_id:data.id,tag_id})));
   if(tagError){setBusy(false);setError(tagError.message);return}
  }

  setBusy(false);
  onSaved('Recetas');
 };

 const linkSubmit=pendingImportId&&importStage==='needs_input'?continueWithCaption:queueImport;

 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <form className="recipe-form" onSubmit={mode==='manual'?saveManual:linkSubmit}>
   <div className="form-head"><div><small>NUEVA RECETA</small><h2>Añadir receta</h2></div><button type="button" onClick={onClose}><X/></button></div>

   <div className="add-modes">
    <button type="button" disabled={Boolean(pendingImportId)} className={mode==='link'?'active':''} onClick={()=>{setMode('link');setError('')}}><LinkIcon/>Desde Instagram</button>
    <button type="button" disabled={Boolean(pendingImportId)} className={mode==='manual'?'active':''} onClick={()=>{setMode('manual');setError('')}}><PenLine/>Manual</button>
   </div>

   {mode==='link'?<>
    <label>Enlace del Reel o post *<input autoFocus disabled={Boolean(pendingImportId)} type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://www.instagram.com/reel/..."/></label>

    {!pendingImportId&&<>
     <div className="strategy-title"><b>¿Qué querés que haga Chefcita?</b><small>Podés decidir cuánto usar IA antes de guardar.</small></div>
     <div className="strategy-grid">
      <button type="button" className={importStrategy==='smart'?'strategy-card active':'strategy-card'} onClick={()=>setImportStrategy('smart')}>
       <Sparkles/><span><b>Ahorro inteligente</b><small>Primero revisa gratis el caption. Solo usa OpenAI si detecta suficiente receta.</small></span>
      </button>
      <button type="button" className={importStrategy==='manual'?'strategy-card active':'strategy-card'} onClick={()=>setImportStrategy('manual')}>
       <BookmarkPlus/><span><b>Guardar sin IA</b><small>0 tokens. Guarda el link, nombre y etiquetas para que la completes después.</small></span>
      </button>
     </div>

     {importStrategy==='smart'&&<>
      <div className="scope-title"><b>¿Qué querés sacar del caption?</b><small>Para Reels, Ficha rápida suele ser suficiente y usa menos salida de IA.</small></div>
      <div className="scope-grid">
       <button type="button" className={aiScope==='quick'?'scope-card active':'scope-card'} onClick={()=>setAiScope('quick')}>
        <span><b>Ficha rápida · recomendada</b><small>Nombre, ingredientes, categoría, tipo, nivel y etiquetas. No transcribe los pasos.</small></span>
       </button>
       <button type="button" className={aiScope==='full'?'scope-card active':'scope-card'} onClick={()=>setAiScope('full')}>
        <span><b>Receta completa</b><small>También intenta estructurar pasos, tiempos y demás datos que estén escritos.</small></span>
       </button>
      </div>
     </>}

     <label>Nombre {importStrategy==='manual'?'*':'(opcional)'}<input value={hintTitle} onChange={e=>setHintTitle(e.target.value)} placeholder="Ej. Pasta cremosa del Reel"/></label>

     <div className="tag-field">
      <span>Etiquetas <small>Opcionales</small></span>
      <div className="tag-picker">{tags.map(tag=><button type="button" key={tag.id} className={selectedTags.includes(tag.name)?'tag-chip selected':'tag-chip'} onClick={()=>toggleTag(tag.name)}>{tag.name}</button>)}</div>
     </div>
    </>}

    {importStrategy==='smart'&&<label className={importStage==='needs_input'?'caption-required':''}>
     <span className="caption-label">Texto de la publicación <small>{pendingImportId?'Necesario para continuar':'Opcional'}</small><button type="button" className="paste-caption" onClick={pasteClipboard}><ClipboardPaste/>Pegar portapapeles</button></span>
     <textarea value={pastedContent} onChange={e=>setPastedContent(e.target.value)} placeholder="Pegá acá el caption o la receta escrita..."/>
    </label>}

    {importMessage&&<div className={'inline-import-state '+importStage}><b>{importStage==='needs_input'?'Falta el caption':importStage==='needs_choice'?'Antes de gastar IA':'Importación pendiente'}</b><p>{importMessage}</p></div>}

    {!pendingImportId&&<div className="import-note strong">
     {importStrategy==='smart'
      ?'Chefcita intenta leer Instagram gratis. Si no puede, te pide el caption acá mismo. '+(aiScope==='quick'?'Si hay contenido suficiente, extrae principalmente ingredientes y clasificación.':'Si hay contenido suficiente, estructura la receta completa.')
      :'Se crea una receta para revisar manualmente. No se hace ninguna llamada a OpenAI.'}
    </div>}

    {pendingImportId&&importStage==='needs_choice'&&<div className="inline-choice-actions">
     <button type="button" disabled={busy} onClick={forceAi}><Sparkles/>Procesar igual con IA</button>
     <button type="button" disabled={busy} onClick={savePendingWithoutAi}><BookmarkPlus/>Guardar para completar · 0 IA</button>
    </div>}

    {pendingImportId&&importStage==='error'&&<div className="inline-choice-actions"><button type="button" disabled={busy} onClick={retryImport}>Reintentar</button></div>}
   </>:<>
    <label>Título *<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej. Pasta cremosa de calabaza"/></label>
    <label>Descripción<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Una descripción breve"/></label>
    <div className="form-grid">
     <label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Sin definir</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
     <label>Tipo de comida<select value={mealType} onChange={e=>setMealType(e.target.value)}><option value="">Sin definir</option>{mealTypes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    </div>
    <div className="form-grid">
     <label>Nivel<select value={level} onChange={e=>setLevel(e.target.value)}><option value="">Sin definir</option><option value="initial">Inicial</option><option value="intermediate">Intermedio</option><option value="expert">Experto</option></select></label>
     <label>Tiempo total (min)<input type="number" min="0" value={minutes} onChange={e=>setMinutes(e.target.value)} placeholder="Ej. 30"/></label>
    </div>
    <div className="tag-field">
     <span>Etiquetas <small>Opcionales</small></span>
     <div className="tag-picker">{tags.map(tag=><button type="button" key={tag.id} className={selectedTags.includes(tag.name)?'tag-chip selected':'tag-chip'} onClick={()=>toggleTag(tag.name)}>{tag.name}</button>)}</div>
    </div>
   </>}

   {error&&<p className="message">{error}</p>}
   <div className="form-actions">
    {pendingImportId?<button type="button" className="cancel discard-import" onClick={discardPending} disabled={busy}><Trash2/>Descartar</button>:<button type="button" className="cancel" onClick={onClose}>Cancelar</button>}
    {mode==='link'&&pendingImportId&&importStage==='needs_input'?<button className="primary save-recipe" disabled={busy||!pastedContent.trim()}>{busy?'Procesando...':'Procesar este texto'}</button>
    :mode==='link'&&pendingImportId?<button type="button" className="primary save-recipe" onClick={onClose}>Cerrar y dejar pendiente</button>
    :<button className="primary save-recipe" disabled={busy||(mode==='link'?(!sourceUrl.trim()||(importStrategy==='manual'&&!hintTitle.trim())):!title.trim())}>
     {busy?'Guardando...':mode==='link'?(importStrategy==='manual'?'Guardar para completar':'Guardar e intentar importar'):'Guardar receta'}
    </button>}
   </div>
  </form>
 </div>;
}
