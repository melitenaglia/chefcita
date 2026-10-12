import {supabase} from './supabase.js';
export async function uploadRecipePhoto(file,recipeId,userId){
 if(!file||!file.type.startsWith('image/')||file.type==='image/svg+xml')throw new Error('Elegí una foto JPG, PNG, WebP o una captura de pantalla.');
 if(file.size>20*1024*1024)throw new Error('La foto es demasiado grande. Elegí una de menos de 20 MB.');
 const url=URL.createObjectURL(file);
 let blob;
 try{
  const image=new Image();image.src=url;await image.decode();
  const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No pude preparar la foto.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
  if(!blob)throw new Error('No pude preparar la foto.');
 }catch(error){throw new Error('No pude leer esta foto. Probá con una captura o un JPG/PNG.')}finally{URL.revokeObjectURL(url)}
 const path=`${userId}/${recipeId}-${crypto.randomUUID()}.jpg`;
 const uploaded=await supabase.storage.from('recipe-thumbnails').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});
 if(uploaded.error)throw new Error('No pude subir la foto. Revisá la conexión y reintentá.');
 const imageUrl=supabase.storage.from('recipe-thumbnails').getPublicUrl(path).data.publicUrl;
 const saved=await supabase.from('recipes').update({image_url:imageUrl}).eq('id',recipeId).eq('owner_id',userId).select('id').maybeSingle();
 if(saved.error||!saved.data){await supabase.storage.from('recipe-thumbnails').remove([path]);throw new Error('No pude guardar la foto en la receta. Reintentá.')}
 return imageUrl;
}
export async function recoverRecipePhoto(recipeId){
 const result=await supabase.functions.invoke('recover-recipe-photo',{body:{recipe_id:recipeId}});
 if(result.error||!result.data?.image_url)throw new Error(result.data?.message||'No pude recuperar la foto desde la publicación. Podés elegir una de tu galería.');
 return result.data.image_url;
}
