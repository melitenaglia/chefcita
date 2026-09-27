import React,{useEffect,useRef,useState} from 'react';
import {BookOpen,Heart,Inbox,ChefHat,Clock,ArrowRight,Instagram,Sparkles,WandSparkles} from 'lucide-react';
import {supabase} from './supabase.js';

const IDEA_TYPES=['Desayuno','Almuerzo/Cena','Merienda','Snack','Postre','Bebida'];
const normalize=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
const isJwtClockError=error=>/jwt issued at future|jwt/i.test(String(error?.message||error||''));

export default function HomeDashboard({onNavigate,onAdd,onOpenRecipe,ideaFocusKey=0}){
 const [data,setData]=useState({recipes:0,pending:0,favorites:0,recent:[]});
 const [ideaOptions,setIdeaOptions]=useState([]);
 const [ideaType,setIdeaType]=useState('');
 const [ideaBusy,setIdeaBusy]=useState(false);
 const [ideaMessage,setIdeaMessage]=useState('');
 const [loading,setLoading]=useState(true);
 const [summaryReady,setSummaryReady]=useState(false);
 const ideaRef=useRef(null);
 const ideaSelectRef=useRef(null);

 useEffect(()=>{
  let active=true;

  const fetchSummary=async()=>{
   const [recipesRes,reviewRes,importsRes,userRes,recentRes,categoriesRes,mealTypesRes]=await Promise.all([
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','recipe'),
    supabase.from('recipes').select('id',{count:'exact',head:true}).eq('review_status','to_validate'),
    supabase.from('imports').select('id',{count:'exact',head:true}).neq('status','processed'),
    supabase.from('user_recipes').select('recipe_id,is_favorite,tried_status'),
    supabase.from('recipes').select('id,title,image_url,total_minutes,categories(name),meal_types(name)').eq('review_status','recipe').order('created_at',{ascending:false}).limit(4),
    supabase.from('categories').select('id,name').order('sort_order'),
    supabase.from('meal_types').select('id,name').order('sort_order')
   ]);

   const mainError=recipesRes.error||reviewRes.error||importsRes.error||userRes.error||recentRes.error;
   if(mainError)return {error:mainError};

   const allTaxonomies=[
    ...(categoriesRes.data||[]).map(x=>({...x,field:'category_id'})),
    ...(mealTypesRes.data||[]).map(x=>({...x,field:'meal_type_id'}))
   ];
   const options=IDEA_TYPES.map(label=>{
    const wanted=normalize(label);
    const row=allTaxonomies.find(x=>{
     const n=normalize(x.name);
     if(wanted==='almuerzocena')return n==='almuerzocena'||n==='almuerzoycena'||n==='almuerzo'||n==='cena';
     return n===wanted;
    });
    return row?{label,id:row.id,field:row.field}:null;
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

  (async()=>{
   setLoading(true);
   let result=await fetchSummary();

   if(result.error&&isJwtClockError(result.error)){
    try{
     await supabase.auth.refreshSession();
     await new Promise(resolve=>setTimeout(resolve,350));
     result=await fetchSummary();
    }catch{}
   }

   if(!active)return;
   if(result.data){setData(result.data);setSummaryReady(true)}
   else setSummaryReady(false);
   if(result.options)setIdeaOptions(result.options);
   if(result.error)console.warn('No se pudo actualizar el resumen de inicio.',result.error);
   setLoading(false);
  })();

  return()=>{active=false};
 },[]);

 useEffect(()=>{
  if(!ideaFocusKey)return;
  requestAnimationFrame(()=>{
   ideaRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
   setTimeout(()=>ideaSelectRef.current?.focus({preventScroll:true}),350);
  });
 },[ideaFocusKey]);

 const surpriseMe=async()=>{
  const option=ideaOptions.find(x=>x.label===ideaType);
  if(!option)return;
  setIdeaBusy(true);setIdeaMessage('');
  const {data:recipes,error}=await supabase.from('recipes').select('id').eq('review_status','recipe').eq(option.field,option.id);
  setIdeaBusy(false);
  if(error){
   if(isJwtClockError(error)){
    try{await supabase.auth.refreshSession()}catch{}
   }
   setIdeaMessage('No pude buscar una idea ahora. Probá de nuevo.');
   return;
  }
  if(!recipes?.length){
   setIdeaMessage(`Todavía no hay recetas de ${ideaType.toLowerCase()}.`);
   return;
  }
  const index=Math.floor(Math.random()*recipes.length);
  onOpenRecipe?.(recipes[index].id);
 };

 return <>
  <section className="idea-picker idea-picker-primary" ref={ideaRef}>
   <div className="idea-picker-copy"><WandSparkles/><span><small>¿SIN IDEAS?</small><b>Elegí el tipo de comida y Chefcita elige por vos.</b></span></div>
   <div className="idea-picker-actions">
    <select ref={ideaSelectRef} value={ideaType} onChange={e=>{setIdeaType(e.target.value);setIdeaMessage('')}} aria-label="Tipo de comida">
     <option value="">Tipo de comida</option>
     {ideaOptions.map(option=><option key={option.label} value={option.label}>{option.label}</option>)}
    </select>
    <button disabled={!ideaType||ideaBusy} onClick={surpriseMe}><Sparkles/>{ideaBusy?'Buscando...':'Dame una idea'}</button>
   </div>
   {ideaMessage&&<small className="idea-picker-message">{ideaMessage}</small>}
  </section>

  <section className="welcome home-welcome">
   <div className="welcome-copy">
    <span>TU RECETARIO</span>
    <h2>Tus recetas, a mano</h2>
    <p>Explorá lo que ya guardaste o sumá una receta nueva.</p>
    <button className="welcome-recipes" onClick={()=>onNavigate('Recetas')}><BookOpen/>Ver recetas</button>
   </div>
   <button className="welcome-instagram" onClick={onAdd}>
    <Instagram/>
    <span><b>Guardar desde Instagram</b><small>Pegá un Reel o post</small></span>
    <ArrowRight/>
   </button>
  </section>

  <div className="cards dashboard-cards">
   <button onClick={()=>onNavigate('Recetas')}><BookOpen/><b>Recetas</b><strong>{loading||!summaryReady?'–':data.recipes}</strong><small>Tu biblioteca aprobada.</small><ArrowRight/></button>
   <button onClick={()=>onNavigate('Mi cocina')}><Heart/><b>Favoritas</b><strong>{loading||!summaryReady?'–':data.favorites}</strong><small>Las que querés tener siempre a mano.</small><ArrowRight/></button>
   <button onClick={()=>onNavigate('Pendientes')}><Inbox/><b>Pendientes</b><strong>{loading||!summaryReady?'–':data.pending}</strong><small>Importaciones y recetas por validar.</small><ArrowRight/></button>
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
