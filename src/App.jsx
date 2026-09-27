import React, {useEffect,useLayoutEffect,useState} from 'react';
import {Heart,Inbox,BookOpen,Plus,ChefHat,Home,LogOut,UserRound,Settings,Menu,X,WandSparkles} from 'lucide-react';
import {supabase} from './supabase.js';
import Auth from './Auth.jsx';
import Account from './Account.jsx';
import SettingsPage from './SettingsPage.jsx';
import RecipeLibrary from './RecipeLibrary.jsx';
import AddRecipe from './AddRecipe.jsx';
import PendingHub from './PendingHub.jsx';
import HomeDashboard from './HomeDashboard.jsx';

export default function App(){
 const [session,setSession]=useState(null);
 const [loading,setLoading]=useState(true);
 const [tab,setTab]=useState('Inicio');
 const [settingsStart,setSettingsStart]=useState('Cuenta');
 const [adding,setAdding]=useState(false);
 const [recipeRefresh,setRecipeRefresh]=useState(0);
 const [pendingStart,setPendingStart]=useState('imports');
 const [openRecipeId,setOpenRecipeId]=useState(null);
 const [inviteNotice,setInviteNotice]=useState('');
 const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
 const [mobileNavSelection,setMobileNavSelection]=useState('Inicio');
 const [ideaFocusKey,setIdeaFocusKey]=useState(0);
 const [uiSize,setUiSize]=useState(()=>{
  try{
   const saved=localStorage.getItem('chefcita:ui-size');
   return ['compact','normal','large'].includes(saved)?saved:'normal';
  }catch{return 'normal'}
 });
 useLayoutEffect(()=>{
  document.documentElement.dataset.uiSize=uiSize;
  try{localStorage.setItem('chefcita:ui-size',uiSize)}catch{}
 },[uiSize]);
 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
  return()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
  if(!session)return;
  const token=new URLSearchParams(window.location.search).get('invite');
  if(!token)return;
  supabase.rpc('accept_household_invite',{p_token:token}).then(({error})=>{
   setSettingsStart('Mi hogar');
   setMobileNavSelection('Configuración');
   setTab('Configuración');
   if(error)setInviteNotice('No pude aceptar esta invitación. Comprobá que hayas iniciado sesión con el mismo email al que se envió y que el enlace no haya vencido.');
   else setInviteNotice('Listo. Ya te uniste al hogar.');
   window.history.replaceState({},'',window.location.pathname);
  });
 },[session]);
 if(loading)return <div className="splash"><ChefHat/><span>Chefcita</span></div>;
 if(!session)return <Auth/>;
 const nav=[['Inicio',Home],['Recetas',BookOpen],['Pendientes',Inbox],['Mi cocina',Heart]];
 const goToTab=target=>{
  if(target==='Pendientes')setPendingStart('imports');
  setMobileNavSelection(target);
  setMobileMenuOpen(false);
  setTab(target);
 };
 const goToIdeas=()=>{
  setMobileNavSelection('Ideas');
  setMobileMenuOpen(false);
  setIdeaFocusKey(x=>x+1);
  setTab('Inicio');
 };
 const openRecipe=id=>{
  if(!id)return;
  setAdding(false);
  setOpenRecipeId(id);
  setRecipeRefresh(x=>x+1);
  setMobileNavSelection('Recetas');
  setTab('Recetas');
 };
 return <div className="shell"><aside><div className="logo"><ChefHat/><b>Chefcita</b></div>
 <nav className="desktop-nav">{nav.map(([n,I])=><button key={n} className={tab===n?'active':''} onClick={()=>goToTab(n)}><I/><span>{n}</span></button>)}</nav>
 <nav className="mobile-bottom-nav" aria-label="Navegación principal">
  <button className={mobileNavSelection==='Inicio'?'active':''} onClick={()=>goToTab('Inicio')}><Home/><span>Inicio</span></button>
  <button className={mobileNavSelection==='Recetas'?'active':''} onClick={()=>goToTab('Recetas')}><BookOpen/><span>Recetas</span></button>
  <button className={mobileNavSelection==='Ideas'?'mobile-nav-ideas active':'mobile-nav-ideas'} onClick={goToIdeas}><WandSparkles/><span>Ideas</span></button>
  <button className={mobileNavSelection==='Pendientes'?'active':''} onClick={()=>goToTab('Pendientes')}><Inbox/><span>Pendientes</span></button>
  <button className={mobileNavSelection==='Mi cocina'?'active':''} onClick={()=>goToTab('Mi cocina')}><Heart/><span>Mi cocina</span></button>
 </nav>
 <div className="account-nav"><button onClick={()=>{setMobileNavSelection('Mi cuenta');setTab('Mi cuenta')}}><UserRound/>Mi cuenta</button><button onClick={()=>{setMobileNavSelection('Configuración');setTab('Configuración')}}><Settings/>Config.</button><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut/>Salir</button></div></aside>
 <main className="content"><header><div><p className="eyebrow">CHEFCITA 2.0</p><h1>{tab}</h1></div><div className="header-actions"><button className="mobile-settings mobile-menu-trigger" onClick={()=>setMobileMenuOpen(true)} aria-label="Abrir menú"><Menu/></button><button className="add" onClick={()=>setAdding(true)}><Plus/> <span>Añadir receta</span></button></div></header>
 {tab==='Inicio'&&<HomeDashboard onNavigate={goToTab} onAdd={()=>setAdding(true)} onOpenRecipe={openRecipe} ideaFocusKey={ideaFocusKey}/>} 
 {tab==='Mi cuenta'&&<Account session={session} onProfile={()=>setTab('Configuración')} onSettings={()=>setTab('Configuración')} onLogout={()=>supabase.auth.signOut()}/>}
 {tab==='Configuración'&&<SettingsPage session={session} initialSection={settingsStart} notice={inviteNotice} uiSize={uiSize} onUiSizeChange={setUiSize}/>} 
 {tab==='Recetas'&&<RecipeLibrary key={`recipes-${recipeRefresh}`} session={session} initialRecipeId={openRecipeId}/>} 
 {tab==='Mi cocina'&&<RecipeLibrary key={`kitchen-${recipeRefresh}`} session={session} mode="kitchen"/>}
 {tab==='Pendientes'&&<PendingHub key={`pending-${recipeRefresh}-${pendingStart}`} initialTab={pendingStart} onOpenRecipe={openRecipe}/>} 
 {tab!=='Inicio'&&tab!=='Mi cuenta'&&tab!=='Configuración'&&tab!=='Recetas'&&tab!=='Mi cocina'&&tab!=='Pendientes'&&<section className="empty"><ChefHat/><h2>{tab} está listo</h2><p>En el próximo paso conectamos esta sección con tus datos reales.</p></section>}
 {mobileMenuOpen&&<div className="mobile-app-menu-backdrop" onClick={e=>{if(e.target===e.currentTarget)setMobileMenuOpen(false)}}>
  <section className="mobile-app-menu" aria-label="Menú de Chefcita">
   <div className="mobile-app-menu-head"><div><small>CHEFCITA</small><b>Menú</b></div><button onClick={()=>setMobileMenuOpen(false)} aria-label="Cerrar menú"><X/></button></div>
   <button className="mobile-menu-add" onClick={()=>{setMobileMenuOpen(false);setAdding(true)}}><Plus/><span><b>Añadir receta</b><small>Desde Instagram o manualmente</small></span></button>
   <button onClick={()=>{setMobileMenuOpen(false);setMobileNavSelection('Mi cuenta');setTab('Mi cuenta')}}><UserRound/><span><b>Mi cuenta</b><small>Perfil y acceso</small></span></button>
   <button onClick={()=>{setMobileMenuOpen(false);setMobileNavSelection('Configuración');setTab('Configuración')}}><Settings/><span><b>Configuración</b><small>Pantalla, hogar e importaciones</small></span></button>
   <button className="mobile-menu-logout" onClick={()=>supabase.auth.signOut()}><LogOut/><span><b>Salir</b></span></button>
  </section>
 </div>}
  {adding&&<AddRecipe session={session} onClose={()=>setAdding(false)} onExistingRecipe={openRecipe} onSaved={(target='Recetas')=>{setAdding(false);setRecipeRefresh(x=>x+1);if(target==='Por validar'){setPendingStart('review');setMobileNavSelection('Pendientes');setTab('Pendientes')}else{if(target==='Pendientes')setPendingStart('imports');setMobileNavSelection(target);setTab(target)}}}/>} 
 </main></div>;
}
