import React,{useEffect,useMemo,useState} from 'react';
import {BookOpen,Heart,Search,Clock,ChefHat,CheckCircle2,Circle,SlidersHorizontal,Star,ChevronDown,MoreHorizontal,X,Edit3,Plus} from 'lucide-react';
import {setLibraryRecipe,canOrganizeRecipe} from './libraryActions.js';
import {supabase} from './supabase.js';
import {loadSharedLibraries} from './sharedLibraries.js';
import RecipeSharePanel from './RecipeSharePanel.jsx';
import RecipeDetail from './RecipeDetail.jsx';
import {userErrorMessage} from './userError.js';

const levelLabel={initial:'Inicial',intermediate:'Intermedio',expert:'Experto'};

export default function RecipeLibrary({session,mode='all',initialRecipeId=null,initialPersonalFilter='',onManageLibraries,initialLibraryId='',libraryName='',onChooseRecipes,onMembershipChanged}){
 const [recipes,setRecipes]=useState([]);
 const [libraries,setLibraries]=useState([]);
 const [scope,setScope]=useState(initialLibraryId?'shared':'personal');
 const [libraryError,setLibraryError]=useState('');
 const [sharingRecipe,setSharingRecipe]=useState(null);
 const [actionRecipe,setActionRecipe]=useState(null);
 const [actionBusy,setActionBusy]=useState(false);
 const [actionError,setActionError]=useState('');
 const [startEditing,setStartEditing]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [selectedId,setSelectedId]=useState(initialRecipeId);
 const [selectedLibraryContext,setSelectedLibraryContext]=useState(null);
 const [categoryFilter,setCategoryFilter]=useState('');
 const [mealFilter,setMealFilter]=useState('');
 const [levelFilter,setLevelFilter]=useState('');
 const [personalFilter,setPersonalFilter]=useState(initialPersonalFilter);
 const [libraryFilter,setLibraryFilter]=useState(initialLibraryId);
 const [sort,setSort]=useState('newest');
 const [kitchenView,setKitchenView]=useState('favorites');
 const [filtersOpen,setFiltersOpen]=useState(false);

 const openDetail=(id,libraryContext=null,edit=false)=>{
  setStartEditing(edit);
  if(!id)return;
  setSelectedLibraryContext(libraryContext);
  setSelectedId(id);
  const state=window.history.state||{};
  if(state.chefcitaRecipeId!==id){
   window.history.pushState({...state,chefcitaRecipeId:id},'',window.location.href);
  }
 };

 const closeDetail=()=>{
  if(window.history.state?.chefcitaRecipeId===selectedId)window.history.back();
  else setSelectedId(null);
  setSelectedLibraryContext(null);
 };

 const load=async()=>{
  setLoading(true);
  setError('');
  const {data,error}=await supabase
   .from('recipes')
   .select('id,owner_id,title,description,image_url,level,total_minutes,reviewed_at,created_at,categories(name),meal_types(name),recipe_library_shares(household_id,households(name)),recipe_ingredients(original_name,role),recipe_tags(tags(name)),user_recipes!left(is_favorite,tried_status,rating,tried_at)')
   .eq('review_status','recipe')
   .order('created_at',{ascending:false});
  if(error){setError(userErrorMessage(error,'No pude cargar tus recetas. Probá de nuevo.'));setRecipes([])}
  else setRecipes(data||[]);
  setLoading(false);
 };

 useEffect(()=>{load()},[]);
 useEffect(()=>{
  const handlePopState=()=>{const id=window.history.state?.chefcitaRecipeId||null;setSelectedId(id);if(!id)setSelectedLibraryContext(null)};
  window.addEventListener('popstate',handlePopState);
  return()=>window.removeEventListener('popstate',handlePopState);
 },[]);
 useEffect(()=>{if(initialRecipeId)openDetail(initialRecipeId)},[initialRecipeId]);

 const categories=useMemo(()=>[...new Set(recipes.map(x=>x.categories?.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),[recipes]);
 const mealTypes=useMemo(()=>[...new Set(recipes.map(x=>x.meal_types?.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),[recipes]);
 const loadLibraries=async()=>{
  const result=await loadSharedLibraries(session.user.id);
  setLibraries(result.data||[]);
  setLibraryError(result.error?'No pude cargar las bibliotecas. Reintentá para verlas.':'');
 };
 useEffect(()=>{loadLibraries()},[session.user.id]);

 const kitchenCounts=useMemo(()=>{
  let favorites=0,toTry=0,tried=0;
  for(const recipe of recipes){
   const p=recipe.user_recipes?.[0];
   if(p?.is_favorite)favorites++;
   if(p?.tried_status==='tried')tried++;
   else toTry++;
  }
  return {favorites,toTry,tried};
 },[recipes]);

 const visible=useMemo(()=>{
  const q=search.trim().toLowerCase();
  const rows=recipes.filter(recipe=>{
   const personal=recipe.user_recipes?.[0]||{};

   if(mode==='favorites'&&!personal.is_favorite)return false;
   if(mode==='kitchen'){
    if(kitchenView==='favorites'&&!personal.is_favorite)return false;
    if(kitchenView==='to_try'&&(personal.tried_status||'to_try')!=='to_try')return false;
    if(kitchenView==='tried'&&personal.tried_status!=='tried')return false;
   }

   if(categoryFilter&&recipe.categories?.name!==categoryFilter)return false;
   if(mealFilter&&recipe.meal_types?.name!==mealFilter)return false;
   if(levelFilter&&recipe.level!==levelFilter)return false;
   if(scope==='personal'&&recipe.owner_id!==session.user.id)return false;
   if(scope==='shared'&&!(recipe.recipe_library_shares||[]).some(x=>libraries.some(l=>l.id===x.household_id)))return false;
   if(libraryFilter&&libraryFilter!=='personal'&&!(recipe.recipe_library_shares||[]).some(x=>x.household_id===libraryFilter))return false;

   if(personalFilter==='favorite'&&!personal.is_favorite)return false;
   if(personalFilter==='to_try'&&(personal.tried_status||'to_try')!=='to_try')return false;
   if(personalFilter==='tried'&&personal.tried_status!=='tried')return false;

   if(!q)return true;
   const ingredients=(recipe.recipe_ingredients||[]).map(x=>x.original_name);
   const tagNames=(recipe.recipe_tags||[]).map(x=>x.tags?.name);
   return [
    recipe.title,recipe.description,recipe.categories?.name,recipe.meal_types?.name,
    ...ingredients,...tagNames
   ].filter(Boolean).some(value=>String(value).toLowerCase().includes(q));
  });

  return [...rows].sort((a,b)=>{
   if(sort==='title')return a.title.localeCompare(b.title,'es');
   if(sort==='time'){
    const av=a.total_minutes==null?Number.MAX_SAFE_INTEGER:a.total_minutes;
    const bv=b.total_minutes==null?Number.MAX_SAFE_INTEGER:b.total_minutes;
    return av-bv;
   }
   return new Date(b.created_at)-new Date(a.created_at);
  });
 },[recipes,search,mode,kitchenView,categoryFilter,mealFilter,levelFilter,libraryFilter,personalFilter,sort,session.user.id,scope,libraries]);

 const updatePersonal=async(recipe,changes)=>{
  const current=recipe.user_recipes?.[0]||{};
  const triedStatus=changes.tried_status??current.tried_status??'to_try';
  const next={
   user_id:session.user.id,
   recipe_id:recipe.id,
   is_favorite:changes.is_favorite??current.is_favorite??false,
   tried_status:triedStatus,
   rating:triedStatus==='tried'?(current.rating??null):null,
   tried_at:triedStatus==='tried'?(current.tried_at||new Date().toISOString().slice(0,10)):null
  };
  const {error}=await supabase.from('user_recipes').upsert(next,{onConflict:'user_id,recipe_id'});
  if(error){setActionError(userErrorMessage(error,'No pude guardar este cambio. Probá de nuevo.'));return false}
  setRecipes(list=>list.map(item=>item.id===recipe.id?{...item,user_recipes:[{...current,...next}]}:item));
  return true;
 };

 const toggleFavorite=(recipe,event)=>{
  event.stopPropagation();
  const current=recipe.user_recipes?.[0];
  updatePersonal(recipe,{is_favorite:!current?.is_favorite});
 };

 const toggleTried=(recipe,event)=>{
  event.stopPropagation();
  const current=recipe.user_recipes?.[0];
  updatePersonal(recipe,{tried_status:current?.tried_status==='tried'?'to_try':'tried'});
 };

 const clearFilters=()=>{
  setCategoryFilter('');setMealFilter('');setLevelFilter('');setLibraryFilter(initialLibraryId);setPersonalFilter('');setSort('newest');
 };

 const filtersActive=Boolean(categoryFilter||mealFilter||levelFilter||(!initialLibraryId&&libraryFilter)||personalFilter||sort!=='newest');
 const filterCount=[categoryFilter,mealFilter,levelFilter,initialLibraryId?'':libraryFilter,personalFilter,sort!=='newest'?'sort':''].filter(Boolean).length;

 return <section className="recipe-library">
   {!initialLibraryId&&<div className="library-scope-tabs" role="group" aria-label="Elegir recetario">
    {[['personal','Propias'],['shared','Compartidas']].map(([value,label])=><button key={value} type="button" aria-pressed={scope===value} className={scope===value?'selected':''} onClick={()=>{setScope(value);setLibraryFilter('')}}>{label}</button>)}
   </div>}
   {scope==='shared'&&<div className="library-shortcut">
    {initialLibraryId?<button onClick={onChooseRecipes}><Plus/>Añadir recetas guardadas</button>:<button onClick={onManageLibraries}><BookOpen/>Mis bibliotecas</button>}
    {libraryError&&<span role="alert">{libraryError} <button onClick={loadLibraries}>Reintentar</button></span>}
   </div>}
  {mode==='kitchen'&&<div className="kitchen-tabs">
   <button className={kitchenView==='favorites'?'active':''} onClick={()=>setKitchenView('favorites')}><Heart/>Favoritas <span>{kitchenCounts.favorites}</span></button>
   <button className={kitchenView==='to_try'?'active':''} onClick={()=>setKitchenView('to_try')}><Circle/>Por probar <span>{kitchenCounts.toTry}</span></button>
   <button className={kitchenView==='tried'?'active':''} onClick={()=>setKitchenView('tried')}><CheckCircle2/>Probadas <span>{kitchenCounts.tried}</span></button>
  </div>}

  <div className="library-toolbar">
   <div className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Buscar receta o ingrediente" placeholder="Buscar receta o ingrediente…"/></div>
   <button type="button" className="mobile-filter-toggle" aria-label="Filtros" onClick={()=>setFiltersOpen(v=>!v)} aria-expanded={filtersOpen}><SlidersHorizontal/><span className="filter-button-label">Filtros</span>{filterCount>0&&<em>{filterCount}</em>}</button>
  </div>
  <div className={filtersOpen?'library-filters mobile-open':'library-filters'}>
   <div className="recipe-quick-tabs" role="group" aria-label="Filtrar recetas por estado">
    {[['','Todas'],['favorite','Favoritas'],['to_try','Por probar'],['tried','Probadas']].map(([value,label])=><button type="button" key={label} className={personalFilter===value?'selected':''} aria-pressed={personalFilter===value} onClick={()=>setPersonalFilter(value)}>{label}</button>)}
   </div>
   <select aria-label="Categoría" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">Todas las categorías</option>{categories.map(x=><option key={x}>{x}</option>)}</select>
   <select aria-label="Tipo de comida" value={mealFilter} onChange={e=>setMealFilter(e.target.value)}><option value="">Todos los tipos</option>{mealTypes.map(x=><option key={x}>{x}</option>)}</select>
   <select aria-label="Nivel" value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}><option value="">Cualquier nivel</option><option value="initial">Inicial</option><option value="intermediate">Intermedio</option><option value="expert">Experto</option></select>

   <select aria-label="Ordenar recetas" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Más recientes</option><option value="title">A–Z</option><option value="time">Menor tiempo</option></select>
   {filtersActive&&<button onClick={clearFilters}>Limpiar</button>}
  </div>

  {loading&&<div className="library-state"><ChefHat/><p>Cargando recetas...</p></div>}
  {!loading&&error&&<div className="library-state error"><p>No pudimos cargar las recetas.</p><small>{error}</small><button onClick={load}>Reintentar</button></div>}
  {!loading&&!error&&visible.length===0&&<div className="library-state"><BookOpen/><h2>{mode==='kitchen'?'No hay recetas en esta vista':'No encontramos recetas'}</h2><p>{search||filtersActive?'Probá quitando algún filtro o cambiando la búsqueda.':'Añadí tu primera receta para empezar a construir Chefcita.'}</p></div>}

  {!loading&&!error&&visible.length>0&&<div className="recipe-list-summary"><small>{visible.length} {visible.length===1?'receta':'recetas'}</small>{filtersActive&&<button onClick={clearFilters}>Limpiar filtros</button>}</div>}
  {!loading&&!error&&visible.length>0&&<div className="simple-recipe-list">
   {visible.map(recipe=>{
    const personal=recipe.user_recipes?.[0]||{};
    return <article className="simple-recipe-row" key={recipe.id}>
     <button className="simple-recipe-open" onClick={()=>openDetail(recipe.id,initialLibraryId||null)} aria-label={`Abrir ${recipe.title}`}>
      <span className="simple-recipe-thumb">{recipe.image_url?<img src={recipe.image_url} alt="" onError={()=>setRecipes(list=>list.map(item=>item.id===recipe.id?{...item,image_url:null}:item))}/>:<ChefHat/>}</span>
      <span className="simple-recipe-copy"><b>{recipe.title}{personal.is_favorite&&<Heart className="simple-favorite-indicator" aria-label="Favorita"/>}</b>
       {(recipe.categories?.name||recipe.meal_types?.name)&&<small>{[recipe.categories?.name,recipe.meal_types?.name].filter(Boolean).join(' · ')}</small>}
       {recipe.total_minutes!=null&&<small className="simple-recipe-time"><Clock/>{recipe.total_minutes} min</small>}
      </span>
     </button>
     <button className="recipe-more" onClick={()=>{setActionRecipe(recipe);setActionError('')}} aria-label={`Opciones de ${recipe.title}`}><MoreHorizontal/></button>
    </article>;
   })}
  </div>}
  {actionRecipe&&<div className="share-panel-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!actionBusy)setActionRecipe(null)}}>
   <section className="share-panel recipe-actions-sheet" role="dialog" aria-modal="true" aria-label={`Opciones de ${actionRecipe.title}`}>
    <div className="share-panel-head"><b>{actionRecipe.title}</b><button onClick={()=>setActionRecipe(null)} disabled={actionBusy} aria-label="Cerrar"><X/></button></div>
    <div className="recipe-action-list">
     <button disabled={actionBusy} onClick={()=>{setActionRecipe(null);openDetail(actionRecipe.id,initialLibraryId||null)}}><BookOpen/>Ver receta</button>
     <button disabled={actionBusy} onClick={async()=>{setActionBusy(true);const ok=await updatePersonal(actionRecipe,{is_favorite:!actionRecipe.user_recipes?.[0]?.is_favorite});setActionBusy(false);if(ok)setActionRecipe(null)}}><Heart/>{actionRecipe.user_recipes?.[0]?.is_favorite?'Quitar de favoritas':'Marcar favorita'}</button>
     <button disabled={actionBusy} onClick={async()=>{setActionBusy(true);const ok=await updatePersonal(actionRecipe,{tried_status:actionRecipe.user_recipes?.[0]?.tried_status==='tried'?'to_try':'tried'});setActionBusy(false);if(ok)setActionRecipe(null)}}><CheckCircle2/>{actionRecipe.user_recipes?.[0]?.tried_status==='tried'?'Marcar por probar':'Marcar como probada'}</button>
     {canOrganizeRecipe(actionRecipe.owner_id,session.user.id)&&<button disabled={actionBusy} onClick={()=>{setActionRecipe(null);setSharingRecipe(actionRecipe)}}><Plus/>Añadir a biblioteca</button>}
     {actionRecipe.owner_id===session.user.id&&<button disabled={actionBusy} onClick={()=>{setActionRecipe(null);openDetail(actionRecipe.id,initialLibraryId||null,true)}}><Edit3/>Editar receta</button>}
     {initialLibraryId&&canOrganizeRecipe(actionRecipe.owner_id,session.user.id)&&<button disabled={actionBusy} onClick={async()=>{setActionBusy(true);const result=await setLibraryRecipe({recipeId:actionRecipe.id,libraryId:initialLibraryId,added:false,ownerId:actionRecipe.owner_id,userId:session.user.id});setActionBusy(false);if(result.error)setActionError(userErrorMessage(result.error,'No pude quitar la receta de la biblioteca.'));else{setActionRecipe(null);load();onMembershipChanged?.()}}}><X/>Quitar de esta biblioteca</button>}
    </div>
    {actionBusy&&<p role="status">Guardando…</p>}{actionError&&<p role="alert">{actionError}</p>}
   </section>
  </div>}

  {sharingRecipe&&<RecipeSharePanel onManageLibraries={onManageLibraries} recipeId={sharingRecipe.id} ownerId={sharingRecipe.owner_id} session={session} onClose={()=>setSharingRecipe(null)} onChanged={()=>{load();onMembershipChanged?.()}}/>}
  {selectedId&&<RecipeDetail key={selectedId} initialEditing={startEditing} recipeId={selectedId} session={session} viewingLibraryId={selectedLibraryContext} onClose={closeDetail} onDeleted={()=>load()} onChanged={()=>load()}/>}
 </section>;
}
