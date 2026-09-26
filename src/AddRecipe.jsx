import React,{useEffect,useState} from 'react';
import {X,Link as LinkIcon,PenLine,Sparkles,BookmarkPlus} from 'lucide-react';
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

  setBusy(true);setError('');
  const householdId=await getHousehold();
  const {data,error:insertError}=await supabase.from('imports').insert({
   user_id:session.user.id,
   household_id:householdId,
   source_type:'instagram',
   source_url:url,
   pasted_content:pastedContent.trim()||null,
   status:'queued',
   processing_mode:importStrategy,
   user_hints:{
    title:hintTitle.trim()||null,
    tags:selectedTags
   }
  }).select('id').single();

  if(insertError){setBusy(false);setError(insertError.message);return}

  await supabase.functions.invoke('process-recipe-import',{body:{import_id:data.id}});
  setBusy(false);
  onSaved('Pendientes');
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

 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <form className="recipe-form" onSubmit={mode==='manual'?saveManual:queueImport}>
   <div className="form-head"><div><small>NUEVA RECETA</small><h2>Añadir receta</h2></div><button type="button" onClick={onClose}><X/></button></div>

   <div className="add-modes">
    <button type="button" className={mode==='link'?'active':''} onClick={()=>{setMode('link');setError('')}}><LinkIcon/>Desde Instagram</button>
    <button type="button" className={mode==='manual'?'active':''} onClick={()=>{setMode('manual');setError('')}}><PenLine/>Manual</button>
   </div>

   {mode==='link'?<>
    <label>Enlace del Reel o post *<input autoFocus type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://www.instagram.com/reel/..."/></label>

    <div className="strategy-title"><b>¿Qué querés que haga Chefcita?</b><small>Podés decidir cuánto usar IA antes de guardar.</small></div>
    <div className="strategy-grid">
     <button type="button" className={importStrategy==='smart'?'strategy-card active':'strategy-card'} onClick={()=>setImportStrategy('smart')}>
      <Sparkles/><span><b>Ahorro inteligente</b><small>Primero revisa gratis el caption. Solo usa OpenAI si detecta suficiente receta.</small></span>
     </button>
     <button type="button" className={importStrategy==='manual'?'strategy-card active':'strategy-card'} onClick={()=>setImportStrategy('manual')}>
      <BookmarkPlus/><span><b>Guardar sin IA</b><small>0 tokens. Guarda el link, nombre y etiquetas para que la completes después.</small></span>
     </button>
    </div>

    <label>Nombre {importStrategy==='manual'?'*':'(opcional)'}<input value={hintTitle} onChange={e=>setHintTitle(e.target.value)} placeholder="Ej. Pasta cremosa del Reel"/></label>

    <div className="tag-field">
     <span>Etiquetas <small>Opcionales</small></span>
     <div className="tag-picker">{tags.map(tag=><button type="button" key={tag.id} className={selectedTags.includes(tag.name)?'tag-chip selected':'tag-chip'} onClick={()=>toggleTag(tag.name)}>{tag.name}</button>)}</div>
    </div>

    {importStrategy==='smart'&&<label>Texto de la publicación <small>Opcional. Si ya tenés el caption, pegarlo ayuda a detectar si vale la pena usar IA.</small><textarea value={pastedContent} onChange={e=>setPastedContent(e.target.value)} placeholder="Pegá acá el caption si lo tenés..."/></label>}

    <div className="import-note strong">
     {importStrategy==='smart'
      ?'Chefcita hace una revisión previa sin IA. Si el caption parece incompleto, se detiene antes de gastar tokens y te ofrece qué hacer.'
      :'Se crea una receta para revisar manualmente. No se hace ninguna llamada a OpenAI.'}
    </div>
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
    <button type="button" className="cancel" onClick={onClose}>Cancelar</button>
    <button className="primary save-recipe" disabled={busy||(mode==='link'?(!sourceUrl.trim()||(importStrategy==='manual'&&!hintTitle.trim())):!title.trim())}>
     {busy?'Guardando...':mode==='link'?(importStrategy==='manual'?'Guardar para completar':'Guardar e intentar importar'):'Guardar receta'}
    </button>
   </div>
  </form>
 </div>;
}
