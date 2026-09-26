import React,{useEffect,useMemo,useState} from 'react';
import {BookOpen,Heart,Search,Clock,ChefHat} from 'lucide-react';
import {supabase} from './supabase.js';

const levelLabel={initial:'Inicial',intermediate:'Intermedio',expert:'Experto'};

export default function RecipeLibrary({session,mode='all'}){
 const [recipes,setRecipes]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');

 const load=async()=>{
  setLoading(true);
  setError('');
  const {data,error}=await supabase
   .from('recipes')
   .select('id,title,description,image_url,level,total_minutes,created_at,categories(name),meal_types(name),user_recipes!left(is_favorite,tried_status,rating)')
   .eq('review_status','recipe')
   .order('created_at',{ascending:false});
  if(error){setError(error.message);setRecipes([])}
  else setRecipes(data||[]);
  setLoading(false);
 };

 useEffect(()=>{load()},[]);

 const visible=useMemo(()=>recipes.filter(recipe=>{
  const personal=recipe.user_recipes?.[0];
  if(mode==='favorites'&&!personal?.is_favorite)return false;
  const q=search.trim().toLowerCase();
  if(!q)return true;
  return [recipe.title,recipe.description,recipe.categories?.name,recipe.meal_types?.name]
   .filter(Boolean).some(value=>String(value).toLowerCase().includes(q));
 }),[recipes,search,mode]);

 const toggleFavorite=async(recipe,event)=>{
  event.stopPropagation();
  const current=recipe.user_recipes?.[0];
  const next=!current?.is_favorite;
  const {error}=await supabase.from('user_recipes').upsert({
   user_id:session.user.id,
   recipe_id:recipe.id,
   is_favorite:next,
   tried_status:current?.tried_status||'to_try'
  },{onConflict:'user_id,recipe_id'});
  if(error){setError(error.message);return}
  setRecipes(list=>list.map(item=>item.id===recipe.id?{...item,user_recipes:[{...(current||{}),is_favorite:next,tried_status:current?.tried_status||'to_try'}]}:item));
 };

 return <section className="recipe-library">
  <div className="library-toolbar">
   <div className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar recetas..."/></div>
   <span>{visible.length} {visible.length===1?'receta':'recetas'}</span>
  </div>
  {loading&&<div className="library-state"><ChefHat/><p>Cargando recetas...</p></div>}
  {!loading&&error&&<div className="library-state error"><p>No pudimos cargar las recetas.</p><small>{error}</small><button onClick={load}>Reintentar</button></div>}
  {!loading&&!error&&visible.length===0&&<div className="library-state"><BookOpen/><h2>{mode==='favorites'?'Todavía no tenés favoritas':'Tu biblioteca está lista'}</h2><p>{mode==='favorites'?'Marcá una receta con el corazón y aparecerá acá.':'Añadí tu primera receta para empezar a construir Chefcita.'}</p></div>}
  {!loading&&!error&&visible.length>0&&<div className="recipe-grid">
   {visible.map(recipe=>{
    const personal=recipe.user_recipes?.[0];
    return <article className="recipe-card" key={recipe.id}>
     <div className="recipe-card-top">
      {recipe.image_url?<img src={recipe.image_url} alt=""/>:<div className="recipe-placeholder"><ChefHat/></div>}
      <button className={personal?.is_favorite?'favorite active':'favorite'} onClick={e=>toggleFavorite(recipe,e)} aria-label="Favorita"><Heart/></button>
     </div>
     <div className="recipe-card-body">
      <div className="recipe-meta">{recipe.categories?.name&&<span>{recipe.categories.name}</span>}{recipe.meal_types?.name&&<span>{recipe.meal_types.name}</span>}</div>
      <h3>{recipe.title}</h3>
      {recipe.description&&<p>{recipe.description}</p>}
      <div className="recipe-facts">{recipe.total_minutes!=null&&<span><Clock/>{recipe.total_minutes} min</span>}{recipe.level&&<span>{levelLabel[recipe.level]}</span>}</div>
     </div>
    </article>;
   })}
  </div>}
 </section>;
}
