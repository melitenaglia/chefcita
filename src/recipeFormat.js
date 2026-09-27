const UNIT_LABELS={
 g:{one:'gr.',many:'grs.'},gr:{one:'gr.',many:'grs.'},grs:{one:'gr.',many:'grs.'},gramo:{one:'gr.',many:'grs.'},gramos:{one:'gr.',many:'grs.'},
 kg:{one:'kg.',many:'kgs.'},kgs:{one:'kg.',many:'kgs.'},kilo:{one:'kg.',many:'kgs.'},kilos:{one:'kg.',many:'kgs.'},kilogramo:{one:'kg.',many:'kgs.'},kilogramos:{one:'kg.',many:'kgs.'},
 unidad:{one:'ud.',many:'uds.'},unidades:{one:'ud.',many:'uds.'},ud:{one:'ud.',many:'uds.'},uds:{one:'ud.',many:'uds.'},
 ml:{one:'ml.',many:'ml.'},mililitro:{one:'ml.',many:'ml.'},mililitros:{one:'ml.',many:'ml.'},
 l:{one:'l.',many:'l.'},lt:{one:'l.',many:'l.'},lts:{one:'l.',many:'l.'},litro:{one:'l.',many:'l.'},litros:{one:'l.',many:'l.'},
 cda:{one:'cda.',many:'cdas.'},cdas:{one:'cda.',many:'cdas.'},cucharada:{one:'cda.',many:'cdas.'},cucharadas:{one:'cda.',many:'cdas.'},
 cdta:{one:'cdta.',many:'cdtas.'},cdtas:{one:'cdta.',many:'cdtas.'},cdita:{one:'cdta.',many:'cdtas.'},cditas:{one:'cdta.',many:'cdtas.'},cucharadita:{one:'cdta.',many:'cdtas.'},cucharaditas:{one:'cdta.',many:'cdtas.'},
 taza:{one:'tza.',many:'tzas.'},tazas:{one:'tza.',many:'tzas.'}
};

const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const normalizeUnit=value=>clean(value).toLowerCase().replace(/\.$/,'');
const isOne=value=>/^1(?:[.,]0+)?$/.test(clean(value));

const compactUnit=(value,quantity='')=>{
 const raw=clean(value);
 if(!raw)return '';
 const key=normalizeUnit(raw);
 const labels=UNIT_LABELS[key];
 if(!labels)return raw;
 return isOne(quantity)?labels.one:labels.many;
};

const quantityToken='([\\d.,/½¼¾⅓⅔⅛⅜⅝⅞]+(?:\\s*(?:a|–|-)\\s*[\\d.,/½¼¾⅓⅔⅛⅜⅝⅞]+)?)';
const unitToken='(unidades?|uds?\\.?|gramos?|grs?\\.?|g|kilogramos?|kgs?\\.?|kg|kilos?|mililitros?|ml\\.?|litros?|lts?\\.?|lt\\.?|l\\.?|cucharadas?|cdas?\\.?|cda\\.?|cucharaditas?|cditas?|cdtas?\\.?|cdta\\.?|tazas?|tzas?\\.?|tza\\.?)';
const quantityWithUnit=new RegExp('^'+quantityToken+'\\s*'+unitToken+'(?:\\s+(.+))?$','i');

const splitQuantityText=value=>{
 const raw=clean(value);
 if(!raw)return {quantity:'',unit:'',detail:''};
 const match=raw.match(quantityWithUnit);
 if(!match)return {quantity:raw,unit:'',detail:''};
 return {
  quantity:clean(match[1]),
  unit:clean(match[2]),
  detail:clean(match[3])
 };
};

const numericLike=text=>/^[\s\d.,/½¼¾⅓⅔⅛⅜⅝⅞\-–a]+$/i.test(text);

export function formatIngredientQuantity(item){
 const rawText=clean(item?.quantity_text);
 const rawUnit=clean(item?.unit);
 const parsed=splitQuantityText(rawText);

 // Old imports sometimes stored the complete phrase in quantity_text
 // (for example "4 unidades medianas"). Compact it for display.
 if(parsed.unit){
  return [parsed.quantity,compactUnit(parsed.unit,parsed.quantity)].filter(Boolean).join(' ');
 }

 if(rawText){
  if(!rawUnit)return rawText;
  const unit=compactUnit(rawUnit,rawText);
  const lower=rawText.toLowerCase();
  const rawUnitLower=rawUnit.toLowerCase();
  if(rawUnitLower&&lower.includes(rawUnitLower)){
   const compacted=splitQuantityText(rawText);
   if(compacted.unit)return [compacted.quantity,compactUnit(compacted.unit,compacted.quantity)].join(' ');
   return rawText;
  }
  if(!numericLike(rawText))return rawText;
  return `${rawText} ${unit}`.trim();
 }

 const quantity=item?.quantity;
 if(quantity!==null&&quantity!==undefined&&quantity!==''){
  return [quantity,compactUnit(rawUnit,quantity)].filter(Boolean).join(' ');
 }
 return compactUnit(rawUnit);
}

export function formatIngredientQuantityNote(item){
 const parsed=splitQuantityText(item?.quantity_text);
 return parsed.detail||'';
}

export function formatUnitLabel(unit,quantity=''){
 return compactUnit(unit,quantity);
}
