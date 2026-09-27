import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Content-Type":"application/json"
};

const MODEL="gpt-5.6-luna";
const INPUT_USD_PER_MTOK=0.20;
const OUTPUT_USD_PER_MTOK=1.20;

const categories=["Desayuno","Almuerzo/Cena","Merienda","Snack","Postre","Bebida","Salsa/Aderezo"];
const mealTypes=["Ensaladas","Pastas","Pizzas","Tartas/Empanadas","Carnes","Pollo","Pescado/Mariscos","Sándwiches/Wraps","Snacks","Arroz/Bowls","Sopas/Cremas","Salsas","Tortillas/Omelettes","Galletas/Bocaditos","Tortas/Budines/Postres","Helados/Batidos","Bebidas"];
const tags=["fácil","rápida","económica","saludable","fresco","liviano","pesado","comfort food","vegetariana","vegana","horno","sartén","air fryer","microondas","meal prep","para compartir","dulce","salado","apto freezer","apto tupper","con pollo","con carne","con pescado","con pasta","con arroz","con verduras","con huevo","con legumbres","con queso"];

const nullableInteger={anyOf:[{type:"integer",minimum:0},{type:"null"}]};
const nullableNumber={anyOf:[{type:"number",minimum:0},{type:"null"}]};

const schema={
  type:"object",
  additionalProperties:false,
  required:["title","description","category","meal_type","level","prep_minutes","cook_minutes","total_minutes","servings","servings_unit","author_handle","storage_notes","freezer_notes","meal_prep_notes","tags","ingredients","steps"],
  properties:{
    title:{type:"string"},
    description:{type:"string"},
    category:{type:"string",enum:["",...categories]},
    meal_type:{type:"string",enum:["",...mealTypes]},
    level:{type:"string",enum:["","initial","intermediate","expert"]},
    prep_minutes:nullableInteger,
    cook_minutes:nullableInteger,
    total_minutes:nullableInteger,
    servings:nullableNumber,
    servings_unit:{type:"string"},
    author_handle:{type:"string"},
    storage_notes:{type:"string"},
    freezer_notes:{type:"string"},
    meal_prep_notes:{type:"string"},
    tags:{type:"array",items:{type:"string",enum:tags}},
    ingredients:{type:"array",items:{
      type:"object",additionalProperties:false,
      required:["name","quantity","quantity_text","unit","note","section","role"],
      properties:{
        name:{type:"string"},quantity:nullableNumber,quantity_text:{type:"string"},
        unit:{type:"string"},note:{type:"string"},section:{type:"string"},role:{type:"string",enum:["main","secondary"]}
      }
    }},
    steps:{type:"array",items:{
      type:"object",additionalProperties:false,
      required:["instruction","duration_minutes","temperature_c","note"],
      properties:{
        instruction:{type:"string"},duration_minutes:nullableInteger,
        temperature_c:nullableNumber,note:{type:"string"}
      }
    }}
  }
};

const quickSchema={
  type:"object",
  additionalProperties:false,
  required:["title","category","meal_type","level","total_minutes","servings","servings_unit","author_handle","tags","ingredients"],
  properties:{
    title:{type:"string"},
    category:{type:"string",enum:["",...categories]},
    meal_type:{type:"string",enum:["",...mealTypes]},
    level:{type:"string",enum:["","initial","intermediate","expert"]},
    total_minutes:nullableInteger,
    servings:nullableNumber,
    servings_unit:{type:"string"},
    author_handle:{type:"string"},
    tags:{type:"array",items:{type:"string",enum:tags}},
    ingredients:{type:"array",items:{
      type:"object",additionalProperties:false,
      required:["name","quantity","quantity_text","unit","note","section"],
      properties:{
        name:{type:"string"},quantity:nullableNumber,quantity_text:{type:"string"},
        unit:{type:"string"},note:{type:"string"},section:{type:"string"}
      }
    }}
  }
};

function decodeHtml(value:string){
  return value
    .replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&#x([0-9a-f]+);/gi,(_m,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&#(\d+);/g,(_m,n)=>String.fromCodePoint(Number(n)));
}

