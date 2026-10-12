import {useEffect} from 'react';
import {supabase} from './supabase.js';
export default function usePhotoRecovery(session){
 useEffect(()=>{
  if(!session?.user?.id)return;
  let stopped=false;const key=`chefcita:photo-repair-v1:${session.user.id}`;
  const run=async()=>{
   try{if(sessionStorage.getItem(key)==='done')return}catch{}
   const excluded=[];
   for(let i=0;i<50&&!stopped;i++){
    const {data,error}=await supabase.functions.invoke('recover-recipe-photo',{body:{batch:true,exclude_ids:excluded}});
    if(error||!data||stopped)return;
    const updates=data.updates||[];excluded.push(...updates.map(x=>x.id),...(data.failed||[]));
    if(updates.length)window.dispatchEvent(new CustomEvent('chefcita-photos',{detail:updates}));
    if(!data.scanned){try{sessionStorage.setItem(key,'done')}catch{}return}
   }
  };
  run();return()=>{stopped=true};
 },[session?.user?.id]);
}
