import React,{useState} from 'react';
import {ArrowLeft,ChefHat,LoaderCircle,MailCheck,RefreshCw} from 'lucide-react';
import {supabase} from './supabase.js';
import {userErrorMessage} from './userError.js';

export default function Auth({notice='',onNoticeConsumed}){
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [mode,setMode]=useState('login');
 const [msg,setMsg]=useState('');
 const [busy,setBusy]=useState(false);
 const [confirmationEmail,setConfirmationEmail]=useState('');
 const [externalNotice,setExternalNotice]=useState(notice);
 const [resendBusy,setResendBusy]=useState(false);

 const redirectTo=`${window.location.origin}/`;

 React.useEffect(()=>{setExternalNotice(notice)},[notice]);

 const submit=async(e)=>{
  e.preventDefault();
  setBusy(true);
  setMsg('');
  setExternalNotice('');
  onNoticeConsumed?.();

  if(mode==='login'){
   const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
   setBusy(false);
   if(error)setMsg(userErrorMessage(error,'No pude iniciar la sesión. Revisá el email y la contraseña.'));
   return;
  }

  const {data,error}=await supabase.auth.signUp({
   email:email.trim(),
   password,
   options:{emailRedirectTo:redirectTo}
  });
  setBusy(false);

  if(error){
   setMsg(userErrorMessage(error,'No pude crear la cuenta. Revisá los datos y probá de nuevo.'));
   return;
  }

  if(!data?.session){
   setConfirmationEmail(email.trim());
   setPassword('');
  }
 };

 const resendConfirmation=async()=>{
  if(!confirmationEmail||resendBusy)return;
  setResendBusy(true);
  setMsg('');
  const {error}=await supabase.auth.resend({
   type:'signup',
   email:confirmationEmail,
   options:{emailRedirectTo:redirectTo}
  });
  setResendBusy(false);
  setMsg(error
   ?userErrorMessage(error,'No pude reenviar el correo. Esperá un momento y probá otra vez.')
   :'Te enviamos otro correo de confirmación.'
  );
 };

 const editEmail=()=>{
  setEmail(confirmationEmail);
  setConfirmationEmail('');
  setMode('signup');
  setMsg('');
 };

 return <main className="auth">
  <section className="auth-card">
   <div className="brandmark"><ChefHat/></div>
   <h1>Chefcita</h1>
   <p className="subtitle">Tu recetario, ordenado a tu manera.</p>

   {externalNotice&&<div className={externalNotice.startsWith('Email confirmado')?'auth-notice success':'auth-notice'}>{externalNotice}</div>}

   {confirmationEmail?<>
    <div className="signup-confirmation">
     <div className="signup-confirmation-icon"><MailCheck/></div>
     <h2>Revisá tu correo</h2>
     <p>Te enviamos un enlace a <b>{confirmationEmail}</b> para confirmar tu cuenta.</p>
     <small>Cuando confirmes el email, vas a poder entrar a Chefcita. Si no lo ves, revisá Spam o Promociones.</small>
     <button className="primary" type="button" onClick={()=>{setMode('login');setEmail(confirmationEmail);setConfirmationEmail('');setMsg('')}}>
      <ArrowLeft/>Volver a iniciar sesión
     </button>
     <div className="signup-confirmation-actions">
      <button type="button" className="secondary-auth" disabled={resendBusy} onClick={resendConfirmation}>
       {resendBusy?<LoaderCircle className="spin"/>:<RefreshCw/>}
       Reenviar correo
      </button>
      <button type="button" className="auth-link-button" onClick={editEmail}>Corregir email</button>
     </div>
    </div>
    {msg&&<p className="message">{msg}</p>}
   </>:<>
    <div className="tabs">
     <button type="button" className={mode==='login'?'active':''} onClick={()=>{setMode('login');setMsg('')}}>Entrar</button>
     <button type="button" className={mode==='signup'?'active':''} onClick={()=>{setMode('signup');setMsg('')}}>Crear cuenta</button>
    </div>
    <form onSubmit={submit}>
     <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="vos@ejemplo.com"/></label>
     <label>Contraseña<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"/></label>
     <button className="primary" disabled={busy}>{busy?<LoaderCircle className="spin"/>:(mode==='login'?'Entrar a Chefcita':'Crear mi cuenta')}</button>
    </form>
    {msg&&<p className="message">{msg}</p>}
   </>}
  </section>
 </main>;
}