function cleanInstagramDescription(raw:string){
  let cleaned=decodeHtml(String(raw||"")).replace(/\r/g,"").trim();
  const prefixed=
    cleaned.match(/^.*?(?:likes?|me gusta).*?(?:comments?|comentarios?)\s*-\s*[^:]+:\s*["“]([\s\S]*)["”]\.?\s*$/i)
    || cleaned.match(/^[^:]+:\s*["“]([\s\S]*)["”]\.?\s*$/i);
  if(prefixed?.[1]) cleaned=prefixed[1];
  return cleaned.replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n").trim();
}

async function persistThumbnail(supabase:any,userId:string,importId:string,rawUrl:string){
  const source=decodeHtml(String(rawUrl||"")).trim();
  if(!source) return "";
  try{
    const res=await fetch(source,{redirect:"follow",headers:{"Accept":"image/avif,image/webp,image/*,*/*;q=0.8","Referer":"https://www.instagram.com/"}});
    if(!res.ok) return source;
    const contentType=(res.headers.get("content-type")||"image/jpeg").split(";")[0].trim().toLowerCase();
    if(!contentType.startsWith("image/")) return source;
    const bytes=new Uint8Array(await res.arrayBuffer());
    if(!bytes.length||bytes.length>5*1024*1024) return source;
    const ext=contentType.includes("png")?"png":contentType.includes("webp")?"webp":contentType.includes("avif")?"avif":"jpg";
    const path=userId+"/"+importId+"."+ext;
    const {error}=await supabase.storage.from("recipe-thumbnails").upload(path,bytes,{contentType,upsert:true,cacheControl:"31536000"});
    if(error) return source;
    const {data}=supabase.storage.from("recipe-thumbnails").getPublicUrl(path);
    return data?.publicUrl||source;
  }catch(_e){
    return source;
  }
}

function validInstagramUrl(value:string){
  try{
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    if(url.protocol!=="https:") return false;
    if(host!=="instagram.com"&&host!=="www.instagram.com") return false;
    return /^\/(reel|reels|p|tv)\//i.test(url.pathname);
  }catch{return false}
}

function assessContent(raw:string){
  const text=decodeHtml(raw).trim();
  const lower=text.toLowerCase();
  let score=0;
  const reasons:string[]=[];

  if(/\b(ingredientes?|ingredients?)\b/i.test(text)){score+=3;reasons.push("lista de ingredientes")}
  if(/\b(preparaci[oó]n|procedimiento|instructions?|directions?|method)\b/i.test(text)){score+=2;reasons.push("instrucciones")}
  const unitMatches=lower.match(/\b\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|cl|dl|l|oz|lb|tsp|tbsp|cucharad(?:a|as|ita|itas)?|cdas?|cdtas?|cups?|tazas?)\b/g)||[];
  if(unitMatches.length>=2){score+=2;reasons.push("cantidades")}
  else if(unitMatches.length===1){score+=1}
  const actionMatches=lower.match(/\b(añad(?:e|ir)|agreg(?:a|ar)|mezcl(?:a|ar)|cocin(?:a|ar)|horne(?:a|ar)|cort(?:a|ar)|bat(?:e|ir)|calent(?:a|ar)|serv(?:ir|í)|add|mix|cook|bake|chop|stir|blend|heat|serve)\b/g)||[];
  if(new Set(actionMatches).size>=2){score+=1;reasons.push("pasos de cocina")}
  const meaningfulLines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  if(meaningfulLines.length>=5) score+=1;
  if(text.length>=350) score+=1;

  const bait=/comment\s+[“"'‘’]?recipe|coment(?:a|á)\s+[“"'‘’]?receta|send you the full recipe|te (?:mando|envío|envio) la receta|full recipe (?:in|via) (?:dm|message)/i.test(text);
  if(bait){score-=4;reasons.push("la receta completa parece estar fuera del caption")}

  return {text,score,quality:score>=4?"good":"limited",reasons};
}

function responseText(data:any){
  for(const item of data?.output||[]){
    if(item?.type!=="message") continue;
    for(const part of item?.content||[]){
      if(part?.type==="output_text"&&typeof part.text==="string") return part.text;
    }
  }
  return "";
}

function minimalResult(hints:any){
  const selectedTags=Array.isArray(hints?.tags)?hints.tags.filter((x:any)=>tags.includes(x)):[];
  return {
    title:typeof hints?.title==="string"?hints.title.trim():"",
    description:"",
    category:"",
    meal_type:"",
    level:"",
    prep_minutes:null,
    cook_minutes:null,
    total_minutes:null,
    servings:null,
    servings_unit:"",
    author_handle:"",
    storage_notes:"",
    freezer_notes:"",
    meal_prep_notes:"",
    tags:selectedTags,
    ingredients:[],
    steps:[]
  };
}

