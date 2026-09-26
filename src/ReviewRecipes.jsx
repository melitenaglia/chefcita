import React,{useEffect,useState} from 'react';
import {Check,ChefHat} from 'lucide-react';
import {supabase} from './supabase.js';
import RecipeEditor from './RecipeEditor.jsx';

export default function ReviewRecipes(){
 const [items,setItems]=useState([]);
 const [selected,setSelected]=useState(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');

 const loadList=async()=>{
  setLoading(true);setError('');
  const {data,error}=await supabase.from('recipes')
   .select('id,title,description,created_at')
   .eq('review_status','to_validate')
   .order('created_at',{ascending:false});
  if(error){setError(error.message);setItems([])}
  else setItems(data||[]);
  setLoading(false);
 };

 useEffect(()=>{loadList()},[]);

 if(selected){
  return <RecipeEditor
   recipeId={selected}
   mode="review"
   onBack={()=>setSelected(null)}
   onSaved={async({approved})=>{
    if(approved){
     setSelected(null);
     await loadList();
    }
   }}
  />;
 }

 if(loading)return <div className="library-state"><ChefHat/><p>Cargando recetas para validar...</p></div>;
 if(error)return <div className="library-state error"><p>No pudimos cargar las recetas para validar.</p><small>{error}</small><button onClick={loadList}>Reintentar</button></div>;

 return <section className="review-list">
  {items.length===0?<div className="library-state"><Check/><h2>Nada por validar</h2><p>Las recetas procesadas con IA o guardadas para completar aparecerán acá.</p></div>
  :items.map(item=><button className="review-card" key={item.id} onClick={()=>setSelected(item.id)}><span><b>{item.title}</b><small>{item.description||'Pendiente de completar'}</small></span><em>Revisar</em></button>)}
 </section>;
}
