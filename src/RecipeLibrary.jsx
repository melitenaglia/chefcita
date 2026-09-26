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
  setLoading(true);setError('');
  const {data,error}=await supabase.from('recipes').select('id,title,description,image_url,level,total_minutes,review_status,created_at,categories(name),meal_types(name),user_recipes!left(is_favorite,tried_status,rating)').order('created_at',{ascending:false});
  if(error){setError(error.message);setRecipes([])}else setRecipes(data||[]);
  setLoading(false);
 };
 useEffect(()=>{load()},[]);
 const visible=useMemo(()=>recipes.filter(r=>{
  const personal=r.user_recipes?.[0];
  if(mode==='favorites'&&!personal?.is_favorite)return false;
  const q=search.trim().toLowerCase();
  return !q||r.title.toLowerCase().includes(q)||(r.description||'').toLowerCase().includes(q)||(r.categories?.name||'').toLowerCase().includes(q)||(r.meal_types?.name||'').toLowerCase().includes(q);
 }),[recipes,search,mode]);
 const toggleFavorite=async recipe=>{
  const current=recipe.user_recipes?.[0];
  const next=!current?.is_favorite;
  const {error}=await supabase.from('user_recipes').upsert({user_id:session.user.id,recipe_id:recipe.id,is_favorite:next,tried_status:current?.tried_status||'to_try'},{onConflict:'user_id,recipe_id'});
  if(error){setError(error.message);return}
  setRecipes(list=>list.map(r=>r.id===recipe.id?{...r,user_recipes:[{...(current||{}),is_favorite:next,tried_status:current?.tried_status||'to_try'}]}:r));
 };
 return <section className="recipe-library">
  <div className="library-toolbar"><div className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar recetas…"/></div><span>{visible.length} {visible.length===1?'receta':'recetas'}</span></div>
  {loading&&<div className="library-state"><ChefHat/><p>Cargando recetas…</p></div>}
  {!loading&&error&&<div className="library-state error"><p>No pudimos cargar las recetas.</p><small>{error}</small><button onClick={load}>Reintentar</button></div>}
  {!loading&&!error&&visible.length===0&&<div className="library-state"><BookOpen/><h2>{mode==='favorites'?'Todavía no tenés favoritas':'Tu biblioteca está lista'}</h2><p>{mode==='favorites'?'Marcá una receta con el corazón y aparecerá acá.':'Añadí tu primera receta para empezar a construir Chefcita.'}</p></div>}
  {!loading&&!error&&visible.length>0&&<div className="recipe-grid">{visible.map(r=>{const personal=r.user_recipes?.[0];return <article className="recipe-card" key={r.id}>
   <div className="recipe-card-top">{r.image_url?<img src={r.image_url} alt=""/>:<div className="recipe-placeholder"><ChefHat/></div>}<button className={personal?.is_favorite?'favorite active':'favorite'} onClick={()=>toggleFavorite(r)} aria-label="Favorita"><Heart/></button></div>
   <div className="recipe-card-body"><div className="recipe-meta">{r.categories?.name&&<span>{r.categories.name}</span>}{r.meal_types?.name&&<span>{r.meal_types.name}</span>}</div><h3>{r.title}</h3>{r.description&&<p>{r.description}</p>}<div className="recipe-facts">{r.total_minutes!=null&&<span><Clock/>{r.total_minutes} min</span>}{r.level&&<span>{levelLabel[r.level]}</span>}</div></div>
  </article>})}</div>}
 </section>;
}
