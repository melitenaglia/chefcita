import React,{useState} from 'react';
import PendingImports from './PendingImports.jsx';
import ReviewRecipes from './ReviewRecipes.jsx';

export default function PendingHub({initialTab='imports'}){
 const [tab,setTab]=useState(initialTab==='review'?'review':'imports');
 return <section className="pending-hub">
  <div className="pending-tabs">
   <button className={tab==='imports'?'active':''} onClick={()=>setTab('imports')}>Importaciones</button>
   <button className={tab==='review'?'active':''} onClick={()=>setTab('review')}>Por validar</button>
  </div>
  {tab==='imports'?<PendingImports/>:<ReviewRecipes/>}
 </section>;
}
