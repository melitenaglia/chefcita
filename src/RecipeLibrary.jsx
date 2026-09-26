import React,{useEffect,useMemo,useState} from 'react';
import {BookOpen,Heart,Search,Clock,ChefHat,CheckCircle2,Circle} from 'lucide-react';
import {supabase} from './supabase.js';
import RecipeDetail from './RecipeDetail.jsx';

const levelLabel={initial:'Inicial',intermediate:'Intermedio',expert:'Experto'};

export default function RecipeLibrary({session,mode='all'}){
 const [recipes,setRecipes]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [selectedId,setSelectedId]=useState(null);

 const load=async()=>{
  setLoading(true);
  setError('');
  const {data,error}=await supabase
   .from('recipes')
   .select('id,title,description,image_url,level,total_minutes,reviewed_at,created_at,categories(name),meal_types(name),recipe_ingredients(original_name,role),recipe_tags(tags(name)),user_recipes!left(is_favorite,tried_status,rating,tried_at)')
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
  const ingredients=(recipe.recipe_ingredients||[]).map(x=>x.original_name);
  const tagNames=(recipe.recipe_tags||[]).map(x=>x.tags?.name);
  return [
   recipe.title,recipe.description,recipe.categories?.name,recipe.meal_types?.name,
   ...ingredients,...tagNames
  ].filter(Boolean).some(value=>String(value).toLowerCase().includes(q));
 }),[recipes,search,mode]);

 const updatePersonal=async(recipe,changes)=>{
  const current=recipe.user_recipes?.[0]||{};
  const triedStatus=changes.tried_status??current.tried_status??'to_try';
  const next={
   user_id:session.user.id,
   recipe_id:recipe.id,
   is_favorite:changes.is_favorite??current.is_favorite??false,
   tried_status:triedStatus,
   rating:triedStatus==='tried'?(current.rating??null):null,
   tried_at:triedStatus==='tried'?(current.tried_at||new Date().toISOString().slice(0,10)):null
  };
  const {error}=await supabase.from('user_recipes').upsert(next,{onConflict:'user_id,recipe_id'});
  if(error){setError(error.message);return}
  setRecipes(list=>list.map(item=>item.id===recipe.id?{...item,user_recipes:[{...current,...next}]}:item));
 };

 const toggleFavorite=(recipe,event)=>{
  event.stopPropagation();
  const current=recipe.user_recipes?.[0];
  updatePersonal(recipe,{is_favorite:!current?.is_favorite});
 };

 const toggleTried=(recipe,event)=>{
  event.stopPropagation();
  const current=recipe.user_recipes?.[0];
  updatePersonal(recipe,{tried_status:current?.tried_status==='tried'?'to_try':'tried'});
 };

 return <section className="recipe-library">
  <div className="library-toolbar">
   <div className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por receta, ingrediente, categoría o etiqueta..."/></div>
   <span>{visible.length} {visible.length===1?'receta':'recetas'}</span>
  </div>
  {loading&&<div className="library-state"><ChefHat/><p>Cargando recetas...</p></div>}
  {!loading&&error&&<div className="library-state error"><p>No pudimos cargar las recetas.</p><small>{error}</small><button onClick={load}>Reintentar</button></div>}
  {!loading&&!error&&visible.length===0&&<div className="library-state"><BookOpen/><h2>{mode==='favorites'?'Todavía no tenés favoritas':'Tu biblioteca está lista'}</h2><p>{mode==='favorites'?'Marcá una receta con el corazón y aparecerá acá.':'Añadí tu primera receta para empezar a construir Chefcita.'}</p></div>}
  {!loading&&!error&&visible.length>0&&<div className="recipe-grid">
   {visible.map(recipe=>{
    const personal=recipe.user_recipes?.[0];
    const mainIngredients=(recipe.recipe_ingredients||[]).filter(x=>x.role!=='secondary').slice(0,4);
    const tagNames=(recipe.recipe_tags||[]).map(x=>x.tags?.name).filter(Boolean).slice(0,4);
    const tried=personal?.tried_status==='tried';
    return <article className="recipe-card clickable" key={recipe.id} onClick={()=>setSelectedId(recipe.id)}>
     <div className="recipe-card-top">
      {recipe.image_url?<img src={recipe.image_url} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<div className="recipe-placeholder"><ChefHat/></div>}
      <button className={personal?.is_favorite?'favorite active':'favorite'} onClick={e=>toggleFavorite(recipe,e)} aria-label="Favorita"><Heart/></button>
     </div>
     <div className="recipe-card-body">
      <div className="recipe-meta">{recipe.categories?.name&&<span>{recipe.categories.name}</span>}{recipe.meal_types?.name&&<span>{recipe.meal_types.name}</span>}</div>
      <h3>{recipe.title}</h3>
      {recipe.description&&<p>{recipe.description}</p>}
      {mainIngredients.length>0&&<div className="card-ingredients">{mainIngredients.map((x,i)=><span key={i}>{x.original_name}</span>)}</div>}
      {tagNames.length>0&&<div className="card-tags">{tagNames.map(tag=><span key={tag}>{tag}</span>)}</div>}
      <div className="recipe-facts">{recipe.total_minutes!=null&&<span><Clock/>{recipe.total_minutes} min</span>}{recipe.level&&<span>{levelLabel[recipe.level]}</span>}</div>
      <button className={tried?'tried-toggle active':'tried-toggle'} onClick={e=>toggleTried(recipe,e)}>{tried?<CheckCircle2/>:<Circle/>}{tried?'Probada':'Por probar'}</button>
     </div>
    </article>;
   })}
  </div>}
  {selectedId&&<RecipeDetail recipeId={selectedId} session={session} onClose={()=>setSelectedId(null)} onDeleted={()=>load()} onChanged={()=>load()}/>} 
 </section>;
}
