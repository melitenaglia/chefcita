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

const COUNTABLE_SINGULARS={
 huevo:'huevos',
 zanahoria:'zanahorias',
 tomate:'tomates',
 limón:'limones',
 limon:'limones',
 cebolla:'cebollas',
 papa:'papas',
 patata:'patatas',
 palta:'paltas',
 aguacate:'aguacates',
 tortilla:'tortillas'
};

const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const normalizeUnit=value=>clean(value).toLowerCase().replace(/\.$/,'');
const FRACTIONS={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};
const numericValue=value=>{
 const raw=clean(value).replace(',','.');
 if(raw in FRACTIONS)return FRACTIONS[raw];
 if(/^\d+\/\d+$/.test(raw)){
  const [a,b]=raw.split('/').map(Number);
  return b? a/b:null;
 }
 if(!/^\d+(?:\.\d+)?$/.test(raw))return null;
 return Number(raw);
};
const singularQuantity=value=>{
 const number=numericValue(value);
 return number!=null&&number>0&&number<=1;
};

const compactUnit=(value,quantity='')=>{
 const raw=clean(value);
 if(!raw)return '';
 const key=normalizeUnit(raw);
 const labels=UNIT_LABELS[key];
 if(!labels)return raw;
 return singularQuantity(quantity)?labels.one:labels.many;
};

const quantityToken='([\\d.,/½¼¾⅓⅔⅛⅜⅝⅞]+(?:\\s*(?:a|–|-)\\s*[\\d.,/½¼¾⅓⅔⅛⅜⅝⅞]+)?)';
const unitToken='(unidades?|uds?\\.?|gramos?|grs?\\.?|g|kilogramos?|kgs?\\.?|kg|kilos?|mililitros?|ml\\.?|litros?|lts?\\.?|lt\\.?|l\\.?|cucharadas?|cdas?\\.?|cda\\.?|cucharaditas?|cditas?|cdtas?\\.?|cdta\\.?|tazas?|tzas?\\.?|tza\\.?)';
const quantityWithUnit=new RegExp('^'+quantityToken+'\\s*'+unitToken+'(?:\\s+(.+))?$','i');
const unitWithDetail=new RegExp('^'+unitToken+'(?:\\s+(.+))?$','i');

const splitQuantityText=value=>{
 const raw=clean(value);
 if(!raw)return {quantity:'',unit:'',detail:''};
 const match=raw.match(quantityWithUnit);
 if(!match)return {quantity:raw,unit:'',detail:''};
 return {quantity:clean(match[1]),unit:clean(match[2]),detail:clean(match[3])};
};

const splitUnitText=value=>{
 const raw=clean(value);
 if(!raw)return {unit:'',detail:''};
 const match=raw.match(unitWithDetail);
 if(!match)return {unit:raw,detail:''};
 return {unit:clean(match[1]),detail:clean(match[2])};
};

const numericLike=text=>/^[\s\d.,/½¼¾⅓⅔⅛⅜⅝⅞\-–a]+$/i.test(text);
const qualitativeQuantity=text=>/^(?:a|al) gusto$|^opcional\b|^un poco\b|^(?:una\s+)?pizca\b|^cantidad necesaria\b|^c\/?n$/i.test(clean(text));

export function formatIngredientQuantity(item){
 const rawText=clean(item?.quantity_text);
 const rawUnit=clean(item?.unit);
 const parsedText=splitQuantityText(rawText);
 const parsedUnit=splitUnitText(rawUnit);

 if(parsedText.unit){
  return [parsedText.quantity,compactUnit(parsedText.unit,parsedText.quantity)].filter(Boolean).join(' ');
 }

 if(rawText){
  if(rawUnit){
   const unit=compactUnit(parsedUnit.unit||rawUnit,rawText);
   if(numericLike(rawText))return `${rawText} ${unit}`.trim();
  }

  if(!rawUnit){
   const count=numericValue(rawText);
   const name=clean(item?.original_name).toLowerCase();
   if(count!=null&&count>0&&COUNTABLE_SINGULARS[name]){
    return [rawText,compactUnit('unidad',rawText)].join(' ');
   }
  }

  return rawText;
 }

 const quantity=item?.quantity;
 if(quantity!==null&&quantity!==undefined&&quantity!==''){
  const name=clean(item?.original_name).toLowerCase();
  const inferredUnit=!rawUnit&&COUNTABLE_SINGULARS[name]?'unidad':rawUnit;
  return [quantity,compactUnit(splitUnitText(inferredUnit).unit||inferredUnit,quantity)].filter(Boolean).join(' ');
 }

 return compactUnit(parsedUnit.unit||rawUnit);
}

export function formatIngredientQuantityNote(item){
 const parsedText=splitQuantityText(item?.quantity_text);
 const parsedUnit=splitUnitText(item?.unit);
 return [parsedText.detail,parsedUnit.detail].filter(Boolean).join(' · ');
}

export function formatIngredientName(item){
 const raw=clean(item?.original_name);
 const quantityText=splitQuantityText(item?.quantity_text).quantity||clean(item?.quantity_text)||String(item?.quantity??'');
 const value=numericValue(quantityText);
 const plural=COUNTABLE_SINGULARS[raw.toLowerCase()];
 if(value!=null&&value>1&&plural)return plural;
 return raw;
}

export function formatIngredientDisplay(item){
 const quantity=formatIngredientQuantity(item);
 const quantityNote=formatIngredientQuantityNote(item);
 const qualitative=qualitativeQuantity(quantity);
 return {
  quantity:qualitative?'':quantity,
  name:formatIngredientName(item),
  note:[qualitative?quantity:'',quantityNote,item?.note].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(' · ')
 };
}

export function formatUnitLabel(unit,quantity=''){
 return compactUnit(splitUnitText(unit).unit||unit,quantity);
}
