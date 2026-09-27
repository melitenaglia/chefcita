import React,{useEffect,useState} from 'react';
import {Check,ChefHat,Plus,Trash2,ExternalLink,Save,Sparkles,ClipboardPaste} from 'lucide-react';
import {supabase} from './supabase.js';

const blankIngredient=()=>({original_name:'',quantity_text:'',_initial_quantity_text:'',quantity:null,unit:'',note:'',section:'',role:'main'});
const blankStep=()=>({instruction:'',duration_minutes:null,temperature_c:null,note:''});

export default function RecipeEditor({recipeId,mode='review',onBack,onSaved}){
 const [recipe,setRecipe]=useState(null);
 const [ingredients,setIngredients]=useState([]);
 const [steps,setSteps]=useState([]);
 const [categories,setCategories]=useState([]);
 const [mealTypes,setMealTypes]=useState([]);
 const [tags,setTags]=useState([]);
 const [selectedTags,setSelectedTags]=useState([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [aiBusy,setAiBusy]=useState(false);
 const [extraText,setExtraText]=useState('');
 const [aiMessage,setAiMessage]=useState('');
 const [error,setError]=useState('');

 const load=async()=>{
  setLoading(true);setError('');
  const [{data,error},{data:cats},{data:types},{data:tagRows}]=await Promise.all([
   supabase.from('recipes')
    .select('*,recipe_ingredients(*),recipe_steps(*),recipe_tags(tag_id),recipe_sources(id,source_url,original_copy,supplemental_copy,author_handle,original_image_url,is_primary)')
    .eq('id',recipeId).single(),
   supabase.from('categories').select('id,name').order('sort_order'),
   supabase.from('meal_types').select('id,name').order('sort_order'),
   supabase.from('tags').select('id,name').order('sort_order')
  ]);

  if(error){setError(error.message);setLoading(false);return}
  setRecipe(data);
  setCategories(cats||[]);setMealTypes(types||[]);setTags(tagRows||[]);
  setSelectedTags((data.recipe_tags||[]).map(x=>x.tag_id));
  setIngredients([...(data.recipe_ingredients||[])].sort((a,b)=>a.sort_order-b.sort_order).map(x=>{
   const quantityText=x.quantity_text||[x.quantity,x.unit].filter(Boolean).join(' ');
   return {
    original_name:x.original_name||'',
    quantity_text:quantityText,
    _initial_quantity_text:quantityText,
    quantity:x.quantity,
    unit:x.unit||'',
    note:x.note||'',
    section:x.section||'',
    role:x.role||'main'
   };
  }));
  setSteps([...(data.recipe_steps||[])].sort((a,b)=>a.step_number-b.step_number).map(x=>({
   instruction:x.instruction||'',
   duration_minutes:x.duration_minutes,
   temperature_c:x.temperature_c,
   note:x.note||''
  })));
  setLoading(false);
 };

 useEffect(()=>{load()},[recipeId]);

 const setField=(name,value)=>setRecipe(r=>({...r,[name]:value}));
 const toggleTag=id=>setSelectedTags(list=>list.includes(id)?list.filter(x=>x!==id):[...list,id]);

 const pasteExtra=async()=>{
  try{
   const text=await navigator.clipboard.readText();
   if(text)setExtraText(text);
  }catch{
   setError('El navegador no permitió leer el portapapeles. Podés pegar el texto manualmente.');
  }
 };

 const enrichWithAi=async()=>{
  if(!extraText.trim())return;
  setAiBusy(true);setError('');setAiMessage('');
  const {data,error:aiError}=await supabase.functions.invoke('enrich-recipe-with-ai',{
   body:{recipe_id:recipe.id,supplemental_text:extraText.trim()}
  });
  setAiBusy(false);
  if(aiError||!data?.structured){
   setError(aiError?.message||data?.error||'No pude procesar la información adicional.');
   return;
  }

  const result=data.structured;
  const categoryId=categories.find(x=>x.name===result.category)?.id||null;
  const mealTypeId=mealTypes.find(x=>x.name===result.meal_type)?.id||null;

  setRecipe(r=>({
   ...r,
   title:result.title||r.title,
   description:result.description??r.description,
   category_id:categoryId,
   meal_type_id:mealTypeId,
   level:result.level||null,
   prep_minutes:result.prep_minutes,
   cook_minutes:result.cook_minutes,
   total_minutes:result.total_minutes,
   servings:result.servings,
   servings_unit:result.servings_unit||'',
   storage_notes:result.storage_notes||'',
   freezer_notes:result.freezer_notes||'',
   meal_prep_notes:result.meal_prep_notes||''
  }));

  const enrichedIngredients=(result.ingredients||[]).map(x=>{
   const quantityText=x.quantity_text||[x.quantity,x.unit].filter(Boolean).join(' ');
   return {
    original_name:x.name||'',
    quantity_text:quantityText,
    _initial_quantity_text:quantityText,
    quantity:x.quantity,
    unit:x.unit||'',
    note:x.note||'',
    section:x.section||'',
    role:x.role==='secondary'?'secondary':'main'
   };
  });
  setIngredients(enrichedIngredients);

  setSteps((result.steps||[]).map(x=>({
   instruction:x.instruction||'',
   duration_minutes:x.duration_minutes,
   temperature_c:x.temperature_c,
   note:x.note||''
  })));

  const tagIds=(result.tags||[]).map(name=>tags.find(tag=>tag.name===name)?.id).filter(Boolean);
  setSelectedTags(tagIds);
  setAiMessage('Listo: incorporé la información adicional a la ficha. Revisá los cambios y después guardá o aprobá.');
  setExtraText('');
 };

 const save=async approve=>{
  if(!recipe?.title?.trim())return;
  setBusy(true);setError('');

  const payload={
   title:recipe.title.trim(),
   description:recipe.description?.trim()||'',
   category_id:recipe.category_id||'',
   meal_type_id:recipe.meal_type_id||'',
   level:recipe.level||'',
   prep_minutes:recipe.prep_minutes??'',
   cook_minutes:recipe.cook_minutes??'',
   total_minutes:recipe.total_minutes??'',
   servings:recipe.servings??'',
   servings_unit:recipe.servings_unit?.trim()||'',
   storage_notes:recipe.storage_notes?.trim()||'',
   freezer_notes:recipe.freezer_notes?.trim()||'',
   meal_prep_notes:recipe.meal_prep_notes?.trim()||''
  };

  const ingredientRows=ingredients
   .filter(x=>x.original_name.trim())
   .map(x=>{
    const quantityChanged=x.quantity_text!==x._initial_quantity_text;
    return {
     original_name:x.original_name.trim(),
     quantity_text:x.quantity_text.trim()||'',
     quantity:quantityChanged?null:x.quantity,
     unit:quantityChanged?'':x.unit,
     note:x.note.trim()||'',
     section:x.section.trim()||'',
     role:x.role==='secondary'?'secondary':'main'
    };
   });

  const stepRows=steps
   .filter(x=>x.instruction.trim())
   .map(x=>({
    instruction:x.instruction.trim(),
    duration_minutes:x.duration_minutes??null,
    temperature_c:x.temperature_c??null,
    note:x.note?.trim()||''
   }));

  const keepApproved=mode==='edit'?true:approve;
  const {error:saveError}=await supabase.rpc('save_recipe_review',{
   p_recipe_id:recipe.id,
   p_recipe:payload,
   p_ingredients:ingredientRows,
   p_steps:stepRows,
   p_tag_ids:selectedTags,
   p_approve:keepApproved
  });

  setBusy(false);
  if(saveError){setError(saveError.message);return}

  if(mode==='edit'){
   onSaved?.({approved:true});
   return;
  }

  if(approve){
   onSaved?.({approved:true});
  }else{
   await load();
   onSaved?.({approved:false});
  }
 };

 if(loading)return <div className="library-state"><ChefHat/><p>Cargando receta...</p></div>;
 if(error&&!recipe)return <div className="library-state error"><p>No pudimos cargar la receta.</p><small>{error}</small><button onClick={load}>Reintentar</button></div>;

 const source=recipe?.recipe_sources?.find(x=>x.is_primary)||recipe?.recipe_sources?.[0];
 const isEdit=mode==='edit';

 return <section className={isEdit?'review-editor edit-approved':'review-editor'}>
  <div className="review-editor-head">
   <div><small>{isEdit?'EDITAR RECETA':'POR VALIDAR'}</small><h2>{recipe?.title||'Receta sin título'}</h2></div>
   <button onClick={onBack}>Volver</button>
  </div>

  {source&&<div className="source-review-box">
   <div className="source-review-head">
    <div><b>Fuente original</b>{source.author_handle&&<small>{source.author_handle}</small>}</div>
    {source.source_url&&<a href={source.source_url} target="_blank" rel="noreferrer">Abrir original <ExternalLink/></a>}
   </div>
   <div className="source-review-content">
    {source.original_image_url&&<img src={source.original_image_url} alt="Miniatura de la fuente" onError={e=>{e.currentTarget.style.display='none'}}/>}
    {source.original_copy?<p>{source.original_copy}</p>:<small>No hay texto original guardado. Completá solo lo que conozcas.</small>}
   </div>
   {source.supplemental_copy&&<details className="supplemental-source"><summary>Ver información adicional ya incorporada</summary><p>{source.supplemental_copy}</p></details>}
  </div>}

  <div className="ai-enrich-box">
   <div className="ai-enrich-head">
    <div><Sparkles/><span><b>¿Tenés más información?</b><small>Pegá, por ejemplo, la receta completa del primer comentario. La IA la combina con lo que ya existe sin tocar el copy original.</small></span></div>
    <button type="button" onClick={pasteExtra}><ClipboardPaste/>Pegar portapapeles</button>
   </div>
   <textarea value={extraText} onChange={e=>setExtraText(e.target.value)} placeholder="Pegá acá ingredientes, pasos o el texto completo que faltaba..."/>
   <div className="ai-enrich-actions">
    <small>No se guarda nada automáticamente: primero vas a ver el resultado en esta ficha.</small>
    <button type="button" className="primary" disabled={aiBusy||!extraText.trim()} onClick={enrichWithAi}><Sparkles/>{aiBusy?'Procesando...':'Completar con IA'}</button>
   </div>
   {aiMessage&&<p className="ai-success">{aiMessage}</p>}
  </div>

  <div className="review-grid">
   <label>Título *<input value={recipe?.title||''} onChange={e=>setField('title',e.target.value)}/></label>
   <label>Descripción<textarea value={recipe?.description||''} onChange={e=>setField('description',e.target.value)}/></label>
   <div className="form-grid">
    <label>Categoría<select value={recipe?.category_id||''} onChange={e=>setField('category_id',e.target.value||null)}><option value="">Sin definir</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>Tipo de comida<select value={recipe?.meal_type_id||''} onChange={e=>setField('meal_type_id',e.target.value||null)}><option value="">Sin definir</option>{mealTypes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   </div>
   <div className="form-grid">
    <label>Nivel<select value={recipe?.level||''} onChange={e=>setField('level',e.target.value||null)}><option value="">Sin definir</option><option value="initial">Inicial</option><option value="intermediate">Intermedio</option><option value="expert">Experto</option></select></label>
    <label>Porciones<input type="number" min="0" step="0.5" value={recipe?.servings??''} onChange={e=>setField('servings',e.target.value)}/></label>
   </div>
   <div className="form-grid three">
    <label>Preparación (min)<input type="number" min="0" value={recipe?.prep_minutes??''} onChange={e=>setField('prep_minutes',e.target.value)}/></label>
    <label>Cocción (min)<input type="number" min="0" value={recipe?.cook_minutes??''} onChange={e=>setField('cook_minutes',e.target.value)}/></label>
    <label>Total (min)<input type="number" min="0" value={recipe?.total_minutes??''} onChange={e=>setField('total_minutes',e.target.value)}/></label>
   </div>
  </div>

  <div className="review-section">
   <div className="review-section-title"><h3>Etiquetas</h3></div>
   <div className="tag-picker">{tags.map(tag=><button type="button" key={tag.id} className={selectedTags.includes(tag.id)?'tag-chip selected':'tag-chip'} onClick={()=>toggleTag(tag.id)}>{tag.name}</button>)}</div>
  </div>

  <div className="review-section">
   <div className="review-section-title"><div><h3>Ingredientes</h3><small>Principales = los que definen la receta. Secundarios = condimentos, salsas y toppings.</small></div><button onClick={()=>setIngredients(list=>[...list,blankIngredient()])}><Plus/>Añadir</button></div>
   <div className="review-lines">{ingredients.map((item,index)=><div className="review-ingredient v1-parity" key={index}>
    <select aria-label="Tipo de ingrediente" value={item.role} onChange={e=>setIngredients(list=>list.map((x,i)=>i===index?{...x,role:e.target.value}:x))}><option value="main">Principal</option><option value="secondary">Secundario</option></select>
    <input placeholder="Cantidad" value={item.quantity_text} onChange={e=>setIngredients(list=>list.map((x,i)=>i===index?{...x,quantity_text:e.target.value}:x))}/>
    <input placeholder="Ingrediente" value={item.original_name} onChange={e=>setIngredients(list=>list.map((x,i)=>i===index?{...x,original_name:e.target.value}:x))}/>
    <input placeholder="Nota" value={item.note} onChange={e=>setIngredients(list=>list.map((x,i)=>i===index?{...x,note:e.target.value}:x))}/>
    <button className="icon-delete" onClick={()=>setIngredients(list=>list.filter((_,i)=>i!==index))}><Trash2/></button>
   </div>)}</div>
  </div>

  <div className="review-section">
   <div className="review-section-title"><h3>Preparación</h3><button onClick={()=>setSteps(list=>[...list,blankStep()])}><Plus/>Añadir</button></div>
   <div className="review-lines">{steps.map((item,index)=><div className="review-step" key={index}><b>{index+1}</b><textarea value={item.instruction} onChange={e=>setSteps(list=>list.map((x,i)=>i===index?{...x,instruction:e.target.value}:x))}/><button className="icon-delete" onClick={()=>setSteps(list=>list.filter((_,i)=>i!==index))}><Trash2/></button></div>)}</div>
  </div>

  <div className="review-grid">
   <label>Conservación<textarea value={recipe?.storage_notes||''} onChange={e=>setField('storage_notes',e.target.value)}/></label>
   <label>Freezer<textarea value={recipe?.freezer_notes||''} onChange={e=>setField('freezer_notes',e.target.value)}/></label>
   <label>Meal prep<textarea value={recipe?.meal_prep_notes||''} onChange={e=>setField('meal_prep_notes',e.target.value)}/></label>
  </div>

  {error&&<p className="message">{error}</p>}

  <div className="review-actions">
   {!isEdit&&<button disabled={busy} onClick={()=>save(false)}>{busy?'Guardando...':'Guardar borrador'}</button>}
   <button className="primary" disabled={busy||!recipe?.title?.trim()} onClick={()=>save(true)}>{isEdit?<><Save/>Guardar cambios</>:<><Check/>Aprobar receta</>}</button>
  </div>
 </section>;
}