function mergeHints(result:any,hints:any){
  const merged={...result};
  if(typeof hints?.title==="string"&&hints.title.trim()) merged.title=hints.title.trim();
  const userTags=Array.isArray(hints?.tags)?hints.tags.filter((x:any)=>tags.includes(x)):[];
  merged.tags=[...new Set([...(Array.isArray(result?.tags)?result.tags:[]),...userTags])].filter(x=>tags.includes(x));
  return merged;
}

async function logAi(supabase:any,importId:string,success:boolean,inputTokens:number|null,outputTokens:number|null,errorMessage:string|null){
  const estimated=(inputTokens!=null&&outputTokens!=null)
    ? (inputTokens*INPUT_USD_PER_MTOK/1_000_000)+(outputTokens*OUTPUT_USD_PER_MTOK/1_000_000)
    : null;
  await supabase.from("ai_processing_logs").insert({
    import_id:importId,model:MODEL,input_tokens:inputTokens,output_tokens:outputTokens,
    estimated_cost_usd:estimated,success,error_message:errorMessage
  });
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const auth=req.headers.get("Authorization")||"";
    const token=auth.replace("Bearer ","");
    const supabase=createClient(
      Deno.env.get("SUPABASE_URL")||"",
      Deno.env.get("SUPABASE_ANON_KEY")||"",
      {global:{headers:{Authorization:auth}}}
    );

    const {data:{user},error:userError}=await supabase.auth.getUser(token);
    if(userError||!user) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:cors});

    const body=await req.json();
    const importId=body?.import_id;
    const forceAi=body?.force_ai===true;
    if(!importId) return new Response(JSON.stringify({error:"Missing import_id"}),{status:400,headers:cors});

    const {data:item,error:itemError}=await supabase.from("imports").select("*")
      .eq("id",importId).eq("user_id",user.id).single();
    if(itemError||!item) return new Response(JSON.stringify({error:"Import not found"}),{status:404,headers:cors});
    if(item.recipe_id) return new Response(JSON.stringify({status:"processed",recipe_id:item.recipe_id}),{headers:cors});

    const hints=item.user_hints||{};

    if(item.processing_mode==="manual"){
      const {data:recipeId,error:finalizeError}=await supabase.rpc("finalize_import",{
        p_import_id:importId,
        p_result:minimalResult(hints)
      });
      if(finalizeError) throw finalizeError;
      await supabase.from("imports").update({
        content_quality:"unknown",
        content_score:0,
        input_message:"Guardada sin usar IA. Completala en Por validar.",
        updated_at:new Date().toISOString()
      }).eq("id",importId);
      return new Response(JSON.stringify({status:"processed_without_ai",recipe_id:recipeId}),{headers:cors});
    }

    await supabase.from("imports").update({
      status:"processing",error_message:null,needs_input:false
    }).eq("id",importId);

    let extracted=(item.pasted_content||item.extracted_content||"").trim();

    // First try from PostgreSQL's HTTP egress. Instagram currently exposes public
    // OG metadata there even when the Edge Function egress gets a login shell.
    if(!extracted&&item.source_url&&validInstagramUrl(item.source_url)){
      try{
        const {data:pgMeta,error:pgMetaError}=await supabase.rpc("fetch_instagram_public_metadata",{p_url:item.source_url});
        if(!pgMetaError&&pgMeta){
          const pgCaption=cleanInstagramDescription(pgMeta.caption_raw||"");
          const pgImageRaw=decodeHtml(String(pgMeta.image_url_raw||"")).trim();
          const pgImage=pgImageRaw?await persistThumbnail(supabase,user.id,importId,pgImageRaw):"";
          const pgAuthor=String(pgMeta.author_handle||"").trim();

          if(pgImage||pgAuthor){
            await supabase.from("imports").update({
              source_image_url:pgImage||item.source_image_url||null,
              source_author_handle:pgAuthor||item.source_author_handle||null,
              updated_at:new Date().toISOString()
            }).eq("id",importId);
          }

          if(pgCaption){
            extracted=pgCaption;
            await supabase.from("imports").update({
              extraction_debug:{
                extractor:"postgres-http-og",
                attempted_at:new Date().toISOString(),
                status:pgMeta.status||null,
                html_length:pgMeta.html_length||null,
                caption_length:pgCaption.length,
                has_image:Boolean(pgImage),
                has_author:Boolean(pgAuthor),
                extracted:true
              },
              updated_at:new Date().toISOString()
            }).eq("id",importId);
          }
        }
      }catch(_e){}
    }

    if(!extracted&&item.source_url){
      if(!validInstagramUrl(item.source_url)){
        await supabase.from("imports").update({
          status:"failed",
          error_message:"El enlace no es un Reel o post válido de Instagram.",
          updated_at:new Date().toISOString()
        }).eq("id",importId);
        return new Response(JSON.stringify({error:"Invalid Instagram URL"}),{status:400,headers:cors});
      }

      try{
        const originalUrl=new URL(item.source_url);
        const cleanPath=originalUrl.pathname.replace(/^\/reels\//i,"/reel/");
        const cleanUrl=originalUrl.origin+cleanPath;
        const attempts=[
          cleanUrl,
          item.source_url,
          cleanUrl.replace(/\/$/,"")+"/embed/captioned/",
          cleanUrl.replace(/\/$/,"")+"/embed/"
        ].filter((value,index,self)=>self.indexOf(value)===index);

        const headers={
          "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept-Language":"es-ES,es;q=0.9,en;q=0.8",
          "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Referer":"https://www.instagram.com/"
        };

        const isLoginBoilerplate=(value:string)=>{
          const lower=value.toLowerCase();
          return lower.includes("crea una cuenta o inicia sesión en instagram")
            || lower.includes("log in to instagram")
            || lower.includes("sign up to instagram");
        };

        const attemptDebug:any[]=[];
        for(const fetchUrl of attempts){
          const res=await fetch(fetchUrl,{redirect:"follow",headers});
          const attempt:any={url:fetchUrl,status:res.status,ok:res.ok,final_url:res.url||fetchUrl};
          if(!res.ok){attemptDebug.push(attempt);continue}
          const html=await res.text();
          attempt.html_length=html.length;

          const readMeta=(name:string)=>{
            const patterns=[
              new RegExp('<meta[^>]+(?:property|name)=["\\\']'+name+'["\\\'][^>]+content=["\\\']([^"\\\']*)["\\\']','i'),
              new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+(?:property|name)=["\\\']'+name+'["\\\']','i')
            ];
            for(const pattern of patterns){
              const match=html.match(pattern);
              if(match?.[1]) return decodeHtml(match[1]).trim();
            }
            return "";
          };

          let rawDescription=readMeta("og:description")||readMeta("twitter:description")||readMeta("description");
          const imageUrl=readMeta("og:image")||readMeta("twitter:image");
          const usernameMatch=html.match(/"username"\s*:\s*"([^"]+)"/i);
          const sourceAuthor=usernameMatch?.[1]?"@"+usernameMatch[1]:"";

          if(imageUrl||sourceAuthor){
            const durableImage=imageUrl?await persistThumbnail(supabase,user.id,importId,imageUrl):"";
            await supabase.from("imports").update({
              source_image_url:durableImage||item.source_image_url||null,
              source_author_handle:sourceAuthor||item.source_author_handle||null,
              updated_at:new Date().toISOString()
            }).eq("id",importId);
          }

          attempt.has_meta_description=Boolean(rawDescription);
          attempt.has_image=Boolean(imageUrl);
          attempt.has_username=Boolean(sourceAuthor);

          if(rawDescription){
            let cleaned=cleanInstagramDescription(rawDescription);
            attempt.meta_length=cleaned.length;
            attempt.meta_boilerplate=isLoginBoilerplate(cleaned);
            if(cleaned&&!isLoginBoilerplate(cleaned)){
              extracted=cleaned;
              attempt.extracted_from="meta";
              attemptDebug.push(attempt);
              break;
            }
          }

          const captionMatch=
            html.match(/"caption"\s*:\s*\{[^{}]*"text"\s*:\s*"((?:\\.|[^"\\])*)"/i)||
            html.match(/"edge_media_to_caption"\s*:\s*\{[\s\S]{0,8000}?"text"\s*:\s*"((?:\\.|[^"\\])*)"/i);

          attempt.has_json_caption=Boolean(captionMatch?.[1]);
          if(captionMatch?.[1]){
            try{
              const candidate=JSON.parse('"'+captionMatch[1]+'"');
              attempt.json_caption_length=String(candidate||"").length;
              attempt.json_caption_boilerplate=isLoginBoilerplate(String(candidate||""));
              if(candidate&&!isLoginBoilerplate(candidate)){
                extracted=String(candidate).trim();
                attempt.extracted_from="json";
                attemptDebug.push(attempt);
                break;
              }
            }catch(_e){}
          }
          attemptDebug.push(attempt);
        }

        await supabase.from("imports").update({
          extraction_debug:{
            extractor:"instagram-multi-source-v4",
            attempted_at:new Date().toISOString(),
            attempts:attemptDebug,
            extracted:Boolean(extracted)
          },
          updated_at:new Date().toISOString()
        }).eq("id",importId);
      }catch(error){
        await supabase.from("imports").update({
          extraction_debug:{
            extractor:"instagram-multi-source-v4",
            attempted_at:new Date().toISOString(),
            error:error instanceof Error?error.message:"unknown extraction error",
            extracted:false
          },
          updated_at:new Date().toISOString()
        }).eq("id",importId);
      }
    }

    if(!extracted){
      await supabase.from("imports").update({
        status:"queued",needs_input:true,content_quality:"unknown",content_score:0,
        extracted_content:null,
        input_message:"Instagram no me entregó el caption, aunque pueda verse en la app. No usé IA. Copiá el texto de la publicación y pegalo acá para seguir.",
        updated_at:new Date().toISOString()
      }).eq("id",importId);
      return new Response(JSON.stringify({status:"needs_input",ai_used:false}),{headers:cors});
    }

    const assessment=assessContent(extracted);
    await supabase.from("imports").update({
      extracted_content:assessment.text,
      content_quality:assessment.quality,
      content_score:assessment.score,
      updated_at:new Date().toISOString()
    }).eq("id",importId);

    if(!forceAi&&item.processing_mode!=="force"&&assessment.quality==="limited"){
      const message=assessment.reasons.includes("la receta completa parece estar fuera del caption")
        ?"El caption parece promocionar una receta que está fuera de Instagram. No usé IA para no gastar tokens. Podés pegar la receta completa, guardarla para completar o procesar igual."
        :"No parece haber suficiente receta en el caption. No usé IA. Podés pegar más texto, guardarla para completar o procesar igual.";
      await supabase.from("imports").update({
        status:"queued",needs_input:false,input_message:message,updated_at:new Date().toISOString()
      }).eq("id",importId);
      return new Response(JSON.stringify({
        status:"needs_choice",ai_used:false,content_quality:"limited",content_score:assessment.score
      }),{headers:cors});
    }

    const apiKey=Deno.env.get("OPENAI_API_KEY");
    if(!apiKey){
      await supabase.from("imports").update({
        status:"queued",needs_input:false,
        input_message:"Contenido listo para IA, pero falta configurar OPENAI_API_KEY.",
        updated_at:new Date().toISOString()
      }).eq("id",importId);
      return new Response(JSON.stringify({status:"ready_for_ai",missing_secret:"OPENAI_API_KEY"}),{status:503,headers:cors});
    }

    const quickMode=item.ai_scope!=="full";
    const outputSchema=quickMode?quickSchema:schema;

    const hintParts=[];
    if(hints?.title) hintParts.push("Título indicado por la usuaria: "+String(hints.title));
    if(Array.isArray(hints?.tags)&&hints.tags.length) hintParts.push("Etiquetas elegidas por la usuaria: "+hints.tags.join(", "));
    const hintText=hintParts.join("\n");

    const instructions=quickMode?[
      "Sos el agente de biblioteca personal de recetas de Chefcita.",
      "Esta importación es FICHA RÁPIDA: priorizá título, ingredientes y clasificación.",
      "La fuente puede estar en cualquier idioma, pero TODOS los campos estructurados deben quedar en español natural.",
      "El copy original se guarda aparte y NO debés reescribirlo ni traducirlo dentro de estos campos.",
      "Extraé únicamente información presente en la fuente.",
      "- No inventes ingredientes, cantidades ni datos.",
      "- Traducí el título a un nombre corto, claro y útil en español. Evitá títulos marketineros.",
      "- Traducí los nombres de ingredientes, notas y secciones al español.",
      "- Usá nombres canónicos únicos de Chefcita: patata/potato/papa → papa; aguacate/avocado/palta → palta; calabacín/zucchini → zucchini; choclo/corn/elote → maíz; boniato/sweet potato/batata → batata; nata/heavy cream/crema de leche → crema de leche; ciboulette/cebollín/cebollino/scallion → cebolla de verdeo; mozzarella → queso mozzarella; parmesano/parmesan → queso parmesano. No uses nombres dobles como papa/patata, palta/aguacate o maíz/choclo. También: chicken/pechuga/muslo → pollo; ground beef/carne molida → carne picada; cream cheese/Philadelphia → queso crema; cherry tomatoes → tomate cherry; wraps/tortillas de trigo → tortillas/wraps.",
      "- Conservá números y cantidades reales. En quantity_text podés traducir palabras de unidad de forma inequívoca, sin alterar el valor.",
      "- Para cada ingrediente, separá SIEMPRE cantidad y unidad cuando la fuente lo permita: quantity_text contiene la expresión de cantidad y unit contiene la unidad.",
      "- Ejemplos: 120 g de harina → quantity=120, quantity_text=120, unit=g; 4 huevos → quantity=4, quantity_text=4, unit=unidad; 1/3 taza → quantity≈0.333333, quantity_text=1/3, unit=taza.",
      "- Si hay una cantidad contable explícita, por ejemplo 2 huevos, 4 tomates o 6 tortillas, usá unit=unidad aunque la fuente no escriba literalmente la palabra unidad. No dejes unit vacío en esos casos.",
      "- No repitas la unidad dentro de quantity_text cuando ya esté en unit. Conservá expresiones especiales como a gusto, una pizca o rangos cuando no puedan separarse sin perder significado.",
      "- Marcá cada ingrediente con role=main si define la receta o sirve para decidir qué cocinar; role=secondary para condimentos, hierbas, salsas, toppings o ingredientes de apoyo.",
      "- Si hay tiempo total o porciones explícitas, extraelos. Si no, devolvé null o vacío. No los inventes.",
      "- author_handle solo si aparece explícitamente en la fuente.",
      "- Clasificá category, meal_type, level y tags usando solo las listas permitidas.",
      "- Si el nombre del plato es evidente, usalo como title; si no, dejalo vacío.",
      "- Cualquier título o etiqueta indicada por la usuaria tiene prioridad.",
      "No transcribas ni resumas pasos: la usuaria abrirá el video para cocinar.",
      "Respondé solo con el JSON del esquema."
    ].join("\n"):[
      "Sos el agente de biblioteca personal de recetas de Chefcita.",
      "Convertí únicamente la información presente en la fuente en una receta estructurada.",
      "La fuente puede estar en cualquier idioma, pero TODOS los campos estructurados deben quedar en español natural.",
      "El copy original se guarda aparte y debe conservarse textual; no lo reemplaces con una traducción.",
      "Reglas obligatorias:",
      "- No inventes ingredientes, cantidades, pasos, tiempos, temperaturas, porciones, autor ni notas.",
      "- Si un dato no aparece, devolvé cadena vacía o null según el esquema.",
      "- Traducí y normalizá título, descripción, ingredientes, notas y pasos al español.",
      "- Marcá cada ingrediente con role=main si define la receta o sirve para decidir qué cocinar; role=secondary para condimentos, hierbas, salsas, toppings o ingredientes de apoyo.",
      "- Usá nombres canónicos únicos de Chefcita: patata/potato/papa → papa; aguacate/avocado/palta → palta; calabacín/zucchini → zucchini; choclo/corn/elote → maíz; boniato/sweet potato/batata → batata; nata/heavy cream/crema de leche → crema de leche; ciboulette/cebollín/cebollino/scallion → cebolla de verdeo; mozzarella → queso mozzarella; parmesano/parmesan → queso parmesano. No uses nombres dobles como papa/patata, palta/aguacate o maíz/choclo. También: chicken → pollo; ground beef → carne picada; cream cheese/Philadelphia → queso crema; cherry tomatoes → tomate cherry; wraps/tortillas de trigo → tortillas/wraps.",
      "- Podés clasificar categoría, tipo de comida, nivel y tags usando únicamente las listas permitidas.",
      "- Conservá los valores numéricos y cantidades reales; quantity numérico solo cuando sea inequívoco.",
      "- Para cada ingrediente, separá SIEMPRE cantidad y unidad cuando la fuente lo permita: quantity_text contiene la expresión de cantidad y unit contiene la unidad.",
      "- Ejemplos: 120 g de harina → quantity=120, quantity_text=120, unit=g; 4 huevos → quantity=4, quantity_text=4, unit=unidad; 1/3 taza → quantity≈0.333333, quantity_text=1/3, unit=taza.",
      "- Si hay una cantidad contable explícita, por ejemplo 2 huevos, 4 tomates o 6 tortillas, usá unit=unidad aunque la fuente no escriba literalmente la palabra unidad. No dejes unit vacío en esos casos.",
      "- No repitas la unidad dentro de quantity_text cuando ya esté en unit. Conservá expresiones especiales como a gusto, una pizca o rangos cuando no puedan separarse sin perder significado.",
      "- Los tiempos solo pueden salir si están explícitos o son una suma directa de tiempos explícitos.",
      "- Los pasos pueden limpiarse y traducirse para claridad pero no agregar acciones no presentes.",
      "- author_handle solo si aparece explícitamente en el contenido.",
      "- La descripción debe resumir solo lo que sí dice la fuente.",
      "- Si el nombre del plato es evidente, usalo como título corto y útil en español. Si no lo es, dejá title vacío.",
      "- Cualquier título o etiqueta indicada explícitamente por la usuaria tiene prioridad.",
      "Respondé solo con el JSON del esquema."
    ].join("\n");

    const userText=(hintText?hintText+"\n\n":"")+"FUENTE ORIGINAL:\n"+assessment.text.slice(0,30000);

    const openaiResponse=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:MODEL,
        store:false,
        input:[
          {role:"developer",content:[{type:"input_text",text:instructions}]},
          {role:"user",content:[{type:"input_text",text:userText}]}
        ],
        text:{format:{type:"json_schema",name:quickMode?"chefcita_recipe_quick":"chefcita_recipe",strict:true,schema:outputSchema}}
      })
    });

    const openaiData=await openaiResponse.json();
    const inputTokens=openaiData?.usage?.input_tokens??null;
    const outputTokens=openaiData?.usage?.output_tokens??null;

    if(!openaiResponse.ok){
      const msg=openaiData?.error?.message||"OpenAI request failed";
      await logAi(supabase,importId,false,inputTokens,outputTokens,msg);
      await supabase.from("imports").update({
        status:"failed",error_message:msg,input_message:null,updated_at:new Date().toISOString()
      }).eq("id",importId);
      return new Response(JSON.stringify({error:msg}),{status:502,headers:cors});
    }

    const output=responseText(openaiData);
    if(!output){
      const msg="OpenAI returned no structured text";
      await logAi(supabase,importId,false,inputTokens,outputTokens,msg);
      await supabase.from("imports").update({
        status:"failed",error_message:msg,updated_at:new Date().toISOString()
      }).eq("id",importId);
      return new Response(JSON.stringify({error:msg}),{status:502,headers:cors});
    }

    let structured;
    try{structured=mergeHints(JSON.parse(output),hints)}
    catch{
      const msg="OpenAI returned invalid JSON";
      await logAi(supabase,importId,false,inputTokens,outputTokens,msg);
      await supabase.from("imports").update({
        status:"failed",error_message:msg,updated_at:new Date().toISOString()
      }).eq("id",importId);
      return new Response(JSON.stringify({error:msg}),{status:502,headers:cors});
    }

    const {data:recipeId,error:finalizeError}=await supabase.rpc("finalize_import",{
      p_import_id:importId,p_result:structured
    });

    if(finalizeError){
      await logAi(supabase,importId,false,inputTokens,outputTokens,finalizeError.message);
      await supabase.from("imports").update({
        status:"failed",ai_result:structured,error_message:finalizeError.message,
        updated_at:new Date().toISOString()
      }).eq("id",importId);
      return new Response(JSON.stringify({error:finalizeError.message}),{status:500,headers:cors});
    }

    await logAi(supabase,importId,true,inputTokens,outputTokens,null);
    return new Response(JSON.stringify({
      status:"processed",recipe_id:recipeId,ai_used:true,
      usage:{input_tokens:inputTokens,output_tokens:outputTokens}
    }),{headers:cors});

  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:"Unexpected error"}),{status:400,headers:cors});
  }
});