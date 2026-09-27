const UNIT_LABELS={
 g:'grs.',gr:'grs.',grs:'grs.',gramo:'grs.',gramos:'grs.',
 unidad:'uds.',unidades:'uds.',ud:'uds.',uds:'uds.',
 ml:'ml',kg:'kg',
 cda:'cdas.',cucharada:'cdas.',cucharadas:'cdas.',
 cdta:'cdtas.',cdita:'cdtas.',cucharadita:'cdtas.',cucharaditas:'cdtas.'
};

const compactUnit=value=>{
 const raw=String(value||'').trim();
 if(!raw)return '';
 return UNIT_LABELS[raw.toLowerCase()]||raw;
};

const numericLike=text=>/^[\s\d.,/½¼¾⅓⅔⅛⅜⅝⅞\-–a]+$/i.test(text);

export function formatIngredientQuantity(item){
 const rawText=String(item?.quantity_text||'').trim();
 const rawUnit=String(item?.unit||'').trim();
 const unit=compactUnit(rawUnit);

 if(rawText){
  if(!unit)return rawText;
  const lower=rawText.toLowerCase();
  const unitRawLower=rawUnit.toLowerCase();
  const unitLabelLower=unit.toLowerCase();

  if((unitRawLower&&lower.includes(unitRawLower))||(unitLabelLower&&lower.includes(unitLabelLower)))return rawText;
  if(!numericLike(rawText))return rawText;
  return `${rawText} ${unit}`.trim();
 }

 const quantity=item?.quantity;
 if(quantity!==null&&quantity!==undefined&&quantity!=='')return [quantity,unit].filter(Boolean).join(' ');
 return unit;
}

export function formatUnitLabel(unit){
 return compactUnit(unit);
}
