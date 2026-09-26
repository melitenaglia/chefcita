import React,{useEffect,useState} from 'react';
import {ArrowLeft,Clock,ChefHat} from 'lucide-react';
import {supabase} from './supabase.js';
const levels={initial:'Inicial',intermediate:'Intermedio',expert:'Experto'};
export default function RecipeDetail({recipeId,onBack}){
 const [recipe,setRecipe]=useState(null);const [error,setError]=useState('');
 useEffect(()=>{supabase.from('recipes').select('*,categories(name),meal_types(name),recipe_sources(*),recipe_ingredients(*),recipe_steps(*)').eq('id',recipeId).single().then(({data,error})=>{if(error)setError(error.message);else setRecipe(data)})},[recipeId]);
 if(error)return <div className="library-state error"><p>No pudimos abrir la receta.</p><small>{error}</small><button onClick={onBack}>Volver</button></div>;
 if(!recipe)return <div className="library-state"><ChefHat/><p>Cargando receta...</p></div>;
 const ingredients=[...(recipe.recipe_ingredients||[])].sort((a,b)=>a.sort_order-b.sort_order);
 const steps=[...(recipe.recipe_steps||[])].sort((a,b)=>a.step_number-b.step_number);
 const source=recipe.recipe_sources?.find(x=>x.is_primary)||recipe.recipe_sources?.[0];
 return <article className="recipe-detail">
  <button className="back-link" onClick={onBack}><ArrowLeft/>Volver a recetas</button>
  <header><div className="recipe-detail-copy"><div className="recipe-meta">{recipe.categories?.name&&<span>{recipe.categories.name}</span>}{recipe.meal_types?.name&&<span>{recipe.meal_types.name}</span>}</div><h1>{recipe.title}</h1>{recipe.description&&<p>{recipe.description}</p>}<div className="detail-facts">{recipe.total_minutes!=null&&<span><Clock/>{recipe.total_minutes} min</span>}{recipe.level&&<span>{levels[recipe.level]}</span>}{recipe.servings&&<span>{recipe.servings} {recipe.servings_unit||'porciones'}</span>}</div></div>{recipe.image_url?<img src={recipe.image_url} alt=""/>:<div className="detail-image"><ChefHat/></div>}</header>
  <div className="detail-columns"><section><h2>Ingredientes</h2>{ingredients.length?ingredients.map(x=><div className="ingredient-line" key={x.id}><b>{x.quantity_text||[x.quantity,x.unit].filter(Boolean).join(' ')}</b><span>{x.original_name}{x.note?' · '+x.note:''}</span></div>):<p className="muted">Ingredientes pendientes de completar.</p>}</section><section><h2>Preparación</h2>{steps.length?steps.map(x=><div className="step-line" key={x.id}><b>{x.step_number}</b><p>{x.instruction}</p></div>):<p className="muted">Pasos pendientes de completar.</p>}</section></div>
  {(recipe.storage_notes||recipe.freezer_notes||recipe.meal_prep_notes)&&<section className="detail-notes"><h2>Guardar y preparar</h2>{recipe.storage_notes&&<p><b>Conservación:</b> {recipe.storage_notes}</p>}{recipe.freezer_notes&&<p><b>Freezer:</b> {recipe.freezer_notes}</p>}{recipe.meal_prep_notes&&<p><b>Meal prep:</b> {recipe.meal_prep_notes}</p>}</section>}
  {source?.source_url&&<a className="source-link" href={source.source_url} target="_blank" rel="noreferrer">Ver publicación original</a>}
 </article>;
}