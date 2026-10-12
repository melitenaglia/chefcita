import React,{useEffect,useState} from 'react';
import {BookOpen,Plus,ChevronLeft,Settings,Search,X,Check} from 'lucide-react';
import {setLibraryRecipe,canOrganizeRecipe} from './libraryActions.js';
import {supabase} from './supabase.js';
import {loadSharedLibraries} from './sharedLibraries.js';
import {userErrorMessage} from './userError.js';
import RecipeLibrary from './RecipeLibrary.jsx';
import SharedLibrariesSettings from './SharedLibrariesSettings.jsx';

export default function LibrariesPage({session,initialLibraryId=''}){
 const [libraries,setLibraries]=useState([]);
 const [selected,setSelected]=useState(initialLibraryId);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [managing,setManaging]=useState(false);
 const [choosing,setChoosing]=useState(false);
 const [candidates,setCandidates]=useState([]);
 const [query,setQuery]=useState('');
 const [busy,setBusy]=useState('');
 const [added,setAdded]=useState(new Set());
 const [refresh,setRefresh]=useState(0);
 const [pickerLoading,setPickerLoading]=useState(false);
 const [pickerError,setPickerError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  const result=await loadSharedLibraries(session.user.id);
  if(result.error){setError(userErrorMessage(result.error,'No pude cargar las bibliotecas.'));setLoading(false);return}
  const ids=result.data.map(x=>x.id);
  const shares=ids.length?await supabase.from('recipe_library_shares').select('household_id,recipe_id,recipes(title,image_url,review_status)').in('household_id',ids):{data:[],error:null};
  if(shares.error)setError(userErrorMessage(shares.error,'No pude cargar las recetas de las bibliotecas.'));
  setLibraries(result.data.map(l=>({...l,recipes:(shares.data||[]).filter(x=>x.household_id===l.id&&x.recipes?.review_status==='recipe')})));
  setLoading(false);
 };
 useEffect(()=>{load()},[session.user.id,refresh]);
 const library=libraries.find(x=>x.id===selected);
 const openPicker=async()=>{
  setChoosing(true);setPickerLoading(true);setPickerError('');setQuery('');
  const {data,error}=await supabase.from('recipes').select('id,title,image_url,owner_id,recipe_library_shares(household_id)').eq('review_status','recipe').order('created_at',{ascending:false});
  setPickerLoading(false);
  if(error){setPickerError(userErrorMessage(error,'No pude cargar las recetas guardadas.'));return}
  setCandidates((data||[]).filter(r=>canOrganizeRecipe(r.owner_id,session.user.id)));
  setAdded(new Set((data||[]).filter(r=>(r.recipe_library_shares||[]).some(s=>s.household_id===selected)).map(r=>r.id)));
 };
 const add=async recipe=>{
  if(busy||added.has(recipe.id))return;
  setBusy(recipe.id);setPickerError('');
  const result=await setLibraryRecipe({recipeId:recipe.id,libraryId:selected,added:true,ownerId:recipe.owner_id,userId:session.user.id});
  setBusy('');
  if(result.error){setPickerError(userErrorMessage(result.error,'No pude añadir esta receta. Reintentá.'));return}
  setAdded(current=>new Set([...current,recipe.id]));
  setRefresh(x=>x+1);
 };
 const closePicker=()=>{if(!busy){setChoosing(false);setRefresh(x=>x+1)}};
 return <section className="libraries-page">
  <div className="libraries-page-head">
   {selected?<button className="secondary" onClick={()=>setSelected('')}><ChevronLeft/>Bibliotecas</button>:<p>Organizá tus recetas como playlists. Una receta puede estar en varias bibliotecas.</p>}
   <button className="secondary" onClick={()=>setManaging(true)}><Settings/>{selected?'Gestionar':'Crear o gestionar'}</button>
  </div>
  {error&&<p role="alert">{error}<button onClick={load}>Reintentar</button></p>}
  {loading&&!libraries.length?<p role="status">Cargando bibliotecas…</p>:selected&&library?<>
   <div className="playlist-title"><BookOpen/><div><h2>{library.name}</h2><p>{library.recipes.length} recetas · {library.role==='owner'?'Tu biblioteca':'Biblioteca compartida'}</p></div></div>
   <RecipeLibrary key={`${selected}-${refresh}`} session={session} initialLibraryId={selected} libraryName={library.name} onChooseRecipes={openPicker} onManageLibraries={()=>setManaging(true)} onMembershipChanged={()=>setRefresh(x=>x+1)}/>
  </>:<>
   {!libraries.length&&<div className="library-state"><BookOpen/><h2>Tu primera biblioteca</h2><p>Por ejemplo: «Con Sofi», «Cenas rápidas» o «Postres». Podés usarla solo vos o invitar a alguien.</p><button className="secondary" onClick={()=>setManaging(true)}><Plus/>Crear biblioteca</button></div>}
   <div className="playlist-grid">{libraries.map(l=><button key={l.id} className="playlist-card" onClick={()=>setSelected(l.id)}><span className="playlist-cover">{l.recipes[0]?.recipes?.image_url?<img src={l.recipes[0].recipes.image_url} alt=""/>:<BookOpen/>}</span><span><b>{l.name}</b><small>{l.recipes.length} recetas · {l.role==='owner'?'La administrás vos':'Compartida con vos'}</small></span></button>)}</div>
  </>}
  {choosing&&<div className="share-panel-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closePicker()}}><section className="share-panel recipe-picker" role="dialog" aria-modal="true" aria-label="Añadir recetas guardadas">
   <div className="share-panel-head"><div><Plus/><span><b>Añadir a {library?.name}</b><small>Elegí recetas que ya están guardadas.</small></span></div><button onClick={closePicker} disabled={Boolean(busy)} aria-label="Cerrar"><X/></button></div>
   <label className="search-box"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar receta…"/></label>
   {pickerLoading?<p role="status">Cargando recetas…</p>:<div className="picker-recipes">{candidates.filter(r=>r.title.toLowerCase().includes(query.toLowerCase())).map(r=><button key={r.id} disabled={Boolean(busy)||added.has(r.id)} onClick={()=>add(r)} className={added.has(r.id)?'added':''}><span><b>{r.title}</b><small>{r.owner_id===session.user.id?'Propia':'Compartida con vos'}</small></span>{added.has(r.id)?<Check/>:<Plus/>}<small>{busy===r.id?'Añadiendo…':added.has(r.id)?'Añadida':'Añadir'}</small></button>)}{!candidates.length&&<p>No hay recetas revisadas todavía. Primero guardá y revisá una receta.</p>}</div>}
   {pickerError&&<p role="alert">{pickerError}</p>}
   <button className="secondary" disabled={Boolean(busy)} onClick={closePicker}>Listo</button>
  </section></div>}
  {managing&&<div className="share-panel-backdrop"><section className="share-panel library-manager" role="dialog" aria-modal="true" aria-label="Gestionar bibliotecas"><div className="share-panel-head"><b>Gestionar bibliotecas</b><button aria-label="Cerrar" onClick={()=>{setManaging(false);setRefresh(x=>x+1)}}><X/></button></div><SharedLibrariesSettings session={session} initialExpanded={selected} onOpenLibrary={id=>{setManaging(false);setSelected(id);setRefresh(x=>x+1)}}/></section></div>}
 </section>;
}
