import React,{useEffect,useState} from 'react';
import {BookOpen,Heart,Inbox,ChefHat,Clock,ArrowRight,Plus,ShoppingBasket,FolderHeart} from 'lucide-react';
import {supabase} from './supabase.js';

const isJwtClockError=error=>/jwt issued at future|jwt/i.test(String(error?.message||error||''));

function RecipePreviews({recipes,onOpenRecipe}){
 return <div className="recent-grid">
  {recipes.map(recipe=><button type="button" key={recipe.id} onClick={()=>onOpenRecipe?.(recipe.id)}>
   <div className="recent-thumb">{recipe.image_url?<img key={recipe.image_url} src={recipe.image_url} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<ChefHat/>}</div>
   <span><b>{recipe.title}</b><small>{[recipe.categories?.name,recipe.meal_types?.name].filter(Boolean).join(' · ')||'Receta'}</small>{recipe.total_minutes!=null&&<em><Clock/>{recipe.total_minutes} min</em>}</span>
  </button>)}
 </div>;
}

export default function HomeDashboard({onNavigate,onAdd,onOpenRecipe,session}){
 const [data,setData]=useState({recipes:0,pending:0,favorites:0,recent:[],favoriteRecipes:[]});
 const [loading,setLoading]=useState(true);
 const [summaryReady,setSummaryReady]=useState(false);
 const [retryKey,setRetryKey]=useState(0);
 useEffect(()=>{const changed=e=>setData(d=>{const apply=rows=>rows.map(r=>{const u=e.detail?.find(x=>x.id===r.id);return u?{...r,image_url:u.image_url}:r});return {...d,recent:apply(d.recent),favoriteRecipes:apply(d.favoriteRecipes)}});window.addEventListener('chefcita-photos',changed);return()=>window.removeEventListener('chefcita-photos',changed)},[]);

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
   const mainError=recentRes.error;
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

  (async()=>{
   setLoading(true);
   setSummaryReady(false);
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
   <button type="button" className="welcome-instagram" onClick={onAdd}>
    <Plus/>
    <span><b>Guardar receta</b><small>Desde Instagram o escribirla a mano</small></span>
    <ArrowRight/>
   </button>
  </section>

  <div className="home-utility"><button onClick={()=>onNavigate('Compra')}><ShoppingBasket/><b>Lista de compra</b><ArrowRight/></button><button onClick={()=>onNavigate('Bibliotecas')}><FolderHeart/><b>Bibliotecas</b><ArrowRight/></button></div>

  <section className="home-recent">
   <div className="home-section-head">
    <div><h2>Últimas recetas</h2></div>
    {summaryReady&&data.recent.length>0&&<button type="button" onClick={()=>onNavigate('Recetas')}>Ver todas <ArrowRight/></button>}
   </div>
   {loading?<div className="home-loading" role="status">Cargando tus recetas…</div>
   :!summaryReady?<div className="home-empty"><p>No pudimos cargar tus recetas.</p><button type="button" onClick={()=>setRetryKey(key=>key+1)}>Volver a intentar</button></div>
   :data.recent.length>0?<RecipePreviews recipes={data.recent} onOpenRecipe={onOpenRecipe}/>
   :<div className="home-empty"><ChefHat/><p>Todavía no hay recetas guardadas.</p><button type="button" onClick={onAdd}>Guardar la primera</button></div>}
  </section>

  {summaryReady&&<section className="home-favorites">
   <div className="home-section-head">
    <div><h2>Favoritas</h2></div>
    {summaryReady&&data.favorites>0&&<button type="button" onClick={()=>onNavigate('Favoritas')}>Ver favoritas <ArrowRight/></button>}
   </div>
   {loading?<div className="home-loading" role="status">Cargando favoritas…</div>
   :!summaryReady?null
   :data.favoriteRecipes.length>0?<RecipePreviews recipes={data.favoriteRecipes} onOpenRecipe={onOpenRecipe}/>
   :<div className="home-empty home-empty-compact"><Heart/><p>{data.favorites>0?'Tenés recetas favoritas guardadas. Podés verlas todas desde el recetario.':'Marcá con el corazón las recetas que más te gusten y aparecerán acá.'}</p><button type="button" onClick={()=>onNavigate(data.favorites>0?'Favoritas':'Recetas')}>{data.favorites>0?'Ver favoritas':'Explorar recetas'}</button></div>}
  </section>}

 </div>;
}
