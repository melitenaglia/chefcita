import {supabase} from './supabase.js';
import {loadShopping,saveShopping,ingredientView} from './cookingTools.js';
export const productKey=name=>String(name).trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
export const destinationKey=user=>`chefcita:shopping:destination:${user}`;
export const getDestination=user=>{try{return localStorage.getItem(destinationKey(user))||''}catch{return ''}};
export const setDestination=(user,id)=>localStorage.setItem(destinationKey(user),id);
const preferencesKey=user=>`chefcita:shopping:preferences:${user}`;
export const localStores=user=>{try{return JSON.parse(localStorage.getItem(`chefcita:shopping:stores:${user}`)||'[]')}catch{return []}};
export const localPreferences=user=>{try{return JSON.parse(localStorage.getItem(preferencesKey(user))||'{}')}catch{return {}}};
export function saveLocalStore(user,name){const rows=localStores(user);let row=rows.find(s=>productKey(s.name)===productKey(name));if(!row){row={id:crypto.randomUUID(),name:name.trim()};rows.push(row);localStorage.setItem(`chefcita:shopping:stores:${user}`,JSON.stringify(rows))}return row}
export function rememberLocalStore(user,name,id){const prefs=localPreferences(user);prefs[productKey(name)]=id||null;localStorage.setItem(preferencesKey(user),JSON.stringify(prefs))}
export const enrichItems=rows=>rows.map(row=>({...row,productKey:productKey(row.name)}));
export async function addToHouse(house,rows){const {data,error}=await supabase.rpc('add_household_shopping_items',{p_household:house,p_items:enrichItems(rows)});if(error)throw error;return data}
export async function addRecipeToDestination(user,recipe,ingredients,ratio,portions){
 // Build using the existing formatter, without changing the stored recipe.
 const rows=ingredients.map(item=>{const d=ingredientView(item,ratio);return {id:`${recipe.id}:${item.id}`,recipeId:recipe.id,recipeTitle:recipe.title,name:d.name,quantity:d.quantity,note:d.note,portions,done:false}});
 const house=getDestination(user);
 if(house){await addToHouse(house,rows);return 'Ingredientes añadidos a la lista de casa.'}
 const current=loadShopping(user),prefs=localPreferences(user);let added=0;
 for(const row of rows){const index=current.findIndex(r=>r.id===row.id);if(index<0){current.push({...row,storeId:prefs[productKey(row.name)]||null});added++}else current[index]={...row,storeId:current[index].storeId,done:current[index].done}}
 saveShopping(user,current);return added?'Ingredientes añadidos a tu lista de compra.':'Lista de compra actualizada.';
}
export const mapShared=row=>({id:row.id,key:row.item_key,recipeId:row.recipe_id,recipeTitle:row.recipe_title,name:row.name,quantity:row.quantity,note:row.note,portions:row.portions,done:row.done,storeId:row.store_id,addedBy:row.added_by});
