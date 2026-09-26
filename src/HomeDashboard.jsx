import React,{useEffect,useState} from 'react';
import {BookOpen,Heart,Inbox,ChefHat,Clock,ArrowRight,Plus} from 'lucide-react';
import {supabase} from './supabase.js';

export default function HomeDashboard({onNavigate,onAdd}){
 const [data,setData]=useState({recipes:0,pending:0,favorites:0,recent:[]});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  (async()=>{
   setLoading(true);setError('');
   const [recipesRes,reviewRes,importsRes,userRes,recentRes]=await Promise.all([
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','recipe'),
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','to_validate'),
    supabase.from('imports').select('id',{count:'exact',head:true}).neq('status','processed'),
    supabase.from('user_recipes').select('recipe_id,is_favorite,tried_status'),
    supabase.from('recipes').select('id,title,image_url,total_minutes,categories(name),meal_types(name)').eq('review_status','recipe').order('created_at',{ascending:false}).limit(4)
   ]);

   const firstError=recipesRes.error||reviewRes.error||importsRes.error||userRes.error||recentRes.error;
   if(!active)return;
   if(firstError){setError(firstError.message);setLoading(false);return}

   const favorites=(userRes.data||[]).filter(x=>x.is_favorite).length;
   setData({
    recipes:recipesRes.count||0,
    pending:(reviewRes.count||0)+(importsRes.count||0),
    favorites,
    recent:recentRes.data||[]
   });
   setLoading(false);
  })();
  return()=>{active=false};
 },[]);

 return <>
  <section className="welcome">
   <div><span>Tu cocina empieza acá</span><h2>¿Qué cocinamos hoy?</h2><p>Guardá recetas, organizalas y convertí ese Reel que nunca volvés a encontrar en una receta de verdad.</p><button className="welcome-add" onClick={onAdd}><Plus/>Añadir receta</button></div>
   <ChefHat/>
  </section>

  {error&&<p className="message">No pude actualizar el resumen: {error}</p>}

  <div className="cards dashboard-cards">
   <button onClick={()=>onNavigate('Recetas')}><BookOpen/><b>Recetas</b><strong>{loading?'–':data.recipes}</strong><small>Tu biblioteca aprobada.</small><ArrowRight/></button>
   <button onClick={()=>onNavigate('Pendientes')}><Inbox/><b>Pendientes</b><strong>{loading?'–':data.pending}</strong><small>Importaciones y recetas por validar.</small><ArrowRight/></button>
   <button onClick={()=>onNavigate('Mi cocina')}><Heart/><b>Favoritas</b><strong>{loading?'–':data.favorites}</strong><small>Las que siempre querés repetir.</small><ArrowRight/></button>
  </div>

  <section className="home-recent">
   <div className="home-section-head"><div><small>ÚLTIMAS RECETAS</small><h2>Agregadas recientemente</h2></div>{data.recent.length>0&&<button onClick={()=>onNavigate('Recetas')}>Ver todas <ArrowRight/></button>}</div>
   {!loading&&data.recent.length===0?<div className="home-empty"><ChefHat/><p>Todavía no hay recetas aprobadas.</p><button onClick={onAdd}>Añadir la primera</button></div>
   :<div className="recent-grid">{data.recent.map(recipe=><button key={recipe.id} onClick={()=>onNavigate('Recetas')}>
     <div className="recent-thumb">{recipe.image_url?<img src={recipe.image_url} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<ChefHat/>}</div>
     <span><b>{recipe.title}</b><small>{[recipe.categories?.name,recipe.meal_types?.name].filter(Boolean).join(' · ')||'Receta'}</small>{recipe.total_minutes!=null&&<em><Clock/>{recipe.total_minutes} min</em>}</span>
    </button>)}</div>}
  </section>
 </>;
}
