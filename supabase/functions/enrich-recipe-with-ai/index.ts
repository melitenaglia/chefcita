import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Content-Type":"application/json"
};

const MODEL="gpt-5.6-luna";
const categories=["Desayuno","Almuerzo/Cena","Merienda","Snack","Postre","Bebida","Salsa/Aderezo"];
const mealTypes=["Ensaladas","Pastas","Pizzas","Tartas/Empanadas","Carnes","Pollo","Pescado/Mariscos","Sándwiches/Wraps","Snacks","Arroz/Bowls","Sopas/Cremas","Salsas","Tortillas/Omelettes","Galletas/Bocaditos","Tortas/Budines/Postres","Helados/Batidos","Bebidas"];
const tags=["fácil","rápida","económica","saludable","fresco","liviano","pesado","comfort food","vegetariana","vegana","horno","sartén","air fryer","microondas","meal prep","para compartir","dulce","salado","apto freezer","apto tupper","con pollo","con carne","con pescado","con pasta","con arroz","con verduras","con huevo","con legumbres","con queso"];

const nullableInteger={anyOf:[{type:"integer",minimum:0},{type:"null"}]};
const nullableNumber={anyOf:[{type:"number",minimum:0},{type:"null"}]};

const schema={
  type:"object",
  additionalProperties:false,
  required:["title","description","category","meal_type","level","prep_minutes","cook_minutes","total_minutes","servings","servings_unit","storage_notes","freezer_notes","meal_prep_notes","tags","ingredients","steps"],
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
    storage_notes:{type:"string"},
    freezer_notes:{type:"string"},
    meal_prep_notes:{type:"string"},
    tags:{type:"array",items:{type:"string",enum:tags}},
    ingredients:{type:"array",items:{
      type:"object",additionalProperties:false,
      required:["name","quantity","quantity_text","unit","note","section","role"],
      properties:{
        name:{type:"string"},quantity:nullableNumber,quantity_text:{type:"string"},
        unit:{type:"string"},note:{type:"string"},section:{type:"string"},
        role:{type:"string",enum:["main","secondary"]}
      }
    }},
    steps:{type:"array",items:{
      type:"object",additionalProperties:false,
      required:["instruction","duration_minutes","temperature_c","note"],
      properties:{
        instruction:{type:"string"},
        duration_minutes:nullableInteger,
        temperature_c:nullableNumber,
        note:{type:"string"}
      }
    }}
  }
};

