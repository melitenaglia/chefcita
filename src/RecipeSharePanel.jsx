import React,{useEffect,useState} from 'react';
import {BookOpen,Check,Plus,Users,X} from 'lucide-react';
import {setLibraryRecipe,canOrganizeRecipe} from './libraryActions.js';
import {supabase} from './supabase.js';
import {loadSharedLibraries} from './sharedLibraries.js';
import {userErrorMessage} from './userError.js';

export default function RecipeSharePanel({recipeId,ownerId,session,onClose,onChanged,onManageLibraries}){
 const [libraries,setLibraries]=useState([]);
 const [sharedIds,setSharedIds]=useState(new Set());
 const [loading,setLoading]=useState(true);
 const [busyId,setBusyId]=useState('');
 const [message,setMessage]=useState('');
 const [newName,setNewName]=useState('');
 const load=async()=>{
  setLoading(true);setMessage('');
  const [libraryRows,shares]=await Promise.all([loadSharedLibraries(session.user.id),supabase.from('recipe_library_shares').select('household_id').eq('recipe_id',recipeId)]);
  if(libraryRows.error||shares.error)setMessage(userErrorMessage(libraryRows.error||shares.error,'No pude cargar las bibliotecas.'));
  setLibraries(libraryRows.data||[]);setSharedIds(new Set((shares.data||[]).map(x=>x.household_id)));setLoading(false);
 };
 useEffect(()=>{load()},[recipeId,session.user.id]);
 const toggle=async library=>{
  if(busyId)return;
  const active=sharedIds.has(library.id);
  setBusyId(library.id);setMessage('');
  const result=await setLibraryRecipe({recipeId,libraryId:library.id,added:!active,ownerId,userId:session.user.id});
  setBusyId('');
  if(result.error){setMessage(userErrorMessage(result.error,'No pude cambiar esta biblioteca. Reintentá.'));return}
  setSharedIds(current=>{const next=new Set(current);if(active)next.delete(library.id);else next.add(library.id);return next});
  setMessage(active?`Quitada de «${library.name}». La receta original sigue guardada.`:`Añadida a «${library.name}».`);onChanged?.();
 };
 const create=async()=>{
  if(!newName.trim()||busyId)return;
  setBusyId('new');setMessage('');
  const result=await supabase.rpc('create_shared_library',{p_name:newName.trim()});
  if(result.error){setBusyId('');setMessage(userErrorMessage(result.error,'No pude crear la biblioteca.'));return}
  const id=result.data;
  setLibraries(current=>[...current,{id,name:newName.trim(),role:'owner'}]);setNewName('');
  const added=await setLibraryRecipe({recipeId,libraryId:id,added:true,ownerId,userId:session.user.id});
  setBusyId('');
  if(added.error){setMessage('Biblioteca creada. Tocala para volver a intentar añadir esta receta.');return}
  setSharedIds(current=>new Set([...current,id]));setMessage('Biblioteca creada y receta añadida.');onChanged?.();
 };
 return <div className="share-panel-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busyId)onClose?.()}}><section className="share-panel" role="dialog" aria-modal="true" aria-label="Añadir a biblioteca">
  <div className="share-panel-head"><div><BookOpen/><span><b>Añadir a biblioteca</b><small>Una receta, tantas bibliotecas como quieras.</small></span></div><button onClick={onClose} disabled={Boolean(busyId)} aria-label="Cerrar"><X/></button></div>
  {loading?<p role="status">Cargando bibliotecas…</p>:<div className="share-library-list">{libraries.map(l=>{const active=sharedIds.has(l.id);return <button key={l.id} className={active?'active':''} aria-pressed={active} disabled={Boolean(busyId)} onClick={()=>toggle(l)}><span className="share-library-icon"><Users/></span><span><b>{l.name}</b><small>{busyId===l.id?'Guardando…':active?'Añadida · tocá para quitar':'Tocá para añadir'}</small></span><span className="share-check">{active?<Check/>:<Plus/>}</span></button>})}</div>}
  <div className="playlist-create-inline"><label>Nueva biblioteca<input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ej. Cenas rápidas"/></label><button className="secondary" disabled={Boolean(busyId)||!newName.trim()} onClick={create}><Plus/>Crear y añadir</button></div>
  <p className="share-note">Quitarla de una biblioteca no elimina la receta. La autoría se conserva; solo su creadora puede editarla. Quienes integren la biblioteca podrán verla.</p>
  {message&&<p className="settings-message" role="status">{message}</p>}
  {onManageLibraries&&<button className="secondary" disabled={Boolean(busyId)} onClick={()=>{onClose?.();onManageLibraries()}}>Gestionar mis bibliotecas</button>}
  <button className="secondary" disabled={Boolean(busyId)} onClick={onClose}>Listo</button>
 </section></div>;
}
