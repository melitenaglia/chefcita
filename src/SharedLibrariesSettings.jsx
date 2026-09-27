import React,{useEffect,useMemo,useState} from 'react';
import {BookOpen,ChevronDown,Copy,Plus,UserPlus,Users} from 'lucide-react';
import {supabase} from './supabase.js';
import {userErrorMessage} from './userError.js';
import {loadSharedLibraries} from './sharedLibraries.js';

export default function SharedLibrariesSettings({session}){
 const [libraries,setLibraries]=useState([]);
 const [members,setMembers]=useState([]);
 const [invites,setInvites]=useState([]);
 const [expanded,setExpanded]=useState('');
 const [newName,setNewName]=useState('');
 const [inviteEmail,setInviteEmail]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');

 const load=async()=>{
  setLoading(true);setMessage('');
  const {data,error}=await loadSharedLibraries(session.user.id);
  if(error){setMessage(userErrorMessage(error,'No pude cargar tus bibliotecas compartidas.'));setLoading(false);return}
  setLibraries(data||[]);
  const ids=(data||[]).map(x=>x.id);
  if(!ids.length){setMembers([]);setInvites([]);setLoading(false);return}

  const ownerIds=(data||[]).filter(x=>x.role==='owner').map(x=>x.id);
  const [{data:memberRows,error:memberError},{data:inviteRows,error:inviteError}]=await Promise.all([
   supabase.from('household_members').select('household_id,user_id,role,joined_at,profiles(display_name)').in('household_id',ids).order('joined_at'),
   ownerIds.length
    ?supabase.from('household_invites').select('id,household_id,invited_email,token,expires_at,accepted_at').in('household_id',ownerIds).is('accepted_at',null).order('created_at',{ascending:false})
    :Promise.resolve({data:[],error:null})
  ]);

  if(memberError||inviteError)setMessage(userErrorMessage(memberError||inviteError,'No pude cargar todos los datos de las bibliotecas.'));
  setMembers(memberRows||[]);
  setInvites(inviteRows||[]);
  setLoading(false);
 };

 useEffect(()=>{load()},[]);

 const counts=useMemo(()=>{
  const map=new Map();
  for(const row of members)map.set(row.household_id,(map.get(row.household_id)||0)+1);
  return map;
 },[members]);

 const createLibrary=async()=>{
  const name=newName.trim();
  if(!name)return;
  setBusy(true);setMessage('');
  const {data,error}=await supabase.rpc('create_shared_library',{p_name:name});
  setBusy(false);
  if(error){setMessage(userErrorMessage(error,'No pude crear la biblioteca. Probá de nuevo.'));return}
  setNewName('');
  await load();
  if(data)setExpanded(data);
 };

 const renameLibrary=async(library,name)=>{
  const clean=name.trim();
  if(!clean||library.role!=='owner')return;
  setBusy(true);setMessage('');
  const {error}=await supabase.from('households').update({name:clean}).eq('id',library.id);
  setBusy(false);
  if(error){setMessage(userErrorMessage(error,'No pude cambiar el nombre.'));return}
  await load();
 };

 const invite=async library=>{
  const email=inviteEmail.trim().toLowerCase();
  if(!email||library.role!=='owner')return;
  setBusy(true);setMessage('');
  const {data,error}=await supabase.from('household_invites').insert({
   household_id:library.id,
   invited_email:email,
   invited_by:session.user.id
  }).select('id,household_id,invited_email,token,expires_at,accepted_at').single();
  setBusy(false);
  if(error){setMessage(userErrorMessage(error,'No pude crear la invitación.'));return}
  setInviteEmail('');
  setInvites(current=>[data,...current]);
  setMessage('Invitación creada. Copiá el enlace y compartilo con esa persona.');
 };

 const copyInvite=async invite=>{
  const link=`${window.location.origin}${window.location.pathname}?invite=${invite.token}`;
  try{await navigator.clipboard.writeText(link);setMessage('Enlace copiado.')}
  catch{setMessage('No pude copiar el enlace automáticamente.')}
 };

 if(loading)return <div className="settings-loading">Cargando bibliotecas…</div>;

 return <div className="shared-libraries">
  <div className="shared-library-intro">
   <BookOpen/>
   <div><h2>Bibliotecas compartidas</h2><p>Tus recetas siempre quedan en tu biblioteca personal. Después podés compartirlas con una o varias bibliotecas.</p></div>
  </div>

  <div className="personal-library-card">
   <span><BookOpen/></span>
   <div><b>Personal</b><small>Es tu biblioteca base. No hace falta crearla ni gestionarla.</small></div>
  </div>

  <div className="create-shared-library">
   <label>Nueva biblioteca compartida<input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Ej. Con Sofi, Familia, Recetas de mamá"/></label>
   <button className="secondary" disabled={busy||!newName.trim()} onClick={createLibrary}><Plus/>Crear biblioteca</button>
  </div>

  {libraries.length===0?<div className="shared-library-empty"><Users/><p>Todavía no tenés bibliotecas compartidas.</p></div>:
   <div className="shared-library-list">{libraries.map(library=>{
    const open=expanded===library.id;
    const libraryMembers=members.filter(x=>x.household_id===library.id);
    const libraryInvites=invites.filter(x=>x.household_id===library.id);
    return <article key={library.id} className={open?'shared-library-card open':'shared-library-card'}>
     <button className="shared-library-summary" onClick={()=>setExpanded(open?'':library.id)}>
      <span className="shared-library-icon"><Users/></span>
      <span><b>{library.name}</b><small>{counts.get(library.id)||1} {(counts.get(library.id)||1)===1?'integrante':'integrantes'} · {library.role==='owner'?'La administrás vos':'Compartida con vos'}</small></span>
      <ChevronDown/>
     </button>

     {open&&<div className="shared-library-body">
      {library.role==='owner'&&<label>Nombre de la biblioteca
       <div className="shared-library-rename"><input defaultValue={library.name} id={`library-name-${library.id}`}/><button className="secondary" disabled={busy} onClick={()=>renameLibrary(library,document.getElementById(`library-name-${library.id}`)?.value||'')}>Guardar</button></div>
      </label>}

      <div className="shared-library-section">
       <h3>Integrantes</h3>
       {libraryMembers.map(member=><div className="member-row" key={`${library.id}-${member.user_id}`}>
        <span className="member-avatar">{(member.profiles?.display_name||'C').slice(0,1).toUpperCase()}</span>
        <span><b>{member.user_id===session.user.id?'Vos':(member.profiles?.display_name||'Integrante')}</b><small>{member.role==='owner'?'Administradora':'Integrante'}</small></span>
       </div>)}
      </div>

      {library.role==='owner'&&<div className="shared-library-section">
       <h3><UserPlus/>Invitar a alguien</h3>
       <div className="invite-form"><input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="email@ejemplo.com"/><button className="secondary" disabled={busy||!inviteEmail.includes('@')} onClick={()=>invite(library)}>Crear invitación</button></div>
       {libraryInvites.length>0&&<div className="pending-invites">{libraryInvites.map(item=><div key={item.id}><span><b>{item.invited_email}</b><small>Pendiente · vence {new Date(item.expires_at).toLocaleDateString('es-ES')}</small></span><button className="copy-link" onClick={()=>copyInvite(item)}><Copy/>Copiar enlace</button></div>)}</div>}
      </div>}
     </div>}
    </article>
   })}</div>}

  {message&&<p className="settings-message">{message}</p>}
 </div>;
}
