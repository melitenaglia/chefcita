import React,{useEffect,useRef,useState} from 'react';
import {Check,Plus,Trash2,Store,Users,X,ChevronDown,BookOpen,RefreshCw} from 'lucide-react';
import {supabase} from './supabase.js';
import {loadShopping,saveShopping} from './cookingTools.js';
import {loadSharedLibraries} from './sharedLibraries.js';
import SharedLibrariesSettings from './SharedLibrariesSettings.jsx';
import {productKey,getDestination,setDestination,localStores,localPreferences,saveLocalStore,rememberLocalStore,addToHouse,mapShared} from './shoppingDestinations.js';
const suggestions=['Carrefour','Aldi','Deli','Mercado','Verdulería'];
export default function ShoppingList({session,onOpenRecipe}){
 const user=session.user.id;
 const [house,setHouse]=useState(()=>getDestination(user));const [houses,setHouses]=useState([]);const [members,setMembers]=useState([]);
 const [rows,setRows]=useState(()=>loadShopping(user));const [stores,setStores]=useState(()=>localStores(user));
 const [text,setText]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[online,setOnline]=useState(navigator.onLine);
 const [sharing,setSharing]=useState(false),[managing,setManaging]=useState(false),[moving,setMoving]=useState(null),[storeName,setStoreName]=useState(''),[remember,setRemember]=useState(true),[view,setView]=useState('stores');
 const active=useRef(house);active.current=house;const busyRef=useRef(busy);busyRef.current=busy;
 const cacheKey=`chefcita:shopping:cache:${user}:${house}`;
 const switchHouse=id=>{setDestination(user,id);setHouse(id);setError('')};
 useEffect(()=>{let alive=true;loadSharedLibraries(user).then(async result=>{if(!alive)return;if(result.error){if(navigator.onLine)setError('No pude cargar los grupos de casa. Reintentá.');return}setHouses(result.data);const ids=result.data.map(x=>x.id);if(!ids.length)return;const {data}=await supabase.from('household_members').select('household_id,user_id,profiles(display_name)').in('household_id',ids);if(alive)setMembers(data||[])});return()=>{alive=false}},[user,managing]);
 const refresh=async(silent=false)=>{
  if(!house){setRows(loadShopping(user));setStores(localStores(user));return}
  if(!navigator.onLine){try{setRows(JSON.parse(localStorage.getItem(cacheKey)||'[]'))}catch{setRows([])}return}
  if(!silent)setLoading(true);const selected=house;
  const [items,places]=await Promise.all([supabase.from('household_shopping_items').select('*').eq('household_id',house).order('created_at'),supabase.from('household_shopping_stores').select('id,name').eq('household_id',house).order('name')]);
  if(active.current!==selected)return;setLoading(false);
  if(items.error||places.error){setError('No pude sincronizar la lista de casa. Reintentá.');return}
  const next=(items.data||[]).map(mapShared);setRows(next);setStores(places.data||[]);setError('');try{localStorage.setItem(cacheKey,JSON.stringify(next))}catch{}
 };
 useEffect(()=>{
  setRows([]);setStores([]);refresh();
  const changed=()=>{setOnline(navigator.onLine);refresh(true)};
  const visible=()=>{if(document.visibilityState==='visible')changed()};
  const timer=setInterval(()=>{if(house&&document.visibilityState==='visible'&&navigator.onLine&&!busyRef.current)refresh(true)},5000);
  window.addEventListener('online',changed);window.addEventListener('offline',changed);window.addEventListener('chefcita-shopping',changed);window.addEventListener('storage',changed);document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);window.removeEventListener('online',changed);window.removeEventListener('offline',changed);window.removeEventListener('chefcita-shopping',changed);window.removeEventListener('storage',changed);document.removeEventListener('visibilitychange',visible)};
 },[house,user]);
 const run=async fn=>{if(busy)return;setBusy(true);setError('');try{await fn()}catch{setError('No pude guardar el cambio. Revisá la conexión y reintentá.')}finally{setBusy(false)}};
 const updateItem=async(row,patch)=>{
  if(house){const {data,error}=await supabase.from('household_shopping_items').update(patch.storeId!==undefined?{store_id:patch.storeId}:{done:patch.done}).eq('household_id',house).eq('id',row.id).select('id').maybeSingle();if(error||!data)throw error||new Error('not_saved');await refresh(true)}
  else saveShopping(user,loadShopping(user).map(x=>x.id===row.id?{...x,...patch}:x));
 };
 const remove=async row=>{if(house){const {error}=await supabase.from('household_shopping_items').delete().eq('household_id',house).eq('id',row.id);if(error)throw error;await refresh(true)}else saveShopping(user,loadShopping(user).filter(x=>x.id!==row.id))};
 const addManual=()=>run(async()=>{const name=text.trim();if(!name)return;const row={id:crypto.randomUUID(),name,quantity:'',done:false};if(house){await addToHouse(house,[row]);await refresh(true)}else saveShopping(user,[...loadShopping(user),{...row,storeId:localPreferences(user)[productKey(name)]||null}]);setText('')});
 const share=group=>run(async()=>{await addToHouse(group.id,loadShopping(user).filter(r=>!r.done));switchHouse(group.id);setSharing(false)});
 const ensureStore=async name=>{const existing=stores.find(s=>productKey(s.name)===productKey(name));if(existing)return existing;if(!house){const s=saveLocalStore(user,name);setStores(localStores(user));return s}const result=await supabase.from('household_shopping_stores').insert({household_id:house,name:name.trim()}).select('id,name').single();if(result.error){await refresh(true);throw result.error}setStores(old=>[...old,result.data]);return result.data};
 const move=store=>run(async()=>{
  const id=store?.id||null;
  if(remember){if(house){const prefs=await supabase.rpc('set_household_product_store',{p_household:house,p_product:productKey(moving.name),p_store:id});if(prefs.error)throw prefs.error}else rememberLocalStore(user,moving.name,id)}
  await updateItem(moving,{storeId:id});setMoving(null);
 });
 const pending=rows.filter(r=>!r.done).length;
 const groups=view==='stores'?[...(rows.some(r=>!r.storeId)?[{id:'',name:'Sin asignar'}]:[]),...stores.filter(s=>rows.some(r=>r.storeId===s.id))]:[...new Map(rows.map(r=>[r.recipeId||'',{id:r.recipeId||'',name:r.recipeTitle||'Otros productos'}])).values()];
 const name=houses.find(h=>h.id===house)?.name||'Casa';const disabled=busy||(!!house&&!online);
 return <section className="shopping-page">
  <div className="shopping-toolbar"><label>Lista<select aria-label="Lista de compra" value={house} onChange={e=>switchHouse(e.target.value)}><option value="">Mi lista</option>{houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label><button className="secondary" onClick={()=>house?setManaging(true):setSharing(true)}><Users/>{house?'Personas':'Compartir con casa'}</button></div>
  {house&&<p className="shopping-members"><Users/>{members.filter(m=>m.household_id===house).map(m=>m.profiles?.display_name||'Miembro').join(' · ')||name}<span>Compartida</span></p>}
  {!online&&<p className="tool-note" role="status">{house?'Sin conexión · última copia guardada. Reconectate para editar la lista de casa.':'Sin conexión · podés usar tu lista personal.'}</p>}
  <div className="shopping-status"><b>{pending} {pending===1?'producto pendiente':'productos pendientes'}</b>{house&&<button aria-label="Actualizar lista" onClick={()=>refresh()} disabled={!online||busy}><RefreshCw/></button>}</div>
  <form className="shopping-add" onSubmit={e=>{e.preventDefault();addManual()}}><label htmlFor="shopping-item">Añadir un producto</label><div><input id="shopping-item" value={text} maxLength={500} onChange={e=>setText(e.target.value)} placeholder="Ej. Jabón líquido"/><button className="secondary" disabled={disabled||!text.trim()}><Plus/>Añadir</button></div></form>
  <div className="shopping-view" aria-label="Organizar compra"><button aria-pressed={view==='stores'} onClick={()=>setView('stores')}><Store/>Por tienda</button><button aria-pressed={view==='recipes'} onClick={()=>setView('recipes')}><BookOpen/>Por receta</button></div>
  {error&&<p className="shopping-error" role="alert">{error}<button onClick={()=>refresh()}>Reintentar</button></p>}
  {loading&&<p role="status">Cargando lista de casa…</p>}
  {!rows.length&&!loading&&<div className="shopping-empty"><ShoppingEmpty/><h2>Tu lista está vacía</h2><p>Añadí ingredientes desde una receta o escribí un producto arriba.</p></div>}
  {groups.map(group=><section className="shopping-group" key={group.id}><h2>{view==='stores'&&<Store/>}{group.name}</h2>{rows.filter(r=>view==='stores'?(r.storeId||'')===group.id:(r.recipeId||'')===group.id).map(row=><div className={row.done?'shopping-item done':'shopping-item'} key={row.id}><button disabled={disabled} className="shopping-check" onClick={()=>run(()=>updateItem(row,{done:!row.done}))} aria-pressed={row.done} aria-label={`${row.done?'Volver a pendiente':'Marcar comprado'}: ${row.name}`}>{row.done?<Check/>:<span/>}</button><span><b>{[row.quantity,row.name].filter(Boolean).join(' ')}</b>{row.recipeTitle&&<small className="shopping-origin">{onOpenRecipe&&(!house||row.addedBy===user)?<button onClick={()=>onOpenRecipe(row.recipeId)}>{row.recipeTitle}</button>:row.recipeTitle}{row.portions?` · ${row.portions} porciones`:''}</small>}{row.note&&<small>{row.note}</small>}<button className="shopping-store-link" disabled={disabled} onClick={()=>{setMoving(row);setRemember(true);setStoreName('')}}><Store/>{stores.find(s=>s.id===row.storeId)?.name||'Elegir tienda'}<ChevronDown/></button></span><button disabled={disabled} className="shopping-remove" aria-label={`Quitar ${row.name}`} onClick={()=>run(()=>remove(row))}><Trash2/></button></div>)}</section>)}
  {rows.some(r=>r.done)&&<button className="secondary" disabled={disabled} onClick={()=>run(async()=>{if(house){const {error}=await supabase.from('household_shopping_items').delete().eq('household_id',house).eq('done',true);if(error)throw error;await refresh(true)}else saveShopping(user,loadShopping(user).filter(r=>!r.done))})}>Quitar productos comprados</button>}
  {sharing&&<div className="share-panel-backdrop"><section className="share-panel shopping-share" role="dialog" aria-modal="true" aria-label="Compartir compra"><div className="share-panel-head"><b>Compartir con casa</b><button aria-label="Cerrar" onClick={()=>setSharing(false)}><X/></button></div><p>Elegí el grupo que comparte la compra. Se copiarán {loadShopping(user).filter(r=>!r.done).length} productos pendientes con sus recetas.</p>{houses.map(h=><button className="secondary" disabled={busy} key={h.id} onClick={()=>share(h)}><Users/>Compartir con {h.name}</button>)}{!houses.length&&<p>Creá un grupo, por ejemplo «Casa», e invitá a quienes viven con vos.</p>}<button className="secondary" onClick={()=>{setSharing(false);setManaging(true)}}>Crear grupo o gestionar personas</button>{error&&<p role="alert">{error}</p>}</section></div>}
  {managing&&<div className="share-panel-backdrop"><section className="share-panel" role="dialog" aria-modal="true" aria-label="Personas de casa"><div className="share-panel-head"><b>Personas de casa</b><button aria-label="Cerrar" onClick={()=>setManaging(false)}><X/></button></div><p>Usá el mismo grupo de tu biblioteca de casa. Cada persona entra con su propia cuenta.</p><SharedLibrariesSettings purpose="shopping" session={session} initialExpanded={house}/></section></div>}
  {moving&&<div className="share-panel-backdrop"><section className="share-panel store-picker" role="dialog" aria-modal="true" aria-label="Elegir tienda"><div className="share-panel-head"><b>¿Dónde comprás {moving.name}?</b><button aria-label="Cerrar" onClick={()=>setMoving(null)}><X/></button></div><div className="store-options"><button disabled={busy} onClick={()=>move(null)}>Sin asignar</button>{stores.map(s=><button key={s.id} disabled={busy} onClick={()=>move(s)}><Store/>{s.name}</button>)}{suggestions.filter(n=>!stores.some(s=>productKey(s.name)===productKey(n))).map(n=><button key={n} disabled={busy} onClick={async()=>{try{await move(await ensureStore(n))}catch{setError('No pude crear la tienda. Reintentá.')}}}><Plus/>{n}</button>)}</div><label className="remember-store"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Recordar esta tienda para {moving.name}</label><form className="shopping-add" onSubmit={async e=>{e.preventDefault();if(!storeName.trim())return;try{await move(await ensureStore(storeName))}catch{setError('No pude crear la tienda. Reintentá.')}}}><label htmlFor="store-name">Otra tienda</label><div><input id="store-name" maxLength={100} placeholder="Nombre del establecimiento" value={storeName} onChange={e=>setStoreName(e.target.value)}/><button className="secondary" disabled={busy||!storeName.trim()}>Crear</button></div></form>{error&&<p role="alert">{error}</p>}</section></div>}
 </section>;
}
function ShoppingEmpty(){return <Store/>}
