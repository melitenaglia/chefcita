import React,{useEffect,useState} from 'react';
import {Inbox,Instagram,RefreshCw,ExternalLink} from 'lucide-react';
import {supabase} from './supabase.js';

const labels={queued:'Pendiente',processing:'Procesando',processed:'Procesada',failed:'Con error'};

export default function PendingImports(){
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [editing,setEditing]=useState(null);
 const [caption,setCaption]=useState('');
 const [busy,setBusy]=useState(false);

 const load=async()=>{
  setLoading(true);setError('');
  const {data,error}=await supabase.from('imports')
   .select('id,source_type,source_url,pasted_content,status,error_message,recipe_id,created_at,needs_input,input_message')
   .order('created_at',{ascending:false});
  if(error){setError(error.message);setItems([])}
  else setItems(data||[]);
  setLoading(false);
 };

 useEffect(()=>{load()},[]);

 const processImport=async id=>{
  setBusy(true);setError('');
  const {error}=await supabase.functions.invoke('process-recipe-import',{body:{import_id:id}});
  if(error)setError(error.message);
  setBusy(false);
  await load();
 };

 const saveCaption=async item=>{
  const text=caption.trim();
  if(!text)return;
  setBusy(true);setError('');
  const {error}=await supabase.from('imports').update({
   pasted_content:text,needs_input:false,input_message:null,status:'queued'
  }).eq('id',item.id);
  if(error){setBusy(false);setError(error.message);return}
  setEditing(null);setCaption('');
  setBusy(false);
  await processImport(item.id);
 };

 return <section className="pending-page">
  <div className="pending-head">
   <div><h2>Recetas pendientes</h2><p>Acá aparecen los enlaces de Instagram mientras recuperamos su contenido y quedan listos para validar.</p></div>
   <button onClick={load}><RefreshCw/>Actualizar</button>
  </div>
  {loading&&<div className="library-state"><Inbox/><p>Cargando pendientes...</p></div>}
  {!loading&&error&&<div className="library-state error"><p>No pudimos cargar los pendientes.</p><small>{error}</small><button onClick={load}>Reintentar</button></div>}
  {!loading&&!error&&items.length===0&&<div className="library-state"><Inbox/><h2>No hay pendientes</h2><p>Pegá un Reel o post desde Añadir receta y aparecerá acá.</p></div>}
  {!loading&&!error&&items.length>0&&<div className="pending-list">{items.map(item=><article key={item.id}>
   <div className="source-icon"><Instagram/></div>
   <div className="pending-copy">
    <div><b>Instagram</b><span className={'status '+item.status}>{labels[item.status]||item.status}</span></div>
    <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_url}<ExternalLink/></a>
    {item.pasted_content&&<p>{item.pasted_content}</p>}
    {item.input_message&&<small className="pending-info">{item.input_message}</small>}
    {item.error_message&&<small className="pending-error">{item.error_message}</small>}
    <div className="pending-actions">
     {item.needs_input
      ?<button onClick={()=>{setEditing(item.id);setCaption(item.pasted_content||'')}}>Pegar texto</button>
      :item.status!=='processed'&&<button disabled={busy} onClick={()=>processImport(item.id)}>Procesar</button>}
    </div>
    {editing===item.id&&<div className="caption-editor">
     <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Pegá el caption o texto de la publicación..."/>
     <div><button onClick={()=>{setEditing(null);setCaption('')}}>Cancelar</button><button disabled={busy||!caption.trim()} onClick={()=>saveCaption(item)}>Guardar y procesar</button></div>
    </div>}
   </div>
  </article>)}</div>}
 </section>;
}
