import React,{useEffect,useState} from 'react';
import {ChefHat,Clock,ArrowRight,Sparkles,WandSparkles} from 'lucide-react';
import {supabase} from './supabase.js';

/* Página de inspiración, independiente del panel de Inicio. */
const IDEA_TYPES=['Desayuno','Almuerzo/Cena','Merienda','Snack','Postre','Bebida'];
const normalize=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
const isJwtClockError=error=>/jwt issued at future|jwt/i.test(String(error?.message||error||''));

export default function IdeasPage({onOpenRecipe,session}){
 const [ideaOptions,setIdeaOptions]=useState([]);
 const [ideaType,setIdeaType]=useState('');
 const [ideaBusy,setIdeaBusy]=useState(false);
 const [ideaMessage,setIdeaMessage]=useState('');
 const [ideaPool,setIdeaPool]=useState([]);
 const [ideaRecipe,setIdeaRecipe]=useState(null);
 const [loading,setLoading]=useState(true);

 useEffect(()=>{
  let active=true;
  const loadCategories=async()=>{
   setLoading(true);
   let {data,error}=await supabase.from('categories').select('id,name').order('sort_order');
   if(error&&isJwtClockError(error)){
    try{
     await supabase.auth.refreshSession();
     ({data,error}=await supabase.from('categories').select('id,name').order('sort_order'));
    }catch{}
   }
   if(!active)return;
   if(error){
    setIdeaMessage('No pudimos cargar los tipos de comida. Probá volver a entrar a Ideas.');
    setLoading(false);
    return;
   }
   const categories=data||[];
   const options=IDEA_TYPES.map(label=>{
    const wanted=normalize(label);
    const matches=categories.filter(item=>{
     const name=normalize(item.name);
     if(wanted==='almuerzocena')return ['almuerzocena','almuerzoycena','almuerzo','cena'].includes(name);
     return name===wanted;
    });
    return matches.length?{label,ids:matches.map(item=>item.id)}:null;
   }).filter(Boolean);
   setIdeaOptions(options);
   setLoading(false);
  };
  loadCategories();
  return()=>{active=false};
 },[session?.access_token]);

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


 return <div className="ideas-page">
  <section className="idea-hero">
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
  {!loading&&ideaOptions.length===0&&<div className="ideas-empty"><ChefHat/><p>Todavía no hay categorías disponibles para sugerirte una receta.</p></div>}
 </div>;
}
