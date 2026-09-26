import React from 'react';
import {UserRound,Settings,LogOut} from 'lucide-react';

export default function Account({session,onProfile,onSettings,onLogout}){
 const email=session?.user?.email||'';
 const name=session?.user?.user_metadata?.name||email.split('@')[0]||'Mi cuenta';
 return <section className="account-page">
  <div className="account-heading"><div className="account-avatar">{name.slice(0,1).toUpperCase()}</div><div><h2>{name}</h2><p>{email}</p></div></div>
  <div className="account-actions">
   <button onClick={onProfile}><UserRound/><span><b>Mi perfil</b><small>Datos personales y acceso</small></span></button>
   <button onClick={onSettings}><Settings/><span><b>Configuración</b><small>Preferencias de Chefcita</small></span></button>
   <button onClick={onLogout}><LogOut/><span><b>Salir</b><small>Cerrar sesión</small></span></button>
  </div>
 </section>;
}
