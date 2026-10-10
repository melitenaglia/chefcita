import React,{useEffect,useState} from 'react';
import {BookOpen,Heart,Inbox,ChefHat,Clock,ArrowRight,Instagram} from 'lucide-react';
import {supabase} from './supabase.js';

const isJwtClockError=error=>/jwt issued at future|jwt/i.test(String(error?.message||error||''));

function RecipePreviews({recipes,onOpenRecipe}){
 return <div className="recent-grid">
  {recipes.map(recipe=><button type="button" key={recipe.id} onClick={()=>onOpenRecipe?.(recipe.id)}>
   <div className="recent-thumb">{recipe.image_url?<img src={recipe.image_url} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<ChefHat/>}</div>
   <span><b>{recipe.title}</b><small>{[recipe.categories?.name,recipe.meal_types?.name].filter(Boolean).join(' · ')||'Receta'}</small>{recipe.total_minutes!=null&&<em><Clock/>{recipe.total_minutes} min</em>}</span>
  </button>)}
 </div>;
}

export default function HomeDashboard({onNavigate,onAdd,onOpenRecipe,session}){
 const [data,setData]=useState({recipes:0,pending:0,favorites:0,recent:[],favoriteRecipes:[]});
 const [loading,setLoading]=useState(true);
 const [summaryReady,setSummaryReady]=useState(false);
 const [retryKey,setRetryKey]=useState(0);

 useEffect(()=>{
  let active=true;
  const fetchSummary=async()=>{
   const [recipesRes,reviewRes,importsRes,userRes,recentRes,favoriteRes]=await Promise.all([
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','recipe'),
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','to_validate'),
    supabase.from('imports').select('id',{count:'exact',head:true}).neq('status','processed'),
    supabase.from('user_recipes').select('recipe_id,is_favorite').eq('user_id',session.user.id),
    supabase.from('recipes').select('id,title,image_url,total_minutes,categories(name),meal_types(name)').eq('review_status','recipe').order('created_at',{ascending:false}).limit(4),
    supabase.from('recipes').select('id,title,image_url,total_minutes,categories(name),meal_types(name),user_recipes!inner(is_favorite,user_id)')
     .eq('review_status','recipe').eq('user_recipes.is_favorite',true).eq('user_recipes.user_id',session.user.id)
     .order('created_at',{ascending:false}).limit(4)
   ]);
   const mainError=recipesRes.error||reviewRes.error||importsRes.error||userRes.error||recentRes.error;
   if(mainError)return {error:mainError};
   if(favoriteRes.error)console.warn('No se pudo cargar la vista previa de favoritas.',favoriteRes.error);
   return {data:{
    recipes:recipesRes.count||0,
    pending:(reviewRes.count||0)+(importsRes.count||0),
    favorites:(userRes.data||[]).filter(row=>row.is_favorite).length,
    recent:recentRes.data||[],
    favoriteRecipes:favoriteRes.data||[]
   }};
  };

  const ensureFreshAuth=async()=>{
   const {data:userData,error:userError}=await supabase.auth.getUser();
   if(!userError&&userData?.user)return true;
   try{
    const {data:refreshData,error:refreshError}=await supabase.auth.refreshSession();
    if(refreshError||!refreshData?.session)return false;
    await new Promise(resolve=>setTimeout(resolve,250));
    return true;
   }catch{return false}
  };

  (async()=>{
   setLoading(true);
   setSummaryReady(false);
   const authReady=await ensureFreshAuth();
   if(!active)return;
   if(!authReady){
    setLoading(false);
    console.warn('No se pudo validar la sesión antes de cargar el resumen de Inicio.');
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
   }else console.warn('No se pudo actualizar el resumen de Inicio.',result.error);
   setLoading(false);
  })();
  return()=>{active=false};
 },[session?.access_token,retryKey]);

 return <div className="home-dashboard">
  <section className="home-library-banner home-save-section">
   <div>
    <small>GUARDAR UNA RECETA</small>
    <b>¿Viste una receta que te gustó? Guardala acá para tenerla siempre a mano.</b>
   </div>
   <button type="button" className="welcome-instagram" onClick={onAdd}>
    <Instagram/>
    <span><b>Guardar receta</b><small>Desde Instagram o escribirla a mano</small></span>
    <ArrowRight/>
   </button>
  </section>

  <section className="home-recent">
   <div className="home-section-head">
    <div><small>TU RECETARIO</small><h2>Últimas recetas añadidas</h2></div>
    {summaryReady&&data.recent.length>0&&<button type="button" onClick={()=>onNavigate('Recetas')}>Ver todas <ArrowRight/></button>}
   </div>
   {loading?<div className="home-loading" role="status">Cargando tus recetas…</div>
   :!summaryReady?<div className="home-empty"><p>No pudimos cargar tus recetas.</p><button type="button" onClick={()=>setRetryKey(key=>key+1)}>Volver a intentar</button></div>
   :data.recent.length>0?<RecipePreviews recipes={data.recent} onOpenRecipe={onOpenRecipe}/>
   :<div className="home-empty"><ChefHat/><p>Todavía no hay recetas guardadas.</p><button type="button" onClick={onAdd}>Guardar la primera</button></div>}
  </section>

  <section className="home-favorites">
   <div className="home-section-head">
    <div><small>PARA TENER A MANO</small><h2>Tus favoritas</h2></div>
    {summaryReady&&data.favorites>0&&<button type="button" onClick={()=>onNavigate('Favoritas')}>Ver favoritas <ArrowRight/></button>}
   </div>
   {loading?<div className="home-loading" role="status">Cargando favoritas…</div>
   :!summaryReady?null
   :data.favoriteRecipes.length>0?<RecipePreviews recipes={data.favoriteRecipes} onOpenRecipe={onOpenRecipe}/>
   :<div className="home-empty home-empty-compact"><Heart/><p>Marcá con el corazón las recetas que más te gusten y aparecerán acá.</p><button type="button" onClick={()=>onNavigate('Recetas')}>Explorar recetas</button></div>}
  </section>

  <section className="home-shortcuts-section">
   <div className="home-section-head"><div><small>ACCESOS RÁPIDOS</small><h2>Tu recetario de un vistazo</h2></div></div>
   <div className="cards dashboard-cards home-shortcuts">
    <button type="button" onClick={()=>onNavigate('Recetas')}><BookOpen/><b>Todas las recetas</b><strong>{loading||!summaryReady?'–':data.recipes}</strong><small>Buscá ingredientes, platos y categorías.</small><ArrowRight/></button>
    <button type="button" onClick={()=>onNavigate('Pendientes')}><Inbox/><b>Por revisar</b><strong>{loading||!summaryReady?'–':data.pending}</strong><small>Recetas importadas que falta revisar.</small><ArrowRight/></button>
   </div>
  </section>
 </div>;
}
