import React,{useEffect,useState} from 'react';
import {X,Link,PenLine} from 'lucide-react';
import {supabase} from './supabase.js';

export default function AddRecipe({session,onClose,onSaved}){
 const [mode,setMode]=useState('link');
 const [sourceUrl,setSourceUrl]=useState('');
 const [pastedContent,setPastedContent]=useState('');
 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [category,setCategory]=useState('');
 const [mealType,setMealType]=useState('');
 const [level,setLevel]=useState('');
 const [minutes,setMinutes]=useState('');
 const [categories,setCategories]=useState([]);
 const [mealTypes,setMealTypes]=useState([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{
  Promise.all([
   supabase.from('categories').select('id,name').order('sort_order'),
   supabase.from('meal_types').select('id,name').order('sort_order')
  ]).then(([c,m])=>{setCategories(c.data||[]);setMealTypes(m.data||[])});
 },[]);

 const queueImport=async e=>{
  e.preventDefault();
  if(!sourceUrl.trim())return;
  setBusy(true);setError('');
  const instagram=/instagram\\.com\\/(reel|p|tv)\\//i.test(sourceUrl.trim());
  if(!instagram){setBusy(false);setError('Por ahora el enlace debe ser de un Reel o post de Instagram.');return}
  const {data:membership}=await supabase.from('household_members').select('household_id').eq('user_id',session.user.id).limit(1).maybeSingle();
  const {error:importError}=await supabase.from('imports').insert({user_id:session.user.id,household_id:membership?.household_id||null,source_type:'instagram',source_url:sourceUrl.trim(),pasted_content:pastedContent.trim()||null,status:'queued'});
  setBusy(false);
  if(importError){setError(importError.message);return}
  onSaved('Pendientes');
 };

 const save=async e=>{
  e.preventDefault();
  if(!title.trim())return;
  setBusy(true);setError('');
  const {data:membership}=await supabase.from('household_members').select('household_id').eq('user_id',session.user.id).limit(1).maybeSingle();
  const payload={
   owner_id:session.user.id,
   household_id:membership?.household_id||null,
   title:title.trim(),
   description:description.trim()||null,
   category_id:category||null,
   meal_type_id:mealType||null,
   level:level||null,
   total_minutes:minutes?Number(minutes):null,
   review_status:'recipe',
   visibility:membership?.household_id?'household':'private'
  };
  const {data,error:saveError}=await supabase.from('recipes').insert(payload).select('id').single();
  if(saveError){setBusy(false);setError(saveError.message);return}
  const {error:sourceError}=await supabase.from('recipe_sources').insert({recipe_id:data.id,source_type:'manual',is_primary:true});
  setBusy(false);
  if(sourceError){setError(sourceError.message);return}
  onSaved();
 };

 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <form className="recipe-form" onSubmit={save}>
   <div className="form-head"><div><small>NUEVA RECETA</small><h2>Añadir receta</h2></div><button type="button" onClick={onClose}><X/></button></div>
   <div className="add-modes"><button type="button" className={mode==='link'?'active':''} onClick={()=>setMode('link')}><Link/>Desde Instagram</button><button type="button" className={mode==='manual'?'active':''} onClick={()=>setMode('manual')}><PenLine/>Manual</button></div>
   {mode==='link'&&<div className="link-import"><label>Enlace del Reel o post *<input autoFocus type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://www.instagram.com/reel/..."/></label><label>Texto de la publicación <small>Opcional. Pegalo si Instagram no deja leer la descripción automáticamente.</small><textarea value={pastedContent} onChange={e=>setPastedContent(e.target.value)} placeholder="Pegá acá el texto/caption de la receta si lo tenés..."/></label>{error&&<p className="message">{error}</p>}<div className="import-note">Guardaremos el enlace y lo enviaremos a Pendientes para procesarlo sin perder el contenido original.</div><div className="form-actions"><button type="button" className="cancel" onClick={onClose}>Cancelar</button><button type="button" className="primary save-recipe" disabled={busy||!sourceUrl.trim()} onClick={queueImport}>{busy?'Guardando...':'Importar receta'}</button></div></div>}
   {mode==='manual'&&<>
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
   {error&&<p className="message">{error}</p>}
   <div className="form-actions"><button type="button" className="cancel" onClick={onClose}>Cancelar</button><button className="primary save-recipe" disabled={busy||!title.trim()}>{busy?'Guardando...':'Guardar receta'}</button></div></>}
  </form>
 </div>;
}
