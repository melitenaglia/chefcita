import React,{useEffect,useState} from 'react';
import {Check,ChefHat,Plus,Trash2} from 'lucide-react';
import {supabase} from './supabase.js';

const blankIngredient=()=>({original_name:'',quantity_text:'',note:''});
const blankStep=()=>({instruction:''});

export default function ReviewRecipes(){
 const [items,setItems]=useState([]);
 const [selected,setSelected]=useState(null);
 const [recipe,setRecipe]=useState(null);
 const [ingredients,setIngredients]=useState([]);
 const [steps,setSteps]=useState([]);
 const [categories,setCategories]=useState([]);
 const [mealTypes,setMealTypes]=useState([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 const loadList=async()=>{
  setLoading(true);setError('');
  const [{data,error},{data:cats},{data:types}]=await Promise.all([
   supabase.from('recipes').select('id,title,description,created_at').eq('review_status','to_validate').order('created_at',{ascending:false}),
   supabase.from('categories').select('id,name').order('sort_order'),
   supabase.from('meal_types').select('id,name').order('sort_order')
  ]);
  if(error){setError(error.message);setItems([])}else setItems(data||[]);
  setCategories(cats||[]);setMealTypes(types||[]);
  setLoading(false);
 };

 useEffect(()=>{loadList()},[]);

 const open=async id=>{
  setSelected(id);setRecipe(null);setError('');
  const {data,error}=await supabase.from('recipes')
   .select('*,recipe_ingredients(*),recipe_steps(*)')
   .eq('id',id).single();
  if(error){setError(error.message);return}
  setRecipe(data);
  setIngredients([...(data.recipe_ingredients||[])].sort((a,b)=>a.sort_order-b.sort_order).map(x=>({
   original_name:x.original_name||'',
   quantity_text:x.quantity_text||[x.quantity,x.unit].filter(Boolean).join(' '),
   note:x.note||''
  })));
  setSteps([...(data.recipe_steps||[])].sort((a,b)=>a.step_number-b.step_number).map(x=>({instruction:x.instruction||''})));
 };

 const setField=(name,value)=>setRecipe(r=>({...r,[name]:value}));
 const numberOrNull=value=>value===''||value==null?null:Number(value);

 const save=async approve=>{
  if(!recipe?.title?.trim())return;
  setBusy(true);setError('');
  const {error:updateError}=await supabase.from('recipes').update({
   title:recipe.title.trim(),
   description:recipe.description?.trim()||null,
   category_id:recipe.category_id||null,
   meal_type_id:recipe.meal_type_id||null,
   level:recipe.level||null,
   prep_minutes:numberOrNull(recipe.prep_minutes),
   cook_minutes:numberOrNull(recipe.cook_minutes),
   total_minutes:numberOrNull(recipe.total_minutes),
   servings:numberOrNull(recipe.servings),
   servings_unit:recipe.servings_unit?.trim()||null,
   storage_notes:recipe.storage_notes?.trim()||null,
   freezer_notes:recipe.freezer_notes?.trim()||null,
   meal_prep_notes:recipe.meal_prep_notes?.trim()||null,
   review_status:approve?'recipe':'to_validate'
  }).eq('id',recipe.id);
  if(updateError){setBusy(false);setError(updateError.message);return}

  const {error:deleteIngredientsError}=await supabase.from('recipe_ingredients').delete().eq('recipe_id',recipe.id);
  if(deleteIngredientsError){setBusy(false);setError(deleteIngredientsError.message);return}
  const ingredientRows=ingredients.map((x,i)=>({
   recipe_id:recipe.id,
   original_name:x.original_name.trim(),
   quantity_text:x.quantity_text.trim()||null,
   note:x.note.trim()||null,
   sort_order:i
  })).filter(x=>x.original_name);
  if(ingredientRows.length){
   const {error}=await supabase.from('recipe_ingredients').insert(ingredientRows);
   if(error){setBusy(false);setError(error.message);return}
  }

  const {error:deleteStepsError}=await supabase.from('recipe_steps').delete().eq('recipe_id',recipe.id);
  if(deleteStepsError){setBusy(false);setError(deleteStepsError.message);return}
  const stepRows=steps.map((x,i)=>({recipe_id:recipe.id,step_number:i+1,instruction:x.instruction.trim()})).filter(x=>x.instruction);
  if(stepRows.length){
   const {error}=await supabase.from('recipe_steps').insert(stepRows);
   if(error){setBusy(false);setError(error.message);return}
  }

  setBusy(false);
  if(approve){setSelected(null);setRecipe(null);await loadList()}
  else await open(recipe.id);
 };

 if(loading)return <div className="library-state"><ChefHat/><p>Cargando recetas para validar...</p></div>;
 if(error&&!recipe)return <div className="library-state error"><p>No pudimos cargar las recetas para validar.</p><small>{error}</small><button onClick={loadList}>Reintentar</button></div>;

 if(selected&&recipe)return <section className="review-editor">
  <div className="review-editor-head"><div><small>POR VALIDAR</small><h2>{recipe.title||'Receta sin título'}</h2></div><button onClick={()=>{setSelected(null);setRecipe(null);setError('')}}>Volver</button></div>
  <div className="review-grid">
   <label>Título *<input value={recipe.title||''} onChange={e=>setField('title',e.target.value)}/></label>
   <label>Descripción<textarea value={recipe.description||''} onChange={e=>setField('description',e.target.value)}/></label>
   <div className="form-grid">
    <label>Categoría<select value={recipe.category_id||''} onChange={e=>setField('category_id',e.target.value||null)}><option value="">Sin definir</option>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>Tipo de comida<select value={recipe.meal_type_id||''} onChange={e=>setField('meal_type_id',e.target.value||null)}><option value="">Sin definir</option>{mealTypes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   </div>
   <div className="form-grid">
    <label>Nivel<select value={recipe.level||''} onChange={e=>setField('level',e.target.value||null)}><option value="">Sin definir</option><option value="initial">Inicial</option><option value="intermediate">Intermedio</option><option value="expert">Experto</option></select></label>
    <label>Porciones<input type="number" min="0" step="0.5" value={recipe.servings??''} onChange={e=>setField('servings',e.target.value)}/></label>
   </div>
   <div className="form-grid three">
    <label>Preparación (min)<input type="number" min="0" value={recipe.prep_minutes??''} onChange={e=>setField('prep_minutes',e.target.value)}/></label>
    <label>Cocción (min)<input type="number" min="0" value={recipe.cook_minutes??''} onChange={e=>setField('cook_minutes',e.target.value)}/></label>
    <label>Total (min)<input type="number" min="0" value={recipe.total_minutes??''} onChange={e=>setField('total_minutes',e.target.value)}/></label>
   </div>
  </div>

  <div className="review-section"><div className="review-section-title"><h3>Ingredientes</h3><button onClick={()=>setIngredients(list=>[...list,blankIngredient()])}><Plus/>Añadir</button></div>
   <div className="review-lines">{ingredients.map((item,index)=><div className="review-ingredient" key={index}>
    <input placeholder="Cantidad" value={item.quantity_text} onChange={e=>setIngredients(list=>list.map((x,i)=>i===index?{...x,quantity_text:e.target.value}:x))}/>
    <input placeholder="Ingrediente" value={item.original_name} onChange={e=>setIngredients(list=>list.map((x,i)=>i===index?{...x,original_name:e.target.value}:x))}/>
    <input placeholder="Nota" value={item.note} onChange={e=>setIngredients(list=>list.map((x,i)=>i===index?{...x,note:e.target.value}:x))}/>
    <button className="icon-delete" onClick={()=>setIngredients(list=>list.filter((_,i)=>i!==index))}><Trash2/></button>
   </div>)}</div>
  </div>

  <div className="review-section"><div className="review-section-title"><h3>Preparación</h3><button onClick={()=>setSteps(list=>[...list,blankStep()])}><Plus/>Añadir</button></div>
   <div className="review-lines">{steps.map((item,index)=><div className="review-step" key={index}><b>{index+1}</b><textarea value={item.instruction} onChange={e=>setSteps(list=>list.map((x,i)=>i===index?{...x,instruction:e.target.value}:x))}/><button className="icon-delete" onClick={()=>setSteps(list=>list.filter((_,i)=>i!==index))}><Trash2/></button></div>)}</div>
  </div>

  <div className="review-grid">
   <label>Conservación<textarea value={recipe.storage_notes||''} onChange={e=>setField('storage_notes',e.target.value)}/></label>
   <label>Freezer<textarea value={recipe.freezer_notes||''} onChange={e=>setField('freezer_notes',e.target.value)}/></label>
   <label>Meal prep<textarea value={recipe.meal_prep_notes||''} onChange={e=>setField('meal_prep_notes',e.target.value)}/></label>
  </div>
  {error&&<p className="message">{error}</p>}
  <div className="review-actions"><button disabled={busy} onClick={()=>save(false)}>Guardar borrador</button><button className="primary" disabled={busy} onClick={()=>save(true)}><Check/>Aprobar receta</button></div>
 </section>;

 return <section className="review-list">
  {items.length===0?<div className="library-state"><Check/><h2>Nada por validar</h2><p>Las recetas estructuradas por IA aparecerán acá antes de entrar a tu biblioteca.</p></div>
  :items.map(item=><button className="review-card" key={item.id} onClick={()=>open(item.id)}><span><b>{item.title}</b><small>{item.description||'Sin descripción'}</small></span><em>Revisar</em></button>)}
 </section>;
}
