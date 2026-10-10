import React,{useEffect,useLayoutEffect,useState} from 'react';
import {Heart,Inbox,BookOpen,Plus,ChefHat,CheckCircle2,Home,LogOut,UserRound,Settings,Menu,X,WandSparkles,ChevronLeft,ChevronRight,Download,Share2,Smartphone} from 'lucide-react';
import {supabase} from './supabase.js';
import Auth from './Auth.jsx';
import SettingsPage from './SettingsPage.jsx';
import RecipeLibrary from './RecipeLibrary.jsx';
import AddRecipe from './AddRecipe.jsx';
import PendingHub from './PendingHub.jsx';
import HomeDashboard from './HomeDashboard.jsx';

export default function App(){
 const [session,setSession]=useState(null);
 const [loading,setLoading]=useState(true);
 const [authNotice,setAuthNotice]=useState('');
 const [tab,setTab]=useState('Inicio');
 const [settingsStart,setSettingsStart]=useState('Pantalla');
 const [adding,setAdding]=useState(false);
 const [saveNotice,setSaveNotice]=useState('');
 const [recipeRefresh,setRecipeRefresh]=useState(0);
 const [recipeListFilter,setRecipeListFilter]=useState('');
 const [ideaFocusKey,setIdeaFocusKey]=useState(0);
 const [pendingStart,setPendingStart]=useState('imports');
 const [openRecipeId,setOpenRecipeId]=useState(null);
 const [inviteNotice,setInviteNotice]=useState('');
 const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
 const [mobileMenuLevel,setMobileMenuLevel]=useState('root');
 const [installPrompt,setInstallPrompt]=useState(null);
 const [installHelpOpen,setInstallHelpOpen]=useState(false);
 const [standalone,setStandalone]=useState(()=>{
  try{return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}catch{return false}
 });
 const [uiSize,setUiSize]=useState(()=>{
  try{
   const saved=localStorage.getItem('chefcita:ui-size');
   return ['compact','normal','large'].includes(saved)?saved:'normal';
  }catch{return 'normal'}
 });
 const [theme,setTheme]=useState(()=>{
  try{
   const saved=localStorage.getItem('chefcita:theme');
   return ['sage','olive','tomato','lavender'].includes(saved)?saved:'sage';
  }catch{return 'sage'}
 });

 useLayoutEffect(()=>{
  document.documentElement.dataset.uiSize=uiSize;
  try{localStorage.setItem('chefcita:ui-size',uiSize)}catch{}
 },[uiSize]);

 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');
  const updateStandalone=()=>setStandalone(media.matches||window.navigator.standalone===true);
  const handleBeforeInstall=event=>{
   event.preventDefault();
   setInstallPrompt(event);
  };
  const handleInstalled=()=>{
   setInstallPrompt(null);
   setStandalone(true);
   setInstallHelpOpen(false);
  };
  window.addEventListener('beforeinstallprompt',handleBeforeInstall);
  window.addEventListener('appinstalled',handleInstalled);
  media.addEventListener?.('change',updateStandalone);
  return()=>{
   window.removeEventListener('beforeinstallprompt',handleBeforeInstall);
   window.removeEventListener('appinstalled',handleInstalled);
   media.removeEventListener?.('change',updateStandalone);
  };
 },[]);

 useLayoutEffect(()=>{
  document.documentElement.dataset.theme=theme;
  const themeColors={
   sage:'#F5F7F2',
   olive:'#F7F6EF',
   tomato:'#FCF8F1',
   lavender:'#F8F5F8'
  };
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themeColors[theme]||themeColors.sage);
  try{localStorage.setItem('chefcita:theme',theme)}catch{}
 },[theme]);

 useEffect(()=>{
  let cancelled=false;
  let handlingConfirmation=false;

  const initAuth=async()=>{
   const params=new URLSearchParams(window.location.search);
   const tokenHash=params.get('token_hash');
   const type=params.get('type');
   const confirmSignup=params.get('confirm_signup')==='1';

   if(confirmSignup&&tokenHash&&type==='email'){
    handlingConfirmation=true;
    const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:'email'});
    await supabase.auth.signOut({scope:'local'});
    window.history.replaceState({},'',window.location.pathname);
    if(cancelled)return;
    setSession(null);
    setAuthNotice(error
     ?'No pudimos confirmar el email. El enlace puede haber vencido; podés pedir uno nuevo desde Crear cuenta.'
     :'Email confirmado. Ya podés iniciar sesión con tu contraseña.'
    );
    setLoading(false);
    return;
   }

   const {data}=await supabase.auth.getSession();
   if(cancelled)return;
   setSession(data.session);
   setLoading(false);
  };

  const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,nextSession)=>{
   if(!handlingConfirmation)setSession(nextSession);
  });

  initAuth();
  return()=>{cancelled=true;subscription.unsubscribe()};
 },[]);

 useEffect(()=>{
  if(!session)return;
  const token=new URLSearchParams(window.location.search).get('invite');
  if(!token)return;
  supabase.rpc('accept_shared_library_invite',{p_token:token}).then(({error})=>{
   setSettingsStart('Bibliotecas');
   setTab('Configuración');
   if(error)setInviteNotice('No pude aceptar esta invitación. Comprobá que hayas iniciado sesión con el mismo email al que se envió y que el enlace no haya vencido.');
   else setInviteNotice('Listo. Ya te uniste a la biblioteca compartida.');
   window.history.replaceState({},'',window.location.pathname);
  });
 },[session]);

 if(loading)return <div className="splash"><ChefHat/><span>Chefcita</span></div>;
 if(!session)return <Auth notice={authNotice} onNoticeConsumed={()=>setAuthNotice('')}/>;

 const nav=[['Inicio',Home],['Recetas',BookOpen],['Pendientes',Inbox]];
 const mobileNav=[['Inicio',Home],['Ideas',WandSparkles],['Recetas',BookOpen]];

 const closeMenu=()=>{
  setMobileMenuOpen(false);
  setMobileMenuLevel('root');
 };

 const userAgent=typeof navigator==='undefined'?'':navigator.userAgent;
 const isIOS=/iPad|iPhone|iPod/.test(userAgent)||(/Macintosh/.test(userAgent)&&navigator.maxTouchPoints>1);
 const isAndroid=/Android/.test(userAgent);

 const installChefcita=async()=>{
  closeMenu();
  if(standalone)return;

  if(installPrompt){
   const prompt=installPrompt;
   setInstallPrompt(null);
   try{
    await prompt.prompt();
    const choice=prompt.userChoice?await prompt.userChoice:null;
    if(choice?.outcome!=='accepted')setInstallHelpOpen(true);
   }catch{
    setInstallHelpOpen(true);
   }
   return;
  }

  if(isIOS&&navigator.share){
   try{
    await navigator.share({
     title:'Chefcita',
     text:'Añadí Chefcita a tu pantalla de inicio',
     url:window.location.origin
    });
   }catch(error){
    if(error?.name==='AbortError')setInstallHelpOpen(true);
    else setInstallHelpOpen(true);
   }
   return;
  }

  setInstallHelpOpen(true);
 };

 const goToTab=target=>{
  setSaveNotice('');
  if(target==='Mi cocina'||target==='Favoritas'){
   setRecipeListFilter('favorite');
   target='Recetas';
  }else if(target==='Recetas')setRecipeListFilter('');
  if(target==='Inicio')setIdeaFocusKey(0);
  if(target==='Pendientes')setPendingStart('imports');
  closeMenu();
  setTab(target);
 };

 const goToIdeas=()=>{
  closeMenu();
  setSaveNotice('');
  setIdeaFocusKey(n=>n+1);
  setTab('Inicio');
 };

 const openSettings=section=>{
  closeMenu();
  setSettingsStart(section);
  setTab('Configuración');
 };

 const openRecipe=id=>{
  if(!id)return;
  setAdding(false);
  setRecipeListFilter('');
  setOpenRecipeId(id);
  setRecipeRefresh(x=>x+1);
  setTab('Recetas');
 };

 return <div className="shell">
  <aside className="desktop-sidebar">
   <div className="logo"><ChefHat/><b>Chefcita</b></div>
   <nav className="desktop-nav">{nav.map(([n,I])=><button key={n} className={tab===n?'active':''} onClick={()=>goToTab(n)}><I/><span>{n==='Pendientes'?'Por revisar':n}</span></button>)}</nav>
   <div className="account-nav">
    <button className={tab==='Mi cuenta'?'active':''} onClick={()=>setTab('Mi cuenta')}><UserRound/>Mi cuenta</button>
    <button className={tab==='Configuración'?'active':''} onClick={()=>{setSettingsStart('Pantalla');setTab('Configuración')}}><Settings/>Config.</button>
    <button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut/>Salir</button>
   </div>
  </aside>

  <nav className="mobile-bottom-nav" aria-label="Navegación principal">
   {mobileNav.map(([name,Icon])=>{
    const selected=name==='Ideas'?tab==='Inicio'&&ideaFocusKey>0:tab===name&&(name!=='Inicio'||ideaFocusKey===0);
    return <button type="button" key={name} className={(selected?'active ':'')+(name==='Ideas'?'mobile-nav-ideas':'')} aria-label={name==='Ideas'?'Sugerime una receta':name} aria-current={selected?'page':undefined} onClick={()=>name==='Ideas'?goToIdeas():goToTab(name)}><Icon/><span>{name}</span></button>;
   })}
  </nav>

  <main className="content">
   <header className="app-header">
    <button className="mobile-menu-trigger" onClick={()=>{setMobileMenuLevel('root');setMobileMenuOpen(true)}} aria-label="Abrir menú"><Menu/></button>
    <div className="app-header-title"><p className="eyebrow">CHEFCITA 2.0</p><h1>{tab==='Pendientes'?'Revisar recetas':tab}</h1></div>
    <div className="header-actions">
     <button className="add" onClick={()=>setAdding(true)}><Plus/><span>Añadir receta</span></button>
    </div>
   </header>

   {saveNotice&&<div className="save-notice" role="status"><CheckCircle2/><span>{saveNotice}</span></div>}
   {tab==='Inicio'&&<HomeDashboard session={session} onNavigate={goToTab} onAdd={()=>setAdding(true)} onOpenRecipe={openRecipe} ideaFocusKey={ideaFocusKey}/>}
   {tab==='Mi cuenta'&&<SettingsPage session={session} mode="account" uiSize={uiSize} onUiSizeChange={setUiSize} theme={theme} onThemeChange={setTheme}/>}
   {tab==='Configuración'&&<SettingsPage session={session} mode="settings" initialSection={settingsStart} notice={inviteNotice} uiSize={uiSize} onUiSizeChange={setUiSize} theme={theme} onThemeChange={setTheme}/>} 
   {tab==='Recetas'&&<RecipeLibrary key={`recipes-${recipeRefresh}-${recipeListFilter}`} session={session} initialRecipeId={openRecipeId} initialPersonalFilter={recipeListFilter}/>}
   {tab==='Pendientes'&&<PendingHub key={`pending-${recipeRefresh}-${pendingStart}`} initialTab={pendingStart} onOpenRecipe={openRecipe}/>}

   {mobileMenuOpen&&<div className="mobile-drawer-backdrop" onClick={e=>{if(e.target===e.currentTarget)closeMenu()}}>
    <section className="mobile-drawer" aria-label={mobileMenuLevel==='settings'?'Configuración':'Menú de Chefcita'}>
     <div className="mobile-drawer-head">
      {mobileMenuLevel==='settings'?<button className="drawer-back" onClick={()=>setMobileMenuLevel('root')}><ChevronLeft/>Menú</button>:<div><small>CHEFCITA</small><b>Menú</b></div>}
      <button className="drawer-close" onClick={closeMenu} aria-label="Cerrar menú"><X/></button>
     </div>

     {mobileMenuLevel==='root'?<>
      <div className="drawer-group">
       <small>ACCIONES</small>
       <button onClick={()=>{closeMenu();setAdding(true)}}><Plus/><span><b>Guardar receta</b><small>Instagram o escribir a mano</small></span></button>
       <button onClick={()=>goToTab('Pendientes')}><Inbox/><span><b>Recetas por revisar</b><small>Importaciones y recetas sin terminar</small></span></button>
       {!standalone&&<button onClick={installChefcita}><Download/><span><b>Instalar Chefcita</b><small>Añadila a la pantalla de inicio</small></span></button>}
      </div>
      <div className="drawer-group">
       <small>CUENTA</small>
       <button onClick={()=>{closeMenu();setTab('Mi cuenta')}}><UserRound/><span><b>Mi cuenta</b><small>Nombre, email y contraseña</small></span></button>
       <button onClick={()=>setMobileMenuLevel('settings')}><Settings/><span><b>Configuración</b><small>Pantalla, bibliotecas e importaciones</small></span><ChevronRight/></button>
       <button className="drawer-logout" onClick={()=>supabase.auth.signOut()}><LogOut/><span><b>Salir</b></span></button>
      </div>
     </>:<>
      <div className="drawer-group settings-submenu">
       <small>CONFIGURACIÓN</small>
       <button onClick={()=>openSettings('Pantalla')}><Settings/><span><b>Pantalla</b><small>Tamaño y densidad de interfaz</small></span></button>
       <button onClick={()=>openSettings('Bibliotecas')}><BookOpen/><span><b>Bibliotecas</b><small>Recetas compartidas e invitaciones</small></span></button>
       <button onClick={()=>openSettings('IA e importaciones')}><WandSparkles/><span><b>IA e importaciones</b><small>Cómo se procesan las recetas</small></span></button>
      </div>
     </>}
    </section>
   </div>}

   {installHelpOpen&&<div className="install-help-backdrop" onClick={e=>{if(e.target===e.currentTarget)setInstallHelpOpen(false)}}>
    <section className="install-help" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
     <div className="install-help-head">
      <div><Smartphone/><span><b id="install-help-title">Instalar Chefcita</b><small>Acceso rápido desde tu pantalla de inicio</small></span></div>
      <button onClick={()=>setInstallHelpOpen(false)} aria-label="Cerrar"><X/></button>
     </div>
     {isIOS?<div className="install-help-content">
      <p><b>Te falta solo la confirmación del iPhone.</b></p>
      {navigator.share&&<button className="install-share-button" onClick={async()=>{
       try{
        await navigator.share({title:'Chefcita',text:'Añadí Chefcita a tu pantalla de inicio',url:window.location.origin});
       }catch{}
      }}><Share2/>Abrir menú del iPhone</button>}
      <ol>
       <li>Elegí <b>Añadir a pantalla de inicio</b>.</li>
       <li>Confirmá con <b>Añadir</b>.</li>
      </ol>
      <small>Funciona desde Safari, Chrome y otros navegadores actuales de iPhone.</small>
     </div>:isAndroid?<div className="install-help-content">
      <p><b>En Android podés instalarla como una app.</b></p>
      <ol>
       <li>Abrí el menú <b>⋮</b> de Chrome.</li>
       <li>Elegí <b>Instalar app</b> o <b>Añadir a pantalla principal</b>.</li>
       <li>Confirmá la instalación.</li>
      </ol>
     </div>:<div className="install-help-content">
      <p>Buscá en el menú de tu navegador la opción <b>Instalar app</b> o <b>Añadir a pantalla de inicio</b>.</p>
     </div>}
     <button className="primary install-help-close" onClick={()=>setInstallHelpOpen(false)}>Entendido</button>
    </section>
   </div>}

   {adding&&<AddRecipe session={session} onClose={()=>setAdding(false)} onExistingRecipe={openRecipe} onSaved={(target='Recetas')=>{
    setAdding(false);
    setRecipeRefresh(x=>x+1);
    if(target==='Por validar'){
     setPendingStart('review');setTab('Pendientes');
     setSaveNotice('¡Receta guardada! Revisala para que aparezca en tu recetario.');
    }else{
     if(target==='Pendientes'){
      setPendingStart('imports');
      setSaveNotice('El enlace quedó guardado. Podés terminar la receta cuando quieras.');
     }else setSaveNotice('¡Receta guardada en tu recetario!');
     setTab(target);
    }
   }}/>}
  </main>
 </div>;
}
