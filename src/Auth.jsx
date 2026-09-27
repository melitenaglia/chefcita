import React,{useState} from 'react';
import {ChefHat,LoaderCircle} from 'lucide-react';
import {supabase} from './supabase.js';
import {userErrorMessage} from './userError.js';
export default function Auth(){
 const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [mode,setMode]=useState('login'); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
 const submit=async(e)=>{e.preventDefault();setBusy(true);setMsg(''); const {error}=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password}); setBusy(false); if(error)setMsg(userErrorMessage(error,'No pude iniciar la sesión. Revisá el email y la contraseña.')); else if(mode==='signup')setMsg('Cuenta creada. Revisá tu email si Supabase solicita confirmación.');};
 return <main className="auth"><section className="auth-card"><div className="brandmark"><ChefHat/></div><h1>Chefcita</h1><p className="subtitle">Tu recetario, ordenado a tu manera.</p><div className="tabs"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Entrar</button><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Crear cuenta</button></div><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="vos@ejemplo.com"/></label><label>Contraseña<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"/></label><button className="primary" disabled={busy}>{busy?<LoaderCircle className="spin"/>:(mode==='login'?'Entrar a Chefcita':'Crear mi cuenta')}</button></form>{msg&&<p className="message">{msg}</p>}</section></main>;
}
