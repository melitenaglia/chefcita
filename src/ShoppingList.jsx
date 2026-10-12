import React,{useEffect,useState} from 'react';
import {Check,Plus,Trash2} from 'lucide-react';
import {loadShopping,saveShopping} from './cookingTools.js';
export default function ShoppingList({session}){
 const userId=session.user.id;
 const [rows,setRows]=useState(()=>loadShopping(userId));const [text,setText]=useState('');const [error,setError]=useState('');
 useEffect(()=>{const refresh=()=>setRows(loadShopping(userId));window.addEventListener('storage',refresh);window.addEventListener('chefcita-shopping',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('chefcita-shopping',refresh)}},[userId]);
 const update=next=>{try{saveShopping(userId,next);setRows(next);setError('')}catch{setError('No pude guardar la lista. Revisá que el navegador permita guardar datos.')}};
 const groups=[...new Set(rows.map(r=>r.recipeTitle||'Otros productos'))];
 return <section className="shopping-page"><p className="tool-note">Añadí ingredientes desde una receta o escribí lo que falte. Se guarda en este dispositivo para tu cuenta.</p>
  <form className="shopping-add" onSubmit={e=>{e.preventDefault();if(!text.trim())return;update([...rows,{id:crypto.randomUUID(),name:text.trim(),quantity:'',done:false}]);setText('')}}><label htmlFor="shopping-item">Añadir un producto</label><div><input id="shopping-item" value={text} onChange={e=>setText(e.target.value)} placeholder="Ej. Leche"/><button className="secondary" disabled={!text.trim()}><Plus/>Añadir</button></div></form>
  {error&&<p role="alert">{error}</p>}
  {!rows.length&&<div className="library-state"><h2>Tu lista está vacía</h2><p>Abrí una receta y elegí Añadir a la compra.</p></div>}
  {groups.map(group=><section className="shopping-group" key={group}><h2>{group}</h2>{rows.filter(r=>(r.recipeTitle||'Otros productos')===group).map(row=><div className={row.done?'shopping-item done':'shopping-item'} key={row.id}><button className="shopping-check" onClick={()=>update(rows.map(r=>r.id===row.id?{...r,done:!r.done}:r))} aria-pressed={row.done} aria-label={`${row.done?'Volver a pendiente':'Marcar comprado'}: ${row.name}`}>{row.done?<Check/>:<span/>}</button><span><b>{[row.quantity,row.name].filter(Boolean).join(' ')}</b>{row.note&&<small>{row.note}</small>}</span><button className="shopping-remove" aria-label={`Quitar ${row.name}`} onClick={()=>update(rows.filter(r=>r.id!==row.id))}><Trash2/></button></div>)}</section>)}
  {rows.some(r=>r.done)&&<button className="secondary" onClick={()=>update(rows.filter(r=>!r.done))}>Quitar productos comprados</button>}
 </section>;
}
