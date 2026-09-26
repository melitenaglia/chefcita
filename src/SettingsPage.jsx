import React,{useState} from 'react';
import {supabase} from './supabase.js';
import HouseholdSettings from './HouseholdSettings.jsx';

const sections=['Cuenta','Mi hogar','Recetas','IA e importaciones','Datos'];

export default function SettingsPage({session,initialSection='Cuenta'}){
 const [section,setSection]=useState(initialSection);
 const [name,setName]=useState(session.user.user_metadata?.name||'');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);

 const saveName=async()=>{
  setBusy(true); setMessage('');
  const {error}=await supabase.auth.updateUser({data:{name:name.trim()}});
  setBusy(false);
  setMessage(error?error.message:'Nombre guardado.');
 };

 const savePassword=async()=>{
  setMessage('');
  if(password.length<8){setMessage('La contraseña debe tener al menos 8 caracteres.');return;}
  if(password!==confirmPassword){setMessage('Las contraseñas no coinciden.');return;}
  setBusy(true);
  const {error}=await supabase.auth.updateUser({password});
  setBusy(false);
  if(error){setMessage(error.message);return;}
  setPassword(''); setConfirmPassword(''); setMessage('Contraseña actualizada.');
 };

 return <section className="settings-page">
  <div className="settings-tabs">{sections.map(x=><button key={x} className={section===x?'active':''} onClick={()=>{setSection(x);setMessage('')}}>{x}</button>)}</div>
  <div className="settings-content">
   {section==='Cuenta'&&<>
    <h2>Cuenta</h2>
    <p>Gestioná tus datos de acceso y cómo aparecés en Chefcita.</p>
    <div className="setting-form"><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label><button className="secondary" onClick={saveName} disabled={busy}>Guardar nombre</button></div>
    <div className="setting-row"><span><b>Email</b><small>Tu cuenta de acceso a Chefcita</small></span><strong>{session.user.email}</strong></div>
    <div className="setting-form"><label>Nueva contraseña<input type="password" minLength="8" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/></label><label>Repetir contraseña<input type="password" minLength="8" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repetí la contraseña"/></label><button className="secondary" onClick={savePassword} disabled={busy||!password}>Cambiar contraseña</button></div>
    {message&&<p className="settings-message">{message}</p>}
   </>}
   {section==='Mi hogar'&&<HouseholdSettings session={session}/>}
   {section==='Recetas'&&<><h2>Recetas</h2><p>Preferencias generales para guardar y organizar tus recetas.</p><div className="setting-row"><span><b>Privacidad por defecto</b><small>Quién podrá ver una receta nueva</small></span><strong>Mi hogar</strong></div></>}
   {section==='IA e importaciones'&&<><h2>IA e importaciones</h2><p>Chefcita no completará datos que no pueda obtener de la fuente. Lo que falte quedará para validar.</p></>}
   {section==='Datos'&&<><h2>Datos</h2><p>Importación de Chefcita 1.0 y futuras opciones de exportación.</p><div className="setting-row"><span><b>Chefcita 1.0</b><small>Biblioteca anterior</small></span><em>Pendiente de migrar</em></div></>}
  </div>
 </section>;
}
