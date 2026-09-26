import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import {Heart, Inbox, BookOpen, Plus, ChefHat, Home, LogOut, LoaderCircle} from 'lucide-react';
import './styles.css';

const supabase=createClient(
  'https://yfhiqdpohixsvzuudivw.supabase.co',
  'sb_publishable_HGiPaAgXEqoZcZWC2jzOig_1vkqhMRL'
);

function Auth(){
 const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [mode,setMode]=useState('login'); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
 const submit=async(e)=>{e.preventDefault();setBusy(true);setMsg('');
  const fn=mode==='login'?supabase.auth.signInWithPassword({email,password}):supabase.auth.signUp({email,password});
  const {error}=await fn; setBusy(false);
  if(error)setMsg(error.message); else if(mode==='signup')setMsg('Cuenta creada. Revisá tu email si Supabase solicita confirmación.');
 };
 return <main className="auth"><section className="auth-card"><div className="brandmark"><ChefHat/></div><h1>Chef Cita</h1><p className="subtitle">Tu recetario, ordenado a tu manera.</p>
 <div className="tabs"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Entrar</button><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Crear cuenta</button></div>
 <form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="vos@ejemplo.com"/></label><label>Contraseña<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"/></label>
 <button className="primary" disabled={busy}>{busy?<LoaderCircle className="spin"/>:(mode==='login'?'Entrar a Chef Cita':'Crear mi cuenta')}</button></form>{msg&&<p className="message">{msg}</p>}</section></main>
}

function App(){
 const [session,setSession]=useState(null); const [loading,setLoading]=useState(true); const [tab,setTab]=useState('Inicio');
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
 if(loading)return <div className="splash"><ChefHat/><span>Chef Cita</span></div>;
 if(!session)return <Auth/>;
 const nav=[['Inicio',Home],['Recetas',BookOpen],['Pendientes',Inbox],['Mi cocina',Heart]];
 return <div className="shell"><aside><div className="logo"><ChefHat/><b>Chef Cita</b></div><nav>{nav.map(([n,I])=><button key={n} className={tab===n?'active':''} onClick={()=>setTab(n)}><I/>{n}</button>)}</nav><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut/>Salir</button></aside>
 <main className="content"><header><div><p className="eyebrow">CHEF CITA 2.0</p><h1>{tab}</h1></div><button className="add"><Plus/> Añadir receta</button></header>
 {tab==='Inicio'&&<><section className="welcome"><div><span>Tu cocina empieza acá</span><h2>¿Qué cocinamos hoy?</h2><p>Guardá recetas, organizalas y convertí ese Reel que nunca volvés a encontrar en una receta de verdad.</p></div><ChefHat/></section><div className="cards"><article><BookOpen/><b>Recetas</b><strong>0</strong><small>Tu biblioteca está lista para empezar.</small></article><article><Inbox/><b>Pendientes</b><strong>0</strong><small>Recetas esperando revisión.</small></article><article><Heart/><b>Favoritas</b><strong>0</strong><small>Las que siempre querés repetir.</small></article></div></>}
 {tab!=='Inicio'&&<section className="empty"><ChefHat/><h2>{tab} está listo</h2><p>En el próximo paso conectamos esta sección con tus datos reales.</p></section>}
 </main></div>
}
createRoot(document.getElementById('root')).render(<App/>);