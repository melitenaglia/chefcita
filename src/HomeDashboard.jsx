import React,{useEffect,useState} from 'react';
import {BookOpen,Heart,Inbox,ChefHat,Clock,ArrowRight,Instagram} from 'lucide-react';
import {supabase} from './supabase.js';

const isJwtClockError=error=>/jwt issued at future|jwt/i.test(String(error?.message||error||''));

export default function HomeDashboard({onNavigate,onAdd,onOpenRecipe,session}){
 const [data,setData]=useState({recipes:0,pending:0,favorites:0,recent:[]});
 const [loading,setLoading]=useState(true);
 const [summaryReady,setSummaryReady]=useState(false);

 useEffect(()=>{
  let active=true;

  const fetchSummary=async()=>{
   const [recipesRes,reviewRes,importsRes,userRes,recentRes]=await Promise.all([
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','recipe'),
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','to_validate'),
    supabase.from('imports').select('id',{count:'exact',head:true}).neq('status','processed'),
    supabase.from('user_recipes').select('recipe_id,is_favorite,tried_status'),
    supabase.from('recipes').select('id,title,image_url,total_minutes,categories(name),meal_types(name)').eq('review_status','recipe').order('created_at',{ascending:false}).limit(4)
   ]);

   const mainError=recipesRes.error||reviewRes.error||importsRes.error||userRes.error||recentRes.error;
   if(mainError)return {error:mainError};

   return {
    data:{
     recipes:recipesRes.count||0,
     pending:(reviewRes.count||0)+(importsRes.count||0),
     favorites:(userRes.data||[]).filter(x=>x.is_favorite).length,
     recent:recentRes.data||[]
    }
   };
  };

  const ensureFreshAuth=async()=>{
   const {data:userData,error:userError}=await supabase.auth.getUser();
   if(!userError&&userData?.user)return true;

   try{
    const {data:refreshData,error:refreshError}=await supabase.auth.refreshSession();
    if(refreshError||!refreshData?.session)return false;
    await new Promise(resolve=>setTimeout(resolve,250));
    return true;
   }catch{
    return false;
   }
  };

  (async()=>{
   setLoading(true);
   setSummaryReady(false);

   const authReady=await ensureFreshAuth();
   if(!active)return;

   if(!authReady){
    setLoading(false);
    console.warn('No se pudo validar la sesión antes de cargar el resumen de inicio.');
    return;
   }

   let result=await fetchSummary();

   if(result.error&&isJwtClockError(result.error)){
    try{
     await supabase.auth.refreshSession();
     await new Promise(resolve=>setTimeout(resolve,350));
     result=await fetchSummary();
    }catch{}
   }

   if(!active)return;
   if(result.data){
    setData(result.data);
    setSummaryReady(true);
   }else{
    setSummaryReady(false);
   }
   if(result.error)console.warn('No se pudo actualizar el resumen de inicio.',result.error);
   setLoading(false);
  })();

  return()=>{active=false};
 },[session?.access_token]);

 return <>
  <section className="home-library-banner">
   <div><small>TU RECETARIO</small><b>Explorá lo que ya guardaste o sumá una receta nueva.</b></div>
   <button className="welcome-instagram" onClick={onAdd}>
    <Instagram/>
    <span><b>Guardar una receta</b><small>Copiá y pegá el enlace de Instagram</small></span>
    <ArrowRight/>
   </button>
  </section>

  <div className="cards dashboard-cards">
   <button onClick={()=>onNavigate('Recetas')}><BookOpen/><b>Recetas</b><strong>{loading||!summaryReady?'–':data.recipes}</strong><small>Tu biblioteca aprobada.</small><ArrowRight/></button>
   <button onClick={()=>onNavigate('Favoritas')}><Heart/><b>Favoritas</b><strong>{loading||!summaryReady?'–':data.favorites}</strong><small>Las que querés tener siempre a mano.</small><ArrowRight/></button>
   <button onClick={()=>onNavigate('Pendientes')}><Inbox/><b>Por revisar</b><strong>{loading||!summaryReady?'–':data.pending}</strong><small>Recetas guardadas que falta revisar.</small><ArrowRight/></button>
  </div>

  <section className="home-recent">
   <div className="home-section-head"><div><small>ÚLTIMAS RECETAS</small><h2>Agregadas recientemente</h2></div>{data.recent.length>0&&<button onClick={()=>onNavigate('Recetas')}>Ver todas <ArrowRight/></button>}</div>
   {!loading&&summaryReady&&data.recent.length===0?<div className="home-empty"><ChefHat/><p>Todavía no hay recetas aprobadas.</p><button onClick={onAdd}>Añadir la primera</button></div>
   :<div className="recent-grid">{data.recent.map(recipe=><button key={recipe.id} onClick={()=>onOpenRecipe?.(recipe.id)}>
     <div className="recent-thumb">{recipe.image_url?<img src={recipe.image_url} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<ChefHat/>}</div>
     <span><b>{recipe.title}</b><small>{[recipe.categories?.name,recipe.meal_types?.name].filter(Boolean).join(' · ')||'Receta'}</small>{recipe.total_minutes!=null&&<em><Clock/>{recipe.total_minutes} min</em>}</span>
    </button>)}</div>}
  </section>
 </>;
}
