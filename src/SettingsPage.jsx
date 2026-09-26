import React,{useState} from 'react';
const sections=['Cuenta','Mi hogar','Recetas','IA e importaciones','Datos'];
export default function SettingsPage({session}){
 const [section,setSection]=useState('Cuenta');
 return <section className="settings-page">
  <div className="settings-tabs">{sections.map(x=><button key={x} className={section===x?'active':''} onClick={()=>setSection(x)}>{x}</button>)}</div>
  <div className="settings-content">
   {section==='Cuenta'&&<><h2>Cuenta</h2><div className="setting-row"><span><b>Email</b><small>Tu cuenta de acceso a Chefcita</small></span><strong>{session.user.email}</strong></div><div className="setting-row"><span><b>Contraseña</b><small>Cambio de contraseña</small></span><em>Próximamente</em></div></>}
   {section==='Mi hogar'&&<><h2>Mi hogar</h2><p>Acá vas a poder compartir Chefcita con Sofi y gestionar integrantes.</p><div className="setting-row"><span><b>Chefcita</b><small>Espacio compartido</small></span><em>Configuración pendiente</em></div></>}
   {section==='Recetas'&&<><h2>Recetas</h2><p>Preferencias generales para guardar y organizar tus recetas.</p><div className="setting-row"><span><b>Privacidad por defecto</b><small>Quién podrá ver una receta nueva</small></span><strong>Mi hogar</strong></div></>}
   {section==='IA e importaciones'&&<><h2>IA e importaciones</h2><p>Chefcita no completará datos que no pueda obtener de la fuente. Lo que falte quedará para validar.</p></>}
   {section==='Datos'&&<><h2>Datos</h2><p>Importación de Chefcita 1.0 y futuras opciones de exportación.</p><div className="setting-row"><span><b>Chefcita 1.0</b><small>Biblioteca anterior</small></span><em>Pendiente de migrar</em></div></>}
  </div>
 </section>;
}
