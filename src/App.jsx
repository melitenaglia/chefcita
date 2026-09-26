import React, {useEffect,useState} from 'react';
import {Heart,Inbox,BookOpen,Plus,ChefHat,Home,LogOut,UserRound,Settings} from 'lucide-react';
import {supabase} from './supabase.js';
import Auth from './Auth.jsx';
import Account from './Account.jsx';
import SettingsPage from './SettingsPage.jsx';
import RecipeLibrary from './RecipeLibrary.jsx';
import AddRecipe from './AddRecipe.jsx';
import PendingImports from './PendingImports.jsx';
import RecipeDetail from './RecipeDetail.jsx';

export default function App(){
 const [session,setSession]=useState(null);
 const [loading,setLoading]=useState(true);
 const [tab,setTab]=useState('Inicio');
 const [settingsStart,setSettingsStart]=useState('Cuenta');
 const [adding,setAdding]=useState(false);
 const [recipeRefresh,setRecipeRefresh]=useState(0);
 const [openRecipe,setOpenRecipe]=useState(null);
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
   if(error) console.error('No se pudo aceptar la invitación',error);
   else {setSettingsStart('Mi hogar');setTab('Configuración');}
   window.history.replaceState({},'',window.location.pathname);
  });
 },[session]);
 if(loading)return <div className="splash"><ChefHat/><span>Chefcita</span></div>;
 if(!session)return <Auth/>;
 const nav=[['Inicio',Home],['Recetas',BookOpen],['Pendientes',Inbox],['Mi cocina',Heart]];
 return <div className="shell"><aside><div className="logo"><ChefHat/><b>Chefcita</b></div><nav>{nav.map(([n,I])=><button key={n} className={tab===n?'active':''} onClick={()=>setTab(n)}><I/>{n}</button>)}</nav><div className="account-nav"><button onClick={()=>setTab('Mi cuenta')}><UserRound/>Mi cuenta</button><button onClick={()=>setTab('Configuración')}><Settings/>Config.</button><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut/>Salir</button></div></aside>
 <main className="content"><header><div><p className="eyebrow">CHEFCITA 2.0</p><h1>{tab}</h1></div><button className="add" onClick={()=>setAdding(true)}><Plus/> Añadir receta</button></header>
 {tab==='Inicio'&&<><section className="welcome"><div><span>Tu cocina empieza acá</span><h2>¿Qué cocinamos hoy?</h2><p>Guardá recetas, organizalas y convertí ese Reel que nunca volvés a encontrar en una receta de verdad.</p></div><ChefHat/></section><div className="cards"><article><BookOpen/><b>Recetas</b><strong>0</strong><small>Tu biblioteca está lista para empezar.</small></article><article><Inbox/><b>Pendientes</b><strong>0</strong><small>Recetas esperando revisión.</small></article><article><Heart/><b>Favoritas</b><strong>0</strong><small>Las que siempre querés repetir.</small></article></div></>}
 {tab==='Mi cuenta'&&<Account session={session} onProfile={()=>setTab('Configuración')} onSettings={()=>setTab('Configuración')} onLogout={()=>supabase.auth.signOut()}/>}
 {tab==='Configuración'&&<SettingsPage session={session} initialSection={settingsStart}/>} 
 {tab==='Recetas'&&<RecipeLibrary key={`recipes-${recipeRefresh}`} session={session} onOpen={setOpenRecipe}/>} 
 {tab==='Mi cocina'&&<RecipeLibrary key={`favorites-${recipeRefresh}`} session={session} mode="favorites" onOpen={setOpenRecipe}/>}
 {tab==='Pendientes'&&<PendingImports key={`pending-${recipeRefresh}`}/>} 
 {tab!=='Inicio'&&tab!=='Mi cuenta'&&tab!=='Configuración'&&tab!=='Recetas'&&tab!=='Mi cocina'&&tab!=='Pendientes'&&<section className="empty"><ChefHat/><h2>{tab} está listo</h2><p>En el próximo paso conectamos esta sección con tus datos reales.</p></section>}
 {openRecipe&&<div className="detail-overlay"><RecipeDetail recipeId={openRecipe} onBack={()=>setOpenRecipe(null)}/></div>}
 {adding&&<AddRecipe session={session} onClose={()=>setAdding(false)} onSaved={(target='Recetas')=>{setAdding(false);setRecipeRefresh(x=>x+1);setTab(target)}}/>}
 </main></div>;
}
