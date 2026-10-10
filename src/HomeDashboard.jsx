import React,{useEffect,useRef,useState} from 'react';
import {BookOpen,Heart,Inbox,ChefHat,Clock,ArrowRight,Instagram,Sparkles,WandSparkles} from 'lucide-react';
import {supabase} from './supabase.js';

const IDEA_TYPES=['Desayuno','Almuerzo/Cena','Merienda','Snack','Postre','Bebida'];
const normalize=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
const isJwtClockError=error=>/jwt issued at future|jwt/i.test(String(error?.message||error||''));

export default function HomeDashboard({onNavigate,onAdd,onOpenRecipe,ideaFocusKey=0,session}){
 const [data,setData]=useState({recipes:0,pending:0,favorites:0,recent:[]});
 const [ideaOptions,setIdeaOptions]=useState([]);
 const [ideaType,setIdeaType]=useState('');
 const [ideaBusy,setIdeaBusy]=useState(false);
 const [ideaMessage,setIdeaMessage]=useState('');
 const [ideaPool,setIdeaPool]=useState([]);
 const [ideaRecipe,setIdeaRecipe]=useState(null);
 const [loading,setLoading]=useState(true);
 const [summaryReady,setSummaryReady]=useState(false);
 const ideaRef=useRef(null);

 useEffect(()=>{
  let active=true;

  const fetchSummary=async()=>{
   const [recipesRes,reviewRes,importsRes,userRes,recentRes,categoriesRes]=await Promise.all([
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','recipe'),
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','to_validate'),
    supabase.from('imports').select('id',{count:'exact',head:true}).neq('status','processed'),
    supabase.from('user_recipes').select('recipe_id,is_favorite,tried_status'),
    supabase.from('recipes').select('id,title,image_url,total_minutes,categories(name),meal_types(name)').eq('review_status','recipe').order('created_at',{ascending:false}).limit(4),
    supabase.from('categories').select('id,name').order('sort_order')
   ]);

   const mainError=recipesRes.error||reviewRes.error||importsRes.error||userRes.error||recentRes.error;
   if(mainError)return {error:mainError};

   const categories=categoriesRes.data||[];
   const options=IDEA_TYPES.map(label=>{
    const wanted=normalize(label);
    const matches=categories.filter(x=>{
     const n=normalize(x.name);
     if(wanted==='almuerzocena')return ['almuerzocena','almuerzoycena','almuerzo','cena'].includes(n);
     return n===wanted;
    });
    return matches.length?{label,ids:matches.map(x=>x.id)}:null;
   }).filter(Boolean);

   return {
    data:{
     recipes:recipesRes.count||0,
     pending:(reviewRes.count||0)+(importsRes.count||0),
     favorites:(userRes.data||[]).filter(x=>x.is_favorite).length,
     recent:recentRes.data||[]
    },
    options
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
   if(result.options)setIdeaOptions(result.options);
   if(result.error)console.warn('No se pudo actualizar el resumen de inicio.',result.error);
   setLoading(false);
  })();

  return()=>{active=false};
 },[session?.access_token]);

 useEffect(()=>{
  if(!ideaFocusKey)return;
  const frame=requestAnimationFrame(()=>{
   ideaRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  return()=>cancelAnimationFrame(frame);
 },[ideaFocusKey]);

 const pickDifferent=pool=>{
  if(!pool.length)return null;
  const options=ideaRecipe&&pool.length>1?pool.filter(x=>x.id!==ideaRecipe.id):pool;
  return options[Math.floor(Math.random()*options.length)]||pool[0];
 };

 const surpriseMe=async({reuse=false}={})=>{
  const option=ideaOptions.find(x=>x.label===ideaType);
  if(!option)return;
  setIdeaBusy(true);setIdeaMessage('');

  let pool=reuse?ideaPool:[];
  if(!pool.length){
   const {data:recipes,error}=await supabase.from('recipes')
    .select('id,title,description,image_url,total_minutes,categories(name),meal_types(name)')
    .eq('review_status','recipe')
    .in('category_id',option.ids);

   if(error){
    setIdeaBusy(false);
    if(isJwtClockError(error)){
     try{await supabase.auth.refreshSession()}catch{}
    }
    setIdeaMessage('No pude buscar una idea ahora. Probá de nuevo.');
    return;
   }
   pool=recipes||[];
   setIdeaPool(pool);
  }

  setIdeaBusy(false);
  if(!pool.length){
   setIdeaRecipe(null);
   setIdeaMessage(`Todavía no hay recetas de ${ideaType.toLowerCase()}.`);
   return;
  }

  setIdeaRecipe(pickDifferent(pool));
 };

 return <>
  <section className="idea-hero" ref={ideaRef}>
   <div className="idea-hero-copy">
    <span className="idea-hero-icon"><WandSparkles/></span>
    <div>
     <h2>¿Qué cocinamos hoy?</h2>
     <p>Elegí el momento del día y Chefcita te propone una receta al azar.</p>
    </div>
   </div>
   <div className="idea-hero-actions">
    <select value={ideaType} onChange={e=>{setIdeaType(e.target.value);setIdeaMessage('');setIdeaPool([]);setIdeaRecipe(null)}} aria-label="Tipo de comida">
     <option value="">Elegí el tipo de comida</option>
     {ideaOptions.map(option=><option key={option.label} value={option.label}>{option.label}</option>)}
    </select>
    <button disabled={!ideaType||ideaBusy} onClick={()=>surpriseMe()}><Sparkles/>{ideaBusy?'Buscando...':'Dame una idea'}</button>
   </div>
   {ideaMessage&&<small className="idea-hero-message">{ideaMessage}</small>}
   {ideaRecipe&&<article className="idea-result-card">
    <div className="idea-result-image">{ideaRecipe.image_url?<img src={ideaRecipe.image_url} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<ChefHat/>}</div>
    <div className="idea-result-copy">
     <div className="idea-result-meta">{[ideaRecipe.categories?.name,ideaRecipe.meal_types?.name].filter(Boolean).map(x=><span key={x}>{x}</span>)}</div>
     <h3>{ideaRecipe.title}</h3>
     {ideaRecipe.description&&<p>{ideaRecipe.description}</p>}
     {ideaRecipe.total_minutes!=null&&<small><Clock/>{ideaRecipe.total_minutes} min</small>}
     <div className="idea-result-actions">
      <button className="secondary" onClick={()=>surpriseMe({reuse:true})} disabled={ideaBusy||ideaPool.length<=1}><Sparkles/>Otra idea</button>
      <button className="primary" onClick={()=>onOpenRecipe?.(ideaRecipe.id)}>Ver receta <ArrowRight/></button>
     </div>
    </div>
   </article>}
  </section>

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
