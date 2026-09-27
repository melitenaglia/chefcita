import React,{useEffect,useState} from 'react';
import {Inbox,Instagram,RefreshCw,ExternalLink,Trash2,Sparkles,PenLine} from 'lucide-react';
import {supabase} from './supabase.js';

const labels={queued:'Pendiente',processing:'Procesando',processed:'Procesada',failed:'Con error'};

export default function PendingImports(){
 const [items,setItems]=useState([]);
 const [view,setView]=useState('pending');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [editing,setEditing]=useState(null);
 const [caption,setCaption]=useState('');
 const [busy,setBusy]=useState(false);

 const load=async()=>{
  setLoading(true);setError('');
  const {data,error}=await supabase.from('imports')
   .select('id,source_type,source_url,pasted_content,extracted_content,status,error_message,recipe_id,created_at,needs_input,input_message,processing_mode,user_hints,content_quality,content_score,ai_scope')
   .order('created_at',{ascending:false});
  if(error){setError(error.message);setItems([])}
  else{
   const rows=data||[];
   setItems(rows);
   const firstNeedsInput=rows.find(x=>x.status!=='processed'&&x.needs_input);
   if(firstNeedsInput&&editing===null){
    setEditing(firstNeedsInput.id);
    setCaption(firstNeedsInput.pasted_content||firstNeedsInput.extracted_content||'');
   }
  }
  setLoading(false);
 };

 useEffect(()=>{load()},[]);

 const processImport=async(id,extra={})=>{
  setBusy(true);setError('');
  const {error}=await supabase.functions.invoke('process-recipe-import',{body:{import_id:id,...extra}});
  if(error)setError(error.message);
  setBusy(false);
  await load();
 };

 const saveCaption=async item=>{
  const text=caption.trim();
  if(!text)return;
  setBusy(true);setError('');
  const {error}=await supabase.from('imports').update({
   pasted_content:text,needs_input:false,input_message:null,status:'queued',content_quality:'unknown',content_score:0
  }).eq('id',item.id);
  if(error){setBusy(false);setError(error.message);return}
  setEditing(null);setCaption('');
  setBusy(false);
  await processImport(item.id);
 };

 const saveWithoutAi=async item=>{
  setBusy(true);setError('');
  const {error}=await supabase.from('imports').update({processing_mode:'manual',status:'queued',needs_input:false,error_message:null}).eq('id',item.id);
  if(error){setBusy(false);setError(error.message);return}
  setBusy(false);
  await processImport(item.id);
 };

 const discard=async item=>{
  if(!window.confirm('¿Descartar esta importación?'))return;
  setBusy(true);setError('');
  const {error}=await supabase.from('imports').delete().eq('id',item.id);
  setBusy(false);
  if(error){setError(error.message);return}
  await load();
 };

 const canOfferChoice=item=>item.status!=='processed'&&(item.content_quality==='limited'||item.needs_input);
 const pendingItems=items.filter(item=>item.status!=='processed');
 const processedItems=items.filter(item=>item.status==='processed');
 const visibleItems=view==='processed'?processedItems:pendingItems;

 return <section className="pending-page">
  <div className="pending-head">
   <div><h2>Importaciones</h2><p>Separá lo que todavía necesita atención de lo que Chefcita ya procesó.</p></div>
   <button onClick={load}><RefreshCw/>Actualizar</button>
  </div>

  <div className="import-status-tabs">
   <button className={view==='pending'?'active':''} onClick={()=>setView('pending')}>
    Por procesar <span>{pendingItems.length}</span>
   </button>
   <button className={view==='processed'?'active':''} onClick={()=>{setView('processed');setEditing(null);setCaption('')}}>
    Procesadas <span>{processedItems.length}</span>
   </button>
  </div>

  {loading&&<div className="library-state"><Inbox/><p>Cargando pendientes...</p></div>}
  {!loading&&error&&<div className="library-state error"><p>No pudimos cargar los pendientes.</p><small>{error}</small><button onClick={load}>Reintentar</button></div>}
  {!loading&&!error&&items.length===0&&<div className="library-state"><Inbox/><h2>No hay importaciones</h2><p>Pegá un Reel o post desde Añadir receta y aparecerá acá.</p></div>}

  {!loading&&!error&&items.length>0&&visibleItems.length===0&&<div className="library-state"><Inbox/><h2>{view==='processed'?'Todavía no hay procesadas':'Todo procesado'}</h2><p>{view==='processed'?'Cuando Chefcita termine una importación, la vas a encontrar acá.':'No hay importaciones que necesiten atención.'}</p></div>}

  {!loading&&!error&&visibleItems.length>0&&<div className="pending-list">{visibleItems.map(item=><article key={item.id}>
   <div className="source-icon"><Instagram/></div>
   <div className="pending-copy">
    <div className="pending-row-title">
     <b>{item.user_hints?.title||'Instagram'}</b>
     <span className={'status '+item.status}>{labels[item.status]||item.status}</span>
     {item.processing_mode==='manual'&&<span className="status no-ai">Sin IA</span>}
     {item.processing_mode!=='manual'&&<span className="status scope">{item.ai_scope==='full'?'Completa':'Ficha rápida'}</span>}
     {item.needs_input&&<span className="status paused">Falta caption</span>}
     {item.content_quality==='limited'&&item.status!=='processed'&&<span className="status paused">IA detenida</span>}
     {item.content_quality==='good'&&item.status!=='processed'&&<span className="status good">Contenido útil</span>}
    </div>

    <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_url}<ExternalLink/></a>

    {(item.pasted_content||item.extracted_content)&&<p>{item.pasted_content||item.extracted_content}</p>}
    {item.input_message&&<small className="pending-info">{item.input_message}</small>}
    {item.error_message&&<small className="pending-error">{item.error_message}</small>}

    {item.user_hints?.tags?.length>0&&<div className="mini-tags">{item.user_hints.tags.map(tag=><span key={tag}>{tag}</span>)}</div>}

    <div className="pending-actions">
     {canOfferChoice(item)&&<>
      {item.needs_input&&<button disabled={busy} onClick={()=>processImport(item.id)}><RefreshCw/>Reintentar lectura</button>}
      <button onClick={()=>{setEditing(item.id);setCaption(item.pasted_content||item.extracted_content||'')}}><PenLine/>Pegar caption</button>
      <button disabled={busy} onClick={()=>saveWithoutAi(item)}>Guardar para completar · 0 IA</button>
      {item.content_quality==='limited'&&<button className="force-ai" disabled={busy} onClick={()=>processImport(item.id,{force_ai:true})}><Sparkles/>Procesar igual</button>}
     </>}
     {!canOfferChoice(item)&&item.status==='queued'&&<button disabled={busy} onClick={()=>processImport(item.id)}><Sparkles/>Procesar</button>}
     {item.status==='failed'&&<button disabled={busy} onClick={()=>processImport(item.id)}>Reintentar</button>}
     {item.status!=='processed'&&<button className="danger-lite" disabled={busy} onClick={()=>discard(item)}><Trash2/>Descartar</button>}
    </div>

    {editing===item.id&&<div className="caption-editor">
     <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Pegá el caption o texto completo de la receta..."/>
     <div><button onClick={()=>{setEditing(null);setCaption('')}}>Cancelar</button><button disabled={busy||!caption.trim()} onClick={()=>saveCaption(item)}>Guardar y volver a evaluar</button></div>
    </div>}
   </div>
  </article>)}</div>}
 </section>;
}
