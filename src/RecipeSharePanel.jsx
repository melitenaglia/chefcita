import React,{useEffect,useState} from 'react';
import {BookOpen,Check,Share2,Users,X} from 'lucide-react';
import {supabase} from './supabase.js';
import {loadSharedLibraries} from './sharedLibraries.js';
import {userErrorMessage} from './userError.js';

export default function RecipeSharePanel({recipeId,ownerId,session,onClose,onChanged}){
 const isOwner=ownerId===session.user.id;
 const [libraries,setLibraries]=useState([]);
 const [sharedIds,setSharedIds]=useState(new Set());
 const [loading,setLoading]=useState(true);
 const [busyId,setBusyId]=useState('');
 const [message,setMessage]=useState('');

 const load=async()=>{
  setLoading(true);setMessage('');
  const [{data:libraryRows,error:libraryError},{data:shareRows,error:shareError}]=await Promise.all([
   isOwner?loadSharedLibraries(session.user.id):Promise.resolve({data:[],error:null}),
   supabase.from('recipe_library_shares').select('household_id,households(name)').eq('recipe_id',recipeId)
  ]);
  if(libraryError||shareError){
   setMessage(userErrorMessage(libraryError||shareError,'No pude cargar las bibliotecas compartidas.'));
  }
  setLibraries(libraryRows||[]);
  setSharedIds(new Set((shareRows||[]).map(x=>x.household_id)));
  setLoading(false);
 };

 useEffect(()=>{load()},[recipeId]);

 const toggleShare=async library=>{
  if(!isOwner||busyId)return;
  const active=sharedIds.has(library.id);
  setBusyId(library.id);setMessage('');
  const result=active
   ?await supabase.from('recipe_library_shares').delete().eq('recipe_id',recipeId).eq('household_id',library.id)
   :await supabase.from('recipe_library_shares').insert({recipe_id:recipeId,household_id:library.id,shared_by:session.user.id});
  setBusyId('');
  if(result.error){
   setMessage(userErrorMessage(result.error,active?'No pude quitar esta biblioteca.':'No pude compartir la receta.'));
   return;
  }
  setSharedIds(current=>{
   const next=new Set(current);
   if(active)next.delete(library.id);else next.add(library.id);
   return next;
  });
  onChanged?.();
 };

 return <div className="share-panel-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
  <section className="share-panel" aria-label="Compartir receta">
   <div className="share-panel-head"><div><Share2/><span><b>Compartir receta</b><small>La receta sigue siendo tuya y solo se comparte en lectura.</small></span></div><button onClick={onClose} aria-label="Cerrar"><X/></button></div>

   {loading?<p className="muted">Cargando bibliotecas…</p>:isOwner?<>
    {libraries.length===0?<div className="share-empty"><BookOpen/><p>No tenés bibliotecas compartidas todavía.</p><small>Creá una desde Configuración → Bibliotecas.</small></div>:
     <div className="share-library-list">{libraries.map(library=>{
      const active=sharedIds.has(library.id);
      return <button key={library.id} className={active?'active':''} disabled={Boolean(busyId)} onClick={()=>toggleShare(library)}>
       <span className="share-library-icon"><Users/></span>
       <span><b>{library.name}</b><small>{active?'Compartida · solo lectura':'No compartida'}</small></span>
       <span className="share-check">{active&&<Check/>}</span>
      </button>
     })}</div>}
    <p className="share-note">Quien reciba la receta puede verla, guardarla como favorita y añadir sus notas personales, pero no puede modificar la receta.</p>
   </>:<div className="share-empty"><Users/><p>Esta receta fue compartida con vos.</p><small>Es solo lectura. Los cambios los hace únicamente quien creó la receta desde su biblioteca personal.</small></div>}

   {message&&<p className="settings-message">{message}</p>}
  </section>
 </div>;
}
