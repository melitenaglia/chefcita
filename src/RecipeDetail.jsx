import React,{useEffect,useMemo,useState} from 'react';
import {X,Heart,CheckCircle2,Circle,Star,ExternalLink,Clock,ChefHat,Trash2,Save,Edit3} from 'lucide-react';
import {supabase} from './supabase.js';
import {userErrorMessage} from './userError.js';
import RecipeEditor from './RecipeEditor.jsx';

const levelLabel={initial:'Inicial',intermediate:'Intermedio',expert:'Experto'};

export default function RecipeDetail({recipeId,session,onClose,onDeleted,onChanged}){
 const [recipe,setRecipe]=useState(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [editing,setEditing]=useState(false);
 const [notes,setNotes]=useState('');
 const [personal,setPersonal]=useState({is_favorite:false,tried_status:'to_try',rating:null,tried_at:null});

 const load=async()=>{
  setLoading(true);setError('');
  const {data,error}=await supabase.from('recipes')
   .select('*,categories(name),meal_types(name),recipe_ingredients(*),recipe_steps(*),recipe_tags(tags(name)),recipe_sources(*),user_recipes!left(is_favorite,tried_status,rating,personal_notes,tried_at)')
   .eq('id',recipeId).single();
  if(error){setError(userErrorMessage(error,'No pude cargar esta receta. Probá de nuevo.'));setLoading(false);return}
  setRecipe(data);
  const p=data.user_recipes?.[0]||{};
  setPersonal({
   is_favorite:p.is_favorite||false,
   tried_status:p.tried_status||'to_try',
   rating:p.rating??null,
   tried_at:p.tried_at||null
  });
  setNotes(p.personal_notes||'');
  setLoading(false);
 };

 useEffect(()=>{load()},[recipeId]);

 const source=useMemo(()=>{
  if(!recipe)return null;
  return recipe.recipe_sources?.find(x=>x.is_primary)||recipe.recipe_sources?.[0]||null;
 },[recipe]);

 const ingredients=useMemo(()=>[...(recipe?.recipe_ingredients||[])].sort((a,b)=>a.sort_order-b.sort_order),[recipe]);
 const mainIngredients=ingredients.filter(x=>x.role!=='secondary');
 const secondaryIngredients=ingredients.filter(x=>x.role==='secondary');
 const steps=useMemo(()=>[...(recipe?.recipe_steps||[])].sort((a,b)=>a.step_number-b.step_number),[recipe]);
 const tags=(recipe?.recipe_tags||[]).map(x=>x.tags?.name).filter(Boolean);

 const savePersonal=async changes=>{
  if(!recipe)return;
  const next={...personal,...changes};
  if(next.tried_status!=='tried'){
   next.rating=null;
   next.tried_at=null;
  }else if(!next.tried_at){
   next.tried_at=new Date().toISOString().slice(0,10);
  }
  setBusy(true);setError('');
  const {error}=await supabase.from('user_recipes').upsert({
   user_id:session.user.id,
   recipe_id:recipe.id,
   is_favorite:next.is_favorite,
   tried_status:next.tried_status,
   rating:next.rating,
   personal_notes:notes.trim()||null,
   tried_at:next.tried_at
  },{onConflict:'user_id,recipe_id'});
  setBusy(false);
  if(error){setError(userErrorMessage(error,'No pude guardar este cambio. Probá de nuevo.'));return}
  setPersonal(next);
  onChanged?.();
 };

 const saveNotes=()=>savePersonal({});

 const deleteRecipe=async()=>{
  if(!recipe||recipe.owner_id!==session.user.id)return;
  if(!window.confirm('¿Eliminar esta receta? Esta acción también borra sus ingredientes, pasos y etiquetas.'))return;
  setBusy(true);setError('');
  const {error}=await supabase.from('recipes').delete().eq('id',recipe.id);
  setBusy(false);
  if(error){setError(userErrorMessage(error,'No pude eliminar esta receta. Probá de nuevo.'));return}
  onDeleted?.(recipe.id);
  onClose();
 };

 const quantityLabel=item=>item.quantity_text||[item.quantity,item.unit].filter(Boolean).join(' ');

 if(loading)return <div className="modal-backdrop"><div className="recipe-detail loading"><ChefHat/><p>Cargando receta...</p></div></div>;

 if(editing)return <div className="modal-backdrop"><div className="recipe-detail editor-shell"><RecipeEditor recipeId={recipeId} mode="edit" onBack={()=>setEditing(false)} onSaved={async()=>{setEditing(false);await load();onChanged?.()}}/></div></div>;

 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <article className="recipe-detail">
   <div className="detail-head">
    <div><small>RECETA</small><h2>{recipe?.title||'Receta'}</h2></div>
    <div className="detail-head-actions">
     {recipe?.owner_id===session.user.id&&<button className="edit-recipe" onClick={()=>setEditing(true)}><Edit3/>Editar</button>}
     <button className="close-detail" onClick={onClose} aria-label="Cerrar"><X/></button>
    </div>
   </div>

   {error&&<p className="message">{error}</p>}

   {recipe&&<>
    <div className="detail-hero">
     {recipe.image_url?<img src={recipe.image_url} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<div className="detail-placeholder"><ChefHat/></div>}
     <div className="detail-summary">
      <div className="recipe-meta">{recipe.categories?.name&&<span>{recipe.categories.name}</span>}{recipe.meal_types?.name&&<span>{recipe.meal_types.name}</span>}{recipe.level&&<span>{levelLabel[recipe.level]}</span>}</div>
      {recipe.description&&<p>{recipe.description}</p>}
      <div className="detail-facts">
       {recipe.total_minutes!=null&&<span><Clock/>{recipe.total_minutes} min</span>}
       {recipe.prep_minutes!=null&&<span>Prep. {recipe.prep_minutes} min</span>}
       {recipe.cook_minutes!=null&&<span>Cocción {recipe.cook_minutes} min</span>}
       {recipe.servings!=null&&<span>{recipe.servings} {recipe.servings_unit||'porciones'}</span>}
      </div>
      {tags.length>0&&<div className="card-tags">{tags.map(tag=><span key={tag}>{tag}</span>)}</div>}
     </div>
    </div>

    <section className="personal-box">
     <div className="personal-actions">
      <button className={personal.is_favorite?'personal-action active':''} onClick={()=>savePersonal({is_favorite:!personal.is_favorite})} disabled={busy}><Heart/>{personal.is_favorite?'Favorita':'Marcar favorita'}</button>
      <button className={personal.tried_status==='tried'?'personal-action active tried':''} onClick={()=>savePersonal({tried_status:personal.tried_status==='tried'?'to_try':'tried'})} disabled={busy}>{personal.tried_status==='tried'?<CheckCircle2/>:<Circle/>}{personal.tried_status==='tried'?'Probada':'Por probar'}</button>
     </div>
     <div className={personal.tried_status==='tried'?'rating-row':'rating-row disabled'}><span>Mi valoración</span><div>{[1,2,3,4,5].map(n=><button key={n} disabled={busy||personal.tried_status!=='tried'} onClick={()=>savePersonal({rating:n})} aria-label={n+' estrellas'}><Star className={(personal.rating||0)>=n?'filled':''}/></button>)}</div>{personal.tried_status==='tried'&&!personal.rating&&<p className="rating-prompt">¿Qué te pareció? Tocá de 1 a 5 estrellas.</p>}</div>
     <label>Mis notas<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Qué cambiarías, con qué lo acompañaste, si gustó en casa..."/></label>
     <button className="save-notes" disabled={busy} onClick={saveNotes}><Save/>Guardar notas</button>
    </section>

    <div className="detail-columns">
     <section className="detail-section">
      <h3>Ingredientes principales</h3>
      {mainIngredients.length? <div className="ingredient-list">{mainIngredients.map(item=><div key={item.id}><span>{quantityLabel(item)}</span><b>{item.original_name}</b>{item.note&&<small>{item.note}</small>}</div>)}</div>:<p className="muted">No hay ingredientes principales cargados.</p>}
     </section>
     <section className="detail-section">
      <h3>Secundarios y condimentos</h3>
      {secondaryIngredients.length?<div className="ingredient-list">{secondaryIngredients.map(item=><div key={item.id}><span>{quantityLabel(item)}</span><b>{item.original_name}</b>{item.note&&<small>{item.note}</small>}</div>)}</div>:<p className="muted">Sin secundarios registrados.</p>}
     </section>
    </div>

    <section className="detail-section">
     <h3>Preparación</h3>
     {steps.length?<div className="step-list">{steps.map(step=><div key={step.id}><b>{step.step_number}</b><span><p>{step.instruction}</p>{(step.duration_minutes!=null||step.temperature_c!=null||step.note)&&<small>{[step.duration_minutes!=null?step.duration_minutes+' min':null,step.temperature_c!=null?step.temperature_c+' °C':null,step.note].filter(Boolean).join(' · ')}</small>}</span></div>)}</div>
     :source?.source_url?<div className="video-source-cta"><p>Esta receta está guardada como ficha rápida. Abrí la publicación original para ver la preparación.</p><a href={source.source_url} target="_blank" rel="noreferrer">Abrir original <ExternalLink/></a></div>
     :<p className="muted">No hay pasos cargados.</p>}
    </section>

    {(recipe.storage_notes||recipe.freezer_notes||recipe.meal_prep_notes)&&<section className="detail-section detail-notes"><h3>Conservación y organización</h3><div>{recipe.storage_notes&&<p><b>Conservación</b><span>{recipe.storage_notes}</span></p>}{recipe.freezer_notes&&<p><b>Freezer</b><span>{recipe.freezer_notes}</span></p>}{recipe.meal_prep_notes&&<p><b>Meal prep</b><span>{recipe.meal_prep_notes}</span></p>}</div></section>}

    {source&&<section className="detail-source">
     <div><h3>Fuente original</h3>{source.author_handle&&<span>{source.author_handle}</span>}</div>
     {source.source_url&&<a href={source.source_url} target="_blank" rel="noreferrer">Abrir enlace <ExternalLink/></a>}
     {source.original_copy&&<details><summary>Ver copy original</summary><p>{source.original_copy}</p></details>}
    </section>}

    <div className="detail-footer">
     <small>{recipe.reviewed_at?'Revisada '+new Date(recipe.reviewed_at).toLocaleDateString('es-ES'):'Guardada '+new Date(recipe.created_at).toLocaleDateString('es-ES')}</small>
     {recipe.owner_id===session.user.id&&<button className="delete-recipe" disabled={busy} onClick={deleteRecipe}><Trash2/>Eliminar receta</button>}
    </div>
   </>}
  </article>
 </div>;
}
