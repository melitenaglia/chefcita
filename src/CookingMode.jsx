import React,{useEffect,useRef,useState} from 'react';
import {X,Check,ChevronLeft,ChevronRight,Sun} from 'lucide-react';
import {ingredientView} from './cookingTools.js';
export default function CookingMode({recipe,ingredients,steps,ratio,portions,sourceUrl,onClose}){
 const [checked,setChecked]=useState(new Set());const [phase,setPhase]=useState('ingredients');const [step,setStep]=useState(0);const [awake,setAwake]=useState('Solicitando pantalla encendida…');const lock=useRef(null);
 useEffect(()=>{
  let cancelled=false;
  const acquire=async()=>{
   if(document.visibilityState!=='visible')return;
   if(!navigator.wakeLock?.request){setAwake('Este navegador no permite mantener la pantalla encendida.');return}
   try{const handle=await navigator.wakeLock.request('screen');if(cancelled){await handle.release();return}lock.current=handle;setAwake('Pantalla encendida mientras cocinás');handle.addEventListener('release',()=>{if(!cancelled)setAwake('La pantalla puede apagarse. Revisá el ahorro de batería.')})}catch{if(!cancelled)setAwake('El móvil no permitió mantener la pantalla encendida.')}
  };
  const changed=()=>{if(document.visibilityState==='visible'&&(!lock.current||lock.current.released))acquire()};
  acquire();document.addEventListener('visibilitychange',changed);
  return()=>{cancelled=true;document.removeEventListener('visibilitychange',changed);lock.current?.release().catch(()=>{});lock.current=null};
 },[]);
 const current=steps[step];
 return <div className="share-panel-backdrop"><section className="share-panel cooking-mode" role="dialog" aria-modal="true" aria-label="Modo cocinar">
  <div className="share-panel-head"><b>Modo cocinar</b><button onClick={onClose} aria-label="Cerrar"><X/></button></div>
  <h2>{recipe.title}</h2><p className="tool-note"><Sun/>{awake}</p>{portions&&<small>{portions} {recipe.servings_unit||'porciones'}</small>}
  {phase==='ingredients'?<><h3>Prepará los ingredientes</h3><div className="cooking-checks">{ingredients.map((item,i)=>{const d=ingredientView(item,ratio);return <button key={item.id||i} aria-pressed={checked.has(i)} className={checked.has(i)?'done':''} onClick={()=>setChecked(old=>{const next=new Set(old);if(next.has(i))next.delete(i);else next.add(i);return next})}><span className="cooking-checkbox">{checked.has(i)&&<Check/>}</span><span><b>{[d.quantity,d.name].filter(Boolean).join(' ')}</b>{d.note&&<small>{d.note}</small>}</span></button>})}</div>{!ingredients.length&&<p>No hay ingredientes detallados. Podés consultar la publicación original.</p>}<button className="primary" onClick={()=>setPhase('steps')}>Empezar preparación<ChevronRight/></button></>:phase==='steps'&&current?<><small>Paso {step+1} de {steps.length}</small><p className="cooking-instruction">{current.instruction}</p>{(current.duration_minutes||current.temperature_c||current.note)&&<p className="tool-note">{[current.duration_minutes?`${current.duration_minutes} min`:null,current.temperature_c?`${current.temperature_c} °C`:null,current.note].filter(Boolean).join(' · ')}</p>}<div className="cooking-step-nav"><button className="secondary" onClick={()=>step?setStep(n=>n-1):setPhase('ingredients')}><ChevronLeft/>{step?'Anterior':'Ingredientes'}</button><button className="primary" onClick={()=>step<steps.length-1?setStep(n=>n+1):setPhase('done')}>{step<steps.length-1?'Siguiente':'Terminé'}<ChevronRight/></button></div></>:phase==='done'?<><h3>¡Listo!</h3><p>Podés marcar la receta como probada desde su menú.</p><button className="primary" onClick={onClose}>Volver a la receta</button></>:<><p>El paso a paso está en la publicación original.</p>{sourceUrl&&<a className="secondary" href={sourceUrl} target="_blank" rel="noreferrer">Abrir receta original</a>}<button className="secondary" onClick={()=>setPhase('ingredients')}>Volver a ingredientes</button></>}
 </section></div>;
}
