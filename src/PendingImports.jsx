import React,{useEffect,useState} from 'react';
import {Inbox,Instagram,RefreshCw,ExternalLink} from 'lucide-react';
import {supabase} from './supabase.js';

const labels={queued:'Pendiente',processing:'Procesando',processed:'Procesada',failed:'Con error'};

export default function PendingImports(){
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  const {data,error}=await supabase.from('imports').select('id,source_type,source_url,pasted_content,status,error_message,recipe_id,created_at').order('created_at',{ascending:false});
  if(error)setError(error.message);else setItems(data||[]);
  setLoading(false);
 };
 useEffect(()=>{load()},[]);
 return <section className="pending-page">
  <div className="pending-head"><div><h2>Recetas pendientes</h2><p>Todo lo que guardes desde Instagram aparece acá mientras se procesa o necesita revisión.</p></div><button onClick={load}><RefreshCw/>Actualizar</button></div>
  {loading&&<div className="library-state"><Inbox/><p>Cargando pendientes...</p></div>}
  {!loading&&error&&<div className="library-state error"><p>No pudimos cargar los pendientes.</p><small>{error}</small></div>}
  {!loading&&!error&&items.length===0&&<div className="library-state"><Inbox/><h2>No hay pendientes</h2><p>Pegá un enlace de Instagram desde Añadir receta y lo vas a ver acá.</p></div>}
  {!loading&&!error&&items.length>0&&<div className="pending-list">{items.map(i=><article key={i.id}><div className="source-icon"><Instagram/></div><div className="pending-copy"><div><b>Instagram</b><span className={'status '+i.status}>{labels[i.status]||i.status}</span></div><a href={i.source_url} target="_blank" rel="noreferrer">{i.source_url}<ExternalLink/></a>{i.pasted_content&&<p>{i.pasted_content}</p>}{i.error_message&&<small className="pending-error">{i.error_message}</small>}</div></article>)}</div>}
 </section>;
}
