import React,{useEffect,useState} from 'react';
import {Home,UserPlus,Users} from 'lucide-react';
import {supabase} from './supabase.js';

export default function HouseholdSettings({session}){
 const [household,setHousehold]=useState(null);
 const [members,setMembers]=useState([]);
 const [invites,setInvites]=useState([]);
 const [name,setName]=useState('Mi hogar');
 const [email,setEmail]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');

 const load=async()=>{
  setLoading(true); setMessage('');
  const {data:membership,error:membershipError}=await supabase.from('household_members').select('household_id,role').eq('user_id',session.user.id).limit(1).maybeSingle();
  if(membershipError){setMessage(membershipError.message);setLoading(false);return;}
  if(!membership){setHousehold(null);setMembers([]);setInvites([]);setLoading(false);return;}
  const [{data:h,error:hError},{data:m,error:mError},{data:i,error:iError}]=await Promise.all([
   supabase.from('households').select('id,name,created_by').eq('id',membership.household_id).single(),
   supabase.from('household_members').select('user_id,role,joined_at,profiles(display_name)').eq('household_id',membership.household_id).order('joined_at'),
   membership.role==='owner'?supabase.from('household_invites').select('id,invited_email,expires_at,accepted_at').eq('household_id',membership.household_id).is('accepted_at',null).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})
  ]);
  const error=hError||mError||iError;
  if(error){setMessage(error.message);setLoading(false);return;}
  setHousehold({...h,role:membership.role}); setName(h.name); setMembers(m||[]); setInvites(i||[]); setLoading(false);
 };

 useEffect(()=>{load()},[]);

 const createHousehold=async()=>{
  if(!name.trim())return;
  setBusy(true);setMessage('');
  const {error}=await supabase.rpc('bootstrap_household',{p_name:name.trim()});
  setBusy(false);
  if(error){setMessage(error.message);return;}
  setMessage('Hogar creado.'); await load();
 };

 const rename=async()=>{
  if(!household||household.role!=='owner'||!name.trim())return;
  setBusy(true);setMessage('');
  const {error}=await supabase.from('households').update({name:name.trim()}).eq('id',household.id);
  setBusy(false);
  if(error){setMessage(error.message);return;}
  setMessage('Nombre del hogar actualizado.'); await load();
 };

 const invite=async()=>{
  const clean=email.trim().toLowerCase();
  if(!clean)return;
  setBusy(true);setMessage('');
  const {error}=await supabase.from('household_invites').insert({household_id:household.id,invited_email:clean,invited_by:session.user.id});
  setBusy(false);
  if(error){setMessage(error.message);return;}
  setEmail('');setMessage('Invitación creada. Cuando esa persona tenga cuenta podremos vincularla al hogar.');await load();
 };

 if(loading)return <div className="settings-loading">Cargando tu hogar…</div>;

 if(!household)return <div className="household-empty"><Home/><h2>Creá tu hogar</h2><p>Este será el espacio compartido para tus recetas y, después, para sumar a Sofi.</p><label>Nombre del hogar<input value={name} onChange={e=>setName(e.target.value)}/></label><button className="secondary" disabled={busy||!name.trim()} onClick={createHousehold}>Crear mi hogar</button>{message&&<p className="settings-message">{message}</p>}</div>;

 return <div className="household-panel">
  <div className="household-title"><div><h2>{household.name}</h2><p>{household.role==='owner'?'Sos administradora de este hogar.':'Sos integrante de este hogar.'}</p></div><Users/></div>
  {household.role==='owner'&&<div className="setting-form"><label>Nombre del hogar<input value={name} onChange={e=>setName(e.target.value)}/></label><button className="secondary" disabled={busy||name.trim()===household.name} onClick={rename}>Guardar nombre</button></div>}
  <div className="household-section"><h3>Integrantes</h3>{members.map(m=><div className="member-row" key={m.user_id}><span className="member-avatar">{(m.profiles?.display_name||'C').slice(0,1).toUpperCase()}</span><span><b>{m.user_id===session.user.id?'Vos':(m.profiles?.display_name||'Integrante')}</b><small>{m.role==='owner'?'Administradora':'Integrante'}</small></span></div>)}</div>
  {household.role==='owner'&&<div className="household-section"><h3><UserPlus/> Invitar integrante</h3><div className="invite-form"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@ejemplo.com"/><button className="secondary" disabled={busy||!email.includes('@')} onClick={invite}>Crear invitación</button></div>{invites.length>0&&<div className="pending-invites">{invites.map(i=><div key={i.id}><span>{i.invited_email}</span><small>Pendiente · vence {new Date(i.expires_at).toLocaleDateString('es-ES')}</small></div>)}</div>}</div>}
  {message&&<p className="settings-message">{message}</p>}
 </div>;
}
