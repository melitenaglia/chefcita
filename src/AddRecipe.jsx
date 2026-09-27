import React,{useEffect,useState} from 'react';
import {X,Link as LinkIcon,PenLine,Sparkles,BookmarkPlus,ClipboardPaste,Trash2,LoaderCircle,CheckCircle2,ChevronDown} from 'lucide-react';
import {supabase} from './supabase.js';

function normalizeInstagramRecipeUrl(value){
 try{
  const url=new URL(value);
  const host=url.hostname.toLowerCase();
  const validHost=host==='instagram.com'||host==='www.instagram.com';
  if(url.protocol!=='https:'||!validHost)return '';
  let path=url.pathname;
  if(path.toLowerCase().startsWith('/reels/'))path='/reel/'+path.slice('/reels/'.length);
  const lower=path.toLowerCase();
  if(!(lower.startsWith('/reel/')||lower.startsWith('/p/')||lower.startsWith('/tv/')))return '';
  return url.origin+path;
 }catch{return ''}
}

function isInstagramRecipeUrl(value){
 return Boolean(normalizeInstagramRecipeUrl(value));
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
   setImportMessage('No pude leer todo el texto desde Instagram. Pegá acá el caption o la receta y seguimos desde esta misma pantalla.');
   setBusy(false);
   return true;
  }
  if(status==='needs_choice'){
   setPendingImportId(importId);
   setImportStage('needs_choice');
   setImportMessage('El texto parece incompleto. Chefcita frenó antes de gastar IA para que decidas cómo seguir.');
   setBusy(false);
   return true;
  }
  if(status==='ready_for_ai'){
   setPendingImportId(importId);
   setImportStage('error');
   setImportMessage('La receta quedó guardada, pero la IA no está disponible en este momento.');
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
   setImportMessage('La receta quedó guardada, pero no pude terminar el procesamiento. Podés reintentar sin volver a cargarla.');
   setError(invokeError.message);
   setBusy(false);
   return;
  }
  if(!finishImportResponse(importId,data)){
   setPendingImportId(importId);
   setImportStage('error');
   setImportMessage('La receta quedó guardada. Podés reintentar desde acá.');
   setBusy(false);
  }
 };

 const queueImport=async e=>{
  e.preventDefault();
  const rawUrl=sourceUrl.trim();
  if(!rawUrl)return;
  if(!isInstagramRecipeUrl(rawUrl)){
   setError('Ese enlace no parece ser un Reel o post de Instagram. Volvé a Instagram, tocá Compartir → Copiar enlace y pegalo acá.');
   return;
  }
  const url=normalizeInstagramRecipeUrl(rawUrl);
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
   setError('El navegador no permitió leer el portapapeles. Mantené pulsado dentro del cuadro y elegí Pegar.');
  }
 };

 const pasteInstagramLink=async()=>{
  setError('');
  try{
   const text=(await navigator.clipboard.readText()).trim();
   if(!text)return;
   if(!isInstagramRecipeUrl(text)){
    setError('Lo que hay copiado no parece ser un enlace de Instagram. En Instagram tocá Compartir → Copiar enlace.');
    return;
   }
   setSourceUrl(text);
  }catch{
   setError('No pude leer el portapapeles. Mantené pulsado dentro del campo y elegí Pegar.');
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
 const linkReady=isInstagramRecipeUrl(sourceUrl);

 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
  <form className="recipe-form add-recipe-form" onSubmit={mode==='manual'?saveManual:linkSubmit}>
   <div className="form-head"><div><small>NUEVA RECETA</small><h2>{mode==='link'?'Añadir desde Instagram':'Añadir manualmente'}</h2></div><button type="button" disabled={busy} onClick={onClose}><X/></button></div>

   <div className="add-modes">
    <button type="button" disabled={Boolean(pendingImportId)||busy} className={mode==='link'?'active':''} onClick={()=>{setMode('link');setError('')}}><LinkIcon/><span>Instagram</span></button>
    <button type="button" disabled={Boolean(pendingImportId)||busy} className={mode==='manual'?'active':''} onClick={()=>{setMode('manual');setError('')}}><PenLine/><span>Cargar a mano</span></button>
   </div>

   {mode==='link'?<>
    {!pendingImportId&&<div className="instagram-guide" aria-label="Cómo añadir una receta desde Instagram">
     <div><span>1</span><p>En Instagram tocá <b>Compartir</b> y después <b>Copiar enlace</b>.</p></div>
     <div><span>2</span><p>Volvé a Chefcita y tocá <b>Pegar enlace</b>.</p></div>
    </div>}

    <label className="instagram-link-field">
     <span>Enlace de Instagram</span>
     <div className="instagram-link-row">
      <input autoFocus disabled={Boolean(pendingImportId)||busy} type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" value={sourceUrl} onChange={e=>{setSourceUrl(e.target.value);setError('')}} placeholder="Pegá acá el enlace del Reel"/>
      {!pendingImportId&&<button type="button" className="paste-link" disabled={busy} onClick={pasteInstagramLink}><ClipboardPaste/>Pegar enlace</button>}
     </div>
    </label>

    {!pendingImportId&&linkReady&&<div className="link-ready"><CheckCircle2/><span>Enlace listo. Ya podés importar la receta.</span></div>}

    {!pendingImportId&&<details className="advanced-import">
     <summary><span>Opciones de importación <small>No hace falta tocar esto</small></span><ChevronDown/></summary>
     <div className="advanced-import-content">
      <div className="strategy-title"><b>Procesamiento</b><small>“Ahorro inteligente” es la opción recomendada.</small></div>
      <div className="strategy-grid">
       <button type="button" className={importStrategy==='smart'?'strategy-card active':'strategy-card'} onClick={()=>setImportStrategy('smart')}>
        <Sparkles/><span><b>Ahorro inteligente</b><small>Lee el caption y usa IA solo si hace falta.</small></span>
       </button>
       <button type="button" className={importStrategy==='manual'?'strategy-card active':'strategy-card'} onClick={()=>setImportStrategy('manual')}>
        <BookmarkPlus/><span><b>Guardar sin IA</b><small>Guarda el enlace para completar después.</small></span>
       </button>
      </div>

      {importStrategy==='smart'&&<>
       <div className="scope-title"><b>Nivel de detalle</b><small>Ficha rápida alcanza para la mayoría de los Reels.</small></div>
       <div className="scope-grid">
        <button type="button" className={aiScope==='quick'?'scope-card active':'scope-card'} onClick={()=>setAiScope('quick')}><span><b>Ficha rápida · recomendada</b><small>Ingredientes y clasificación; menos consumo.</small></span></button>
        <button type="button" className={aiScope==='full'?'scope-card active':'scope-card'} onClick={()=>setAiScope('full')}><span><b>Receta completa</b><small>También intenta extraer pasos y tiempos escritos.</small></span></button>
       </div>
      </>}

      <label>Nombre {importStrategy==='manual'?'*':'(opcional)'}<input value={hintTitle} onChange={e=>setHintTitle(e.target.value)} placeholder="Ej. Pasta cremosa"/></label>

      {importStrategy==='smart'&&<label>
       <span className="caption-label">¿Ya tenés el texto de la receta? <small>Opcional</small><button type="button" className="paste-caption" onClick={pasteClipboard}><ClipboardPaste/>Pegar</button></span>
       <textarea value={pastedContent} onChange={e=>setPastedContent(e.target.value)} placeholder="Podés pegar acá el caption, ingredientes o pasos..."/>
      </label>}

      <div className="tag-field">
       <span>Etiquetas <small>Opcionales</small></span>
       <div className="tag-picker">{tags.map(tag=><button type="button" key={tag.id} className={selectedTags.includes(tag.name)?'tag-chip selected':'tag-chip'} onClick={()=>toggleTag(tag.name)}>{tag.name}</button>)}</div>
      </div>
     </div>
    </details>}

    {pendingImportId&&importStage==='needs_input'&&<div className="caption-recovery">
     <div><Sparkles/><span><b>Me falta el texto de la receta</b><small>Copiá el caption o el comentario con la receta y pegalo acá. No necesitás empezar de nuevo.</small></span></div>
     <button type="button" className="paste-caption-large" onClick={pasteClipboard}><ClipboardPaste/>Pegar texto copiado</button>
     <textarea autoFocus value={pastedContent} onChange={e=>setPastedContent(e.target.value)} placeholder="Pegá acá la receta..."/>
    </div>}

    {importMessage&&<div className={'inline-import-state '+importStage}><b>{importStage==='needs_input'?'Necesito un dato más':importStage==='needs_choice'?'Antes de gastar IA':'Importación pendiente'}</b><p>{importMessage}</p></div>}

    {pendingImportId&&importStage==='needs_choice'&&<div className="inline-choice-actions">
     <button type="button" disabled={busy} onClick={forceAi}><Sparkles/>Procesar igual con IA</button>
     <button type="button" disabled={busy} onClick={savePendingWithoutAi}><BookmarkPlus/>Guardar para completar</button>
    </div>}

    {pendingImportId&&importStage==='error'&&<div className="inline-choice-actions"><button type="button" disabled={busy} onClick={retryImport}>Reintentar</button></div>}
   </>:<>
    <div className="manual-intro"><b>Completá solo lo que sepas.</b><span>Después podés editar la receta cuando quieras.</span></div>
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

   {busy&&<div className="import-working" role="status" aria-live="polite"><LoaderCircle className="spin"/><span><b>{pendingImportId?'Chefcita está procesando el texto...':'Chefcita está buscando la receta...'}</b><small>Puede tardar unos segundos. No cierres ni actualices la pantalla.</small></span></div>}
   {error&&<p className="message form-error">{error}</p>}

   <div className="form-actions">
    {pendingImportId?<button type="button" className="cancel discard-import" onClick={discardPending} disabled={busy}><Trash2/>Descartar</button>:<button type="button" className="cancel" disabled={busy} onClick={onClose}>Cancelar</button>}
    {mode==='link'&&pendingImportId&&importStage==='needs_input'?<button className="primary save-recipe" disabled={busy||!pastedContent.trim()}>{busy?'Procesando...':'Continuar con este texto'}</button>
    :mode==='link'&&pendingImportId?<button type="button" className="primary save-recipe" onClick={onClose} disabled={busy}>Cerrar y dejar pendiente</button>
    :<button className="primary save-recipe" disabled={busy||(mode==='link'?(!linkReady||(importStrategy==='manual'&&!hintTitle.trim())):!title.trim())}>
     {busy?'Procesando...':mode==='link'?(importStrategy==='manual'?'Guardar para después':'Importar receta'):'Guardar receta'}
    </button>}
   </div>
  </form>
 </div>;
}
