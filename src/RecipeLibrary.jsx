import React,{useEffect,useMemo,useState} from 'react';
import {BookOpen,Heart,Search,Clock,ChefHat,CheckCircle2,Circle,SlidersHorizontal,Star,ChevronDown} from 'lucide-react';
import {supabase} from './supabase.js';
import RecipeDetail from './RecipeDetail.jsx';
import {userErrorMessage} from './userError.js';

const levelLabel={initial:'Inicial',intermediate:'Intermedio',expert:'Experto'};

export default function RecipeLibrary({session,mode='all',initialRecipeId=null}){
 const [recipes,setRecipes]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [selectedId,setSelectedId]=useState(initialRecipeId);
 const [selectedLibraryContext,setSelectedLibraryContext]=useState(null);
 const [categoryFilter,setCategoryFilter]=useState('');
 const [mealFilter,setMealFilter]=useState('');
 const [levelFilter,setLevelFilter]=useState('');
 const [personalFilter,setPersonalFilter]=useState('');
 const [libraryFilter,setLibraryFilter]=useState('');
 const [sort,setSort]=useState('newest');
 const [kitchenView,setKitchenView]=useState('favorites');
 const [filtersOpen,setFiltersOpen]=useState(false);

 const openDetail=(id,libraryContext=null)=>{
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
 const libraries=useMemo(()=>{
  const map=new Map();
  for(const recipe of recipes){
   for(const share of recipe.recipe_library_shares||[]){
    if(share.household_id&&share.households?.name)map.set(share.household_id,share.households.name);
   }
  }
  return [...map.entries()].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 },[recipes]);

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
   if(libraryFilter==='personal'&&recipe.owner_id!==session.user.id)return false;
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
 },[recipes,search,mode,kitchenView,categoryFilter,mealFilter,levelFilter,libraryFilter,personalFilter,sort,session.user.id]);

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
  if(error){setError(userErrorMessage(error,'No pude guardar este cambio. Probá de nuevo.'));return}
  setRecipes(list=>list.map(item=>item.id===recipe.id?{...item,user_recipes:[{...current,...next}]}:item));
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
  setCategoryFilter('');setMealFilter('');setLevelFilter('');setLibraryFilter('');setPersonalFilter('');setSort('newest');
 };

 const filtersActive=Boolean(categoryFilter||mealFilter||levelFilter||libraryFilter||personalFilter||sort!=='newest');
 const filterCount=[categoryFilter,mealFilter,levelFilter,libraryFilter,personalFilter,sort!=='newest'?'sort':''].filter(Boolean).length;

 return <section className="recipe-library">
  {mode==='kitchen'&&<div className="kitchen-tabs">
   <button className={kitchenView==='favorites'?'active':''} onClick={()=>setKitchenView('favorites')}><Heart/>Favoritas <span>{kitchenCounts.favorites}</span></button>
   <button className={kitchenView==='to_try'?'active':''} onClick={()=>setKitchenView('to_try')}><Circle/>Por probar <span>{kitchenCounts.toTry}</span></button>
   <button className={kitchenView==='tried'?'active':''} onClick={()=>setKitchenView('tried')}><CheckCircle2/>Probadas <span>{kitchenCounts.tried}</span></button>
  </div>}

  <div className="library-toolbar">
   <div className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por receta, ingrediente, categoría o etiqueta..."/></div>
   <span>{visible.length} {visible.length===1?'receta':'recetas'}</span>
  </div>

  <button type="button" className="mobile-filter-toggle" onClick={()=>setFiltersOpen(v=>!v)} aria-expanded={filtersOpen}><span><SlidersHorizontal/>Filtros</span>{filterCount>0&&<em>{filterCount}</em>}<ChevronDown/></button>
  <div className={filtersOpen?'library-filters mobile-open':'library-filters'}>
   <span className="filters-label"><SlidersHorizontal/>Filtros</span>
   <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">Todas las categorías</option>{categories.map(x=><option key={x}>{x}</option>)}</select>
   <select value={mealFilter} onChange={e=>setMealFilter(e.target.value)}><option value="">Todos los tipos</option>{mealTypes.map(x=><option key={x}>{x}</option>)}</select>
   <select value={levelFilter} onChange={e=>setLevelFilter(e.target.value)}><option value="">Cualquier nivel</option><option value="initial">Inicial</option><option value="intermediate">Intermedio</option><option value="expert">Experto</option></select>
   <select value={libraryFilter} onChange={e=>setLibraryFilter(e.target.value)}><option value="">Todas las bibliotecas</option><option value="personal">Personal</option>{libraries.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
   {mode==='all'&&<select value={personalFilter} onChange={e=>setPersonalFilter(e.target.value)}><option value="">Cualquier estado</option><option value="favorite">Favoritas</option><option value="to_try">Por probar</option><option value="tried">Probadas</option></select>}
   <select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Más recientes</option><option value="title">A–Z</option><option value="time">Menor tiempo</option></select>
   {filtersActive&&<button onClick={clearFilters}>Limpiar</button>}
  </div>

  {loading&&<div className="library-state"><ChefHat/><p>Cargando recetas...</p></div>}
  {!loading&&error&&<div className="library-state error"><p>No pudimos cargar las recetas.</p><small>{error}</small><button onClick={load}>Reintentar</button></div>}
  {!loading&&!error&&visible.length===0&&<div className="library-state"><BookOpen/><h2>{mode==='kitchen'?'No hay recetas en esta vista':'No encontramos recetas'}</h2><p>{search||filtersActive?'Probá quitando algún filtro o cambiando la búsqueda.':'Añadí tu primera receta para empezar a construir Chefcita.'}</p></div>}

  {!loading&&!error&&visible.length>0&&<div className="recipe-grid">
   {visible.map(recipe=>{
    const personal=recipe.user_recipes?.[0];
    const mainIngredients=(recipe.recipe_ingredients||[]).filter(x=>x.role!=='secondary').slice(0,4);
    const tagNames=(recipe.recipe_tags||[]).map(x=>x.tags?.name).filter(Boolean).slice(0,4);
    const tried=personal?.tried_status==='tried';
    return <article className="recipe-card clickable" key={recipe.id} onClick={()=>openDetail(recipe.id,libraryFilter&&libraryFilter!=='personal'?libraryFilter:null)}>
     <div className="recipe-card-top">
      {recipe.image_url?<img src={recipe.image_url} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<div className="recipe-placeholder"><ChefHat/></div>}
      <button className={personal?.is_favorite?'favorite active':'favorite'} onClick={e=>toggleFavorite(recipe,e)} aria-label="Favorita"><Heart/></button>
     </div>
     <div className="recipe-card-body">
      <div className="recipe-meta">{(recipe.recipe_library_shares||[]).slice(0,2).map(share=>share.households?.name&&<span className="shared-library-chip" key={share.household_id}>{share.households.name}</span>)}{recipe.categories?.name&&<span>{recipe.categories.name}</span>}{recipe.meal_types?.name&&<span>{recipe.meal_types.name}</span>}</div>
      <h3>{recipe.title}</h3>
      {recipe.description&&<p>{recipe.description}</p>}
      {mainIngredients.length>0&&<div className="card-ingredients">{mainIngredients.map((x,i)=><span key={i}>{x.original_name}</span>)}</div>}
      {tagNames.length>0&&<div className="card-tags">{tagNames.map(tag=><span key={tag}>{tag}</span>)}</div>}
      <div className="recipe-facts">
       {recipe.total_minutes!=null&&<span><Clock/>{recipe.total_minutes} min</span>}
       {recipe.level&&<span>{levelLabel[recipe.level]}</span>}
       {tried&&personal?.rating&&<span className="card-rating"><Star/>{personal.rating}/5</span>}
      </div>
      <button className={tried?'tried-toggle active':'tried-toggle'} onClick={e=>toggleTried(recipe,e)}>{tried?<CheckCircle2/>:<Circle/>}{tried?'Probada':'Por probar'}</button>
     </div>
    </article>;
   })}
  </div>}

  {selectedId&&<RecipeDetail recipeId={selectedId} session={session} viewingLibraryId={selectedLibraryContext} onClose={closeDetail} onDeleted={()=>load()} onChanged={()=>load()}/>} 
 </section>;
}
