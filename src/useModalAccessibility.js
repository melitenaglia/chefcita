import {useEffect} from 'react';
export default function useModalAccessibility(){
 useEffect(()=>{
  let active=null,previousFocus=null,frame=0;
  const selector='.mobile-drawer-backdrop,.modal-backdrop,.share-panel-backdrop,.install-help-backdrop';
  const controls=overlay=>[...overlay.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length>0);
  const sync=()=>{
   const overlays=[...document.querySelectorAll(selector)];
   const next=overlays.at(-1)||null;
   if(next===active)return;
   if(next){if(!active)previousFocus=document.activeElement;active=next;controls(active)[0]?.focus({preventScroll:true});}
   else{active=null;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;}
  };
  const observer=new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(sync)});
  observer.observe(document.body,{childList:true,subtree:true});
  const keydown=e=>{
   if(!active)return;
   if(e.key==='Escape'){
    const close=active.querySelector('.drawer-close,.form-head>button,.close-detail,.share-panel-head>button,.install-help-head button');
    if(close&&!close.disabled){e.preventDefault();close.click()}
   }
   if(e.key==='Tab'){
    const list=controls(active);if(!list.length)return;
    const first=list[0],last=list.at(-1);
    if(e.shiftKey&&(document.activeElement===first||!active.contains(document.activeElement))){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){e.preventDefault();first.focus()}
   }
  };
  document.addEventListener('keydown',keydown);sync();
  return()=>{observer.disconnect();cancelAnimationFrame(frame);document.removeEventListener('keydown',keydown)};
 },[]);
}
