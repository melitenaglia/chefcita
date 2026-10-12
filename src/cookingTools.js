import {formatIngredientDisplay} from './recipeFormat.js';
const fractions={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};
const numberPattern=/^(\d+\s+\d+\/\d+|\d+[½¼¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛⅜⅝⅞])(?=$|\s)/;
const units=/^(?:g|gr\.?|grs\.?|gramos?|kg\.?|kilogramos?|ml\.?|mililitros?|l\.?|litros?|cda\.?|cdas\.?|cucharadas?|cdta\.?|cditas?\.?|cucharaditas?|tazas?|tza\.?|tzas\.?|unidades?|uds?\.?)\b/i;
export function parseAmount(value){
 const s=String(value).trim().replace(',','.');
 if(s in fractions)return fractions[s];
 if(/^\d+[½¼¾⅓⅔⅛⅜⅝⅞]$/.test(s))return Number(s.slice(0,-1))+fractions[s.at(-1)];
 if(/^\d+\s+\d+\/\d+$/.test(s)){const [whole,frac]=s.split(/\s+/);const [a,b]=frac.split('/').map(Number);return b?Number(whole)+a/b:null}
 if(/^\d+\/\d+$/.test(s)){const [a,b]=s.split('/').map(Number);return b?a/b:null}
 return /^\d+(?:\.\d+)?$/.test(s)?Number(s):null;
}
const cleanNumber=n=>Number(n.toFixed(2)).toLocaleString('es-ES',{maximumFractionDigits:2,useGrouping:false});
export function scaleIngredient(item,ratio=1){
 if(!Number.isFinite(ratio)||ratio<=0||Math.abs(ratio-1)<.00001)return {...item,scaled:false};
 const raw=String(item.quantity_text||'').trim();
 if(raw){
  const match=raw.match(numberPattern);if(!match)return {...item,scaled:false};
  const rest=raw.slice(match[0].length).trim();
  if(rest&&!units.test(rest))return {...item,scaled:false};
  const amount=parseAmount(match[0]);if(amount===null)return {...item,scaled:false};
  return {...item,quantity:amount*ratio,quantity_text:cleanNumber(amount*ratio)+(rest?' '+rest:''),scaled:true};
 }
 const amount=Number(item.quantity);
 if(item.quantity===null||item.quantity===undefined||item.quantity===''||!Number.isFinite(amount))return {...item,scaled:false};
 return {...item,quantity:amount*ratio,quantity_text:cleanNumber(amount*ratio),scaled:true};
}
export const ingredientView=(item,ratio)=>formatIngredientDisplay(scaleIngredient(item,ratio));
export const shoppingKey=userId=>`chefcita:shopping:${userId}`;
export function loadShopping(userId){try{const value=JSON.parse(localStorage.getItem(shoppingKey(userId))||'[]');return Array.isArray(value)?value:[]}catch{return []}}
export function saveShopping(userId,rows){localStorage.setItem(shoppingKey(userId),JSON.stringify(rows));window.dispatchEvent(new CustomEvent('chefcita-shopping'))}
export function addRecipeToShopping(userId,recipe,ingredients,ratio=1,portions=null){
 const rows=loadShopping(userId);let count=0;
 for(const item of ingredients){
  const id=`${recipe.id}:${item.id}`;const d=ingredientView(item,ratio);
  const row={id,recipeId:recipe.id,recipeTitle:recipe.title,ingredientId:item.id,name:d.name,quantity:d.quantity,note:d.note,done:false,portions};
  const index=rows.findIndex(x=>x.id===id);
  if(index<0){rows.push(row);count++}else rows[index]={...row,done:rows[index].done};
 }
 saveShopping(userId,rows);return {count,total:rows.length};
}