function responseText(data:any){
  for(const item of data?.output||[]){
    if(item?.type!=="message") continue;
    for(const part of item?.content||[]){
      if(part?.type==="output_text"&&typeof part.text==="string") return part.text;
    }
  }
  return "";
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
    const recipeId=String(body?.recipe_id||"");
    const extraText=String(body?.supplemental_text||"").trim();

    if(!recipeId) return new Response(JSON.stringify({error:"Missing recipe_id"}),{status:400,headers:cors});
    if(extraText.length<3) return new Response(JSON.stringify({error:"Pegá información adicional antes de procesar."}),{status:400,headers:cors});
    if(extraText.length>30000) return new Response(JSON.stringify({error:"El texto adicional es demasiado largo."}),{status:400,headers:cors});

    const {data:recipe,error:recipeError}=await supabase.from("recipes")
      .select("*,categories(name),meal_types(name),recipe_ingredients(*),recipe_steps(*),recipe_tags(tags(name)),recipe_sources(id,source_url,original_copy,supplemental_copy,author_handle,is_primary)")
      .eq("id",recipeId)
      .eq("owner_id",user.id)
      .single();

    if(recipeError||!recipe) return new Response(JSON.stringify({error:"Recipe not found"}),{status:404,headers:cors});

    const source=recipe.recipe_sources?.find((x:any)=>x.is_primary)||recipe.recipe_sources?.[0]||null;
    const current={
      title:recipe.title||"",
      description:recipe.description||"",
      category:recipe.categories?.name||"",
      meal_type:recipe.meal_types?.name||"",
      level:recipe.level||"",
      prep_minutes:recipe.prep_minutes??null,
      cook_minutes:recipe.cook_minutes??null,
      total_minutes:recipe.total_minutes??null,
      servings:recipe.servings??null,
      servings_unit:recipe.servings_unit||"",
      storage_notes:recipe.storage_notes||"",
      freezer_notes:recipe.freezer_notes||"",
      meal_prep_notes:recipe.meal_prep_notes||"",
      tags:(recipe.recipe_tags||[]).map((x:any)=>x.tags?.name).filter(Boolean),
      ingredients:[...(recipe.recipe_ingredients||[])].sort((a:any,b:any)=>a.sort_order-b.sort_order).map((x:any)=>({
        name:x.original_name||"",
        quantity:x.quantity??null,
        quantity_text:x.quantity_text||"",
        unit:x.unit||"",
        note:x.note||"",
        section:x.section||"",
        role:x.role==="secondary"?"secondary":"main"
      })),
      steps:[...(recipe.recipe_steps||[])].sort((a:any,b:any)=>a.step_number-b.step_number).map((x:any)=>({
        instruction:x.instruction||"",
        duration_minutes:x.duration_minutes??null,
        temperature_c:x.temperature_c??null,
        note:x.note||""
      }))
    };

    const originalCopy=source?.original_copy||"";
    const previousSupplemental=source?.supplemental_copy||"";

    const instructions=[
      "Sos el agente de enriquecimiento de recetas de Chefcita.",
      "La receta ya existe y puede estar parcialmente estructurada. La usuaria acaba de aportar información adicional, por ejemplo el texto del primer comentario con la receta completa.",
      "Tu tarea es devolver una versión COMPLETA y ACTUALIZADA de la ficha, combinando la ficha actual, el copy original y la información adicional.",
      "Reglas obligatorias:",
      "- No inventes ingredientes, cantidades, pasos, tiempos, temperaturas, porciones ni notas.",
      "- La INFORMACIÓN ADICIONAL pegada por la usuaria tiene prioridad cuando completa o contradice una ficha parcial.",
      "- Conservá cualquier dato actual que siga siendo válido y no esté contradicho.",
      "- No borres información válida solo porque no aparezca repetida en el texto adicional.",
      "- Traducí y normalizá todos los campos estructurados al español natural.",
      "- Usá nombres canónicos únicos de Chefcita: patata/potato/papa → papa; aguacate/avocado/palta → palta; calabacín/zucchini → zucchini; choclo/corn/elote → maíz; boniato/sweet potato/batata → batata; nata/heavy cream/crema de leche → crema de leche; ciboulette/cebollín/cebollino/scallion → cebolla de verdeo; mozzarella → queso mozzarella; parmesano/parmesan → queso parmesano. No uses nombres dobles como papa/patata, palta/aguacate o maíz/choclo.",
      "- Conservá números y cantidades reales; quantity numérico solo cuando sea inequívoco.",
      "- Para cada ingrediente, separá SIEMPRE cantidad y unidad cuando la fuente lo permita: quantity_text contiene la expresión de cantidad y unit contiene la unidad.",
      "- Ejemplos: 120 g de harina → quantity=120, quantity_text=120, unit=g; 4 huevos → quantity=4, quantity_text=4, unit=unidad; 1/3 taza → quantity≈0.333333, quantity_text=1/3, unit=taza.",
      "- Si hay una cantidad contable explícita, por ejemplo 2 huevos, 4 tomates o 6 tortillas, usá unit=unidad aunque la fuente no escriba literalmente la palabra unidad. No dejes unit vacío en esos casos.",
      "- No repitas la unidad dentro de quantity_text cuando ya esté en unit. Conservá expresiones especiales como a gusto, una pizca o rangos cuando no puedan separarse sin perder significado.",
      "- role=main para ingredientes que definen la receta; role=secondary para condimentos, hierbas, salsas, toppings o apoyo.",
      "- Clasificá category, meal_type, level y tags usando únicamente las listas permitidas.",
      "- Los tiempos solo pueden usarse si están explícitos o son suma directa de tiempos explícitos.",
      "- Si la información adicional contiene la receta completa que faltaba, incorporá esos ingredientes y pasos.",
      "- No incluyas marketing, pedidos de comentar, hashtags ni llamadas a seguir cuentas.",
      "Respondé solo con el JSON del esquema."
    ].join("\n");

    const userText=[
      "FICHA ACTUAL:",
      JSON.stringify(current),
      "",
      "COPY ORIGINAL:",
      originalCopy||"(vacío)",
      "",
      previousSupplemental?"INFORMACIÓN ADICIONAL GUARDADA ANTERIORMENTE:\n"+previousSupplemental+"\n":"",
      "NUEVA INFORMACIÓN ADICIONAL A INCORPORAR:",
      extraText
    ].join("\n");

    const apiKey=Deno.env.get("OPENAI_API_KEY");
    if(!apiKey) return new Response(JSON.stringify({error:"OPENAI_API_KEY not configured"}),{status:503,headers:cors});

    const openaiResponse=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:MODEL,
        store:false,
        input:[
          {role:"developer",content:[{type:"input_text",text:instructions}]},
          {role:"user",content:[{type:"input_text",text:userText.slice(0,60000)}]}
        ],
        text:{format:{type:"json_schema",name:"chefcita_recipe_enrichment",strict:true,schema}}
      })
    });

    const openaiData=await openaiResponse.json();
    if(!openaiResponse.ok){
      const msg=openaiData?.error?.message||"OpenAI request failed";
      return new Response(JSON.stringify({error:msg}),{status:502,headers:cors});
    }

    const output=responseText(openaiData);
    if(!output) return new Response(JSON.stringify({error:"OpenAI returned no structured text"}),{status:502,headers:cors});

    let structured;
    try{structured=JSON.parse(output)}
    catch{return new Response(JSON.stringify({error:"OpenAI returned invalid JSON"}),{status:502,headers:cors})}

    return new Response(JSON.stringify({
      structured,
      usage:{
        input_tokens:openaiData?.usage?.input_tokens??null,
        output_tokens:openaiData?.usage?.output_tokens??null
      }
    }),{headers:cors});
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:"Unexpected error"}),{status:400,headers:cors});
  }
});