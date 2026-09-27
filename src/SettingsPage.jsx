import React,{useEffect,useState} from 'react';
import {supabase} from './supabase.js';
import SharedLibrariesSettings from './SharedLibrariesSettings.jsx';
import {userErrorMessage} from './userError.js';

const settingsSections=['Pantalla','Bibliotecas','IA e importaciones'];

export default function SettingsPage({session,mode='settings',initialSection='Pantalla',notice='',uiSize='normal',onUiSizeChange}){
 const [section,setSection]=useState(mode==='account'?'Cuenta':initialSection);
 const [name,setName]=useState(session.user.user_metadata?.name||'');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);

 useEffect(()=>{
  setSection(mode==='account'?'Cuenta':initialSection);
  setMessage('');
 },[mode,initialSection]);

 const saveName=async()=>{
  setBusy(true);setMessage('');
  const {error}=await supabase.auth.updateUser({data:{name:name.trim()}});
  if(!error){
   const {error:profileError}=await supabase.from('profiles').update({display_name:name.trim()}).eq('id',session.user.id);
   setBusy(false);
   setMessage(profileError?userErrorMessage(profileError,'No pude guardar el nombre. Probá de nuevo.'):'Nombre guardado.');
   return;
  }
  setBusy(false);
  setMessage(userErrorMessage(error,'No pude guardar el nombre. Probá de nuevo.'));
 };

 const savePassword=async()=>{
  setMessage('');
  if(password.length<8){setMessage('La contraseña debe tener al menos 8 caracteres.');return;}
  if(password!==confirmPassword){setMessage('Las contraseñas no coinciden.');return;}
  setBusy(true);
  const {error}=await supabase.auth.updateUser({password});
  setBusy(false);
  if(error){setMessage(userErrorMessage(error,'No pude cambiar la contraseña. Probá de nuevo.'));return;}
  setPassword('');setConfirmPassword('');setMessage('Contraseña actualizada.');
 };

 return <section className={mode==='account'?'settings-page account-settings-page':'settings-page'}>
  {mode==='settings'&&<div className="settings-tabs settings-desktop-tabs">{settingsSections.map(x=><button key={x} className={section===x?'active':''} onClick={()=>{setSection(x);setMessage('')}}>{x}</button>)}</div>}
  {notice&&<p className="settings-message">{notice}</p>}

  <div className="settings-content">
   {section==='Cuenta'&&<>
    <h2>Mi cuenta</h2>
    <p>Gestioná tus datos de acceso.</p>
    <div className="setting-form"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label><button className="secondary" onClick={saveName} disabled={busy}>Guardar nombre</button></div>
    <div className="setting-row"><span><b>Email</b><small>Tu cuenta de acceso a Chefcita</small></span><strong>{session.user.email}</strong></div>
    <div className="setting-form"><label>Nueva contraseña<input type="password" minLength="8" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/></label><label>Repetir contraseña<input type="password" minLength="8" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repetí la contraseña"/></label><button className="secondary" onClick={savePassword} disabled={busy||!password}>Cambiar contraseña</button></div>
    {message&&<p className="settings-message">{message}</p>}
   </>}

   {section==='Pantalla'&&<>
    <h2>Pantalla</h2>
    <p>Elegí cuánto espacio ocupa Chefcita en este dispositivo.</p>
    <div className="ui-size-setting">
     <div className="ui-size-options" role="radiogroup" aria-label="Tamaño de la interfaz">
      <button type="button" role="radio" aria-checked={uiSize==='compact'} className={uiSize==='compact'?'active':''} onClick={()=>onUiSizeChange?.('compact')}><b>Compacto</b><small>Más contenido y menos espacio</small></button>
      <button type="button" role="radio" aria-checked={uiSize==='normal'} className={uiSize==='normal'?'active':''} onClick={()=>onUiSizeChange?.('normal')}><b>Normal</b><small>Equilibrado</small></button>
      <button type="button" role="radio" aria-checked={uiSize==='large'} className={uiSize==='large'?'active':''} onClick={()=>onUiSizeChange?.('large')}><b>Grande</b><small>Más cómodo para leer y tocar</small></button>
     </div>
     <small className="ui-size-device-note">Se guarda en este dispositivo. Cada móvil u ordenador puede tener un tamaño distinto.</small>
    </div>
   </>}

   {section==='Bibliotecas'&&<SharedLibrariesSettings session={session}/>}

   {section==='IA e importaciones'&&<>
    <h2>IA e importaciones</h2>
    <p>Chefcita intenta estructurar la receta automáticamente y deja para validar lo que no puede confirmar con seguridad.</p>
   </>}
  </div>
 </section>;
}
