import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Content-Type':'application/json'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const instagramPost=(value:string)=>{try{const u=new URL(value);return u.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(u.hostname)&&/^\/(reels?|p|tv)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)}catch{return false}};
const imageHost=(value:string)=>{try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname.endsWith('.cdninstagram.com')||u.hostname.endsWith('.fbcdn.net'))}catch{return false}};
const decode=(s:string)=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
async function download(url:string){
 for(let n=0;n<4;n++){
  if(!imageHost(url))throw new Error('image_host_invalid');
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Accept':'image/*','Referer':'https://www.instagram.com/'}});
  if(response.status>=300&&response.status<400){url=new URL(response.headers.get('location')||'',url).href;continue}
  const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!response.ok||!['image/jpeg','image/png','image/webp','image/avif'].includes(type))throw new Error('image_unavailable');
  if(Number(response.headers.get('content-length'))>5242880)throw new Error('image_too_large');
  const reader=response.body?.getReader();if(!reader)throw new Error('image_empty');const chunks:Uint8Array[]=[];let length=0;
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>5242880){await reader.cancel();throw new Error('image_too_large')}chunks.push(value)}
  if(!length)throw new Error('image_empty');const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}return {bytes,type};
 }throw new Error('image_redirects');
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return new Response(JSON.stringify({message:'Método no permitido.'}),{status:405,headers:cors});
 try{
  const auth=req.headers.get('Authorization')||'';
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth},fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})},auth:{persistSession:false}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return new Response(JSON.stringify({message:'Volvé a iniciar sesión.'}),{status:401,headers:cors});
  const body=await req.json();const batch=body.batch===true;
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  let query=admin.from('recipes').select('id,image_url,recipe_sources(source_url,is_primary)').eq('owner_id',user.id);
  if(batch){
   query=query.not('image_url','like','%/storage/v1/object/public/recipe-thumbnails/%').order('created_at',{ascending:true});
   const excluded=Array.isArray(body.exclude_ids)?body.exclude_ids.filter((x:unknown)=>typeof x==='string'&&uuid.test(x)).slice(0,150):[];
   if(excluded.length)query=query.not('id','in',`(${excluded.join(',')})`);
   query=query.limit(3);
  }else{if(typeof body.recipe_id!=='string'||!uuid.test(body.recipe_id))throw new Error('invalid_recipe');query=query.eq('id',body.recipe_id).limit(1)}
  const {data:recipes,error:readError}=await query;if(readError)throw readError;
  const updates: {id:string,image_url:string}[]=[];const failed:string[]=[];
  for(const recipe of recipes||[]){
   let path='';
   try{
    const sources=(recipe.recipe_sources||[]).sort((a:any,b:any)=>Number(b.is_primary)-Number(a.is_primary));const original=sources.find((s:any)=>instagramPost(s.source_url||''))?.source_url;
    if(!original)throw new Error('source_missing');
    const meta=await client.rpc('fetch_instagram_public_metadata',{p_url:original});
    const fresh=decode(String(meta.data?.image_url_raw||'').trim());if(meta.error||!imageHost(fresh))throw new Error('metadata_unavailable');
    const {bytes,type}=await download(fresh);const ext=type==='image/png'?'png':type==='image/webp'?'webp':type==='image/avif'?'avif':'jpg';path=`${user.id}/${recipe.id}-${crypto.randomUUID()}.${ext}`;
    const uploaded=await admin.storage.from('recipe-thumbnails').upload(path,bytes,{contentType:type,cacheControl:'31536000'});if(uploaded.error)throw uploaded.error;
    const image_url=admin.storage.from('recipe-thumbnails').getPublicUrl(path).data.publicUrl;
    let save=admin.from('recipes').update({image_url}).eq('id',recipe.id).eq('owner_id',user.id);
    save=recipe.image_url===null?save.is('image_url',null):save.eq('image_url',recipe.image_url);
    const saved=await save.select('id').maybeSingle();if(saved.error||!saved.data)throw new Error('photo_changed');
    updates.push({id:recipe.id,image_url});
   }catch{if(path)await admin.storage.from('recipe-thumbnails').remove([path]);failed.push(recipe.id)}
  }
  if(!batch){if(!recipes?.length)return new Response(JSON.stringify({message:'La receta no pertenece a tu cuenta.'}),{status:403,headers:cors});if(!updates.length)return new Response(JSON.stringify({message:'Instagram no permitió recuperar esta imagen. Podés elegir una foto de tu galería.'}),{status:200,headers:cors});return new Response(JSON.stringify({image_url:updates[0].image_url}),{headers:cors})}
  return new Response(JSON.stringify({updates,failed,scanned:recipes?.length||0}),{headers:cors});
 }catch{return new Response(JSON.stringify({message:'No pude recuperar la imagen. Reintentá o elegí una foto de tu galería.'}),{status:400,headers:cors})}
});
