import React,{useEffect,useState} from 'react';
import {Inbox,Instagram,RefreshCw,ExternalLink} from 'lucide-react';
import {supabase} from './supabase.js';

const labels={queued:'Pendiente',processing:'Procesando',processed:'Procesada',failed:'Con error'};

export default function PendingImports(){
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [editing,setEditing]=useState(null);const [caption,setCaption]=useState('');const [busy,setBusy]=useState(false);
 const process=async id=>{setBusy(true);setError('');const {error}=await supabase.functions.invoke('process-recipe-import',{body:{import_id:id}});setBusy(false);if(error)setError(error.message);await load()};
 const saveCaption=async item=>{if(!caption.trim())return;setBusy(true);const {error}=await supabase.from('imports').update({pasted_content:caption.trim(),needs_input:false,input_message:null}).eq('id',item.id);setBusy(false);if(error){setError(error.message);return}setEditing(null);setCaption('');await process(item.id)};
 const load=async()=>{
  setLoading(true);setError('');
  const {data,error}=await supabase.from('imports').select('id,source_type,source_url,pasted_content,status,error_message,recipe_id,created_at,needs_input,input_message').order('created_at',{ascending:false});
  if(error)setError(error.message);else setItems(data||[]);
  setLoading(false);
 };
 useEffect(()=>{load()},[]);
 return <section className="pending-page">
  <div className="pending-head"><div><h2>Recetas pendientes</h2><p>Todo lo que guardes desde Instagram aparece acá mientras se procesa o necesita revisión.</p></div><button onClick={load}><RefreshCw/>Actualizar</button></div>
  {loading&&<div className="library-state"><Inbox/><p>Cargando pendientes...</p></div>}
  {!loading&&error&&<div className="library-state error"><p>No pudimos cargar los pendientes.</p><small>{error}</small></div>}
  {!loading&&!error&&items.length===0&&<div className="library-state"><Inbox/><h2>No hay pendientes</h2><p>Pegá un enlace de Instagram desde Añadir receta y lo vas a ver acá.</p></div>}
  {!loading&&!error&&items.length>0&&<div className="pending-list">{items.map(i=><article key={i.id}><div className="source-icon"><Instagram/></div><div className="pending-copy"><div><b>Instagram</b><span className={'status '+i.status}>{labels[i.status]||i.status}</span></div><a href={i.source_url} target="_blank" rel="noreferrer">{i.source_url}<ExternalLink/></a>{i.pasted_content&&<p>{i.pasted_content}</p>}{i.input_message&&<small className="pending-info">{i.input_message}</small>}{i.error_message&&<small className="pending-error">{i.error_message}</small>}<div className="pending-actions">{i.needs_input?<button onClick={()=>{setEditing(i.id);setCaption(i.pasted_content||'')}}>Pegar texto</button>:i.status!=='processed'&&<button disabled={busy} onClick={()=>process(i.id)}>Procesar</button>}</div>{editing===i.id&&<div className="caption-editor"><textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Pegá el caption o texto de la publicación..."/><div><button onClick={()=>setEditing(null)}>Cancelar</button><button disabled={busy||!caption.trim()} onClick={()=>saveCaption(i)}>Guardar y procesar</button></div></div>}</div></article>)}</div>}
 </section>;
}
