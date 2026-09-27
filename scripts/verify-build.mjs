import fs from 'node:fs';
import {formatIngredientQuantity,formatIngredientQuantityNote} from '../src/recipeFormat.js';

const html = fs.readFileSync('dist/index.html', 'utf8');

if (html.includes('/src/main.jsx')) {
  throw new Error('Production HTML still references the source entrypoint');
}

const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((ref) => ref.startsWith('/chefcita/assets/'));

if (refs.length === 0) {
  throw new Error('No compiled assets were found in production HTML');
}

for (const ref of refs) {
  const relative = ref.replace('/chefcita/', '');
  const file = 'dist/' + relative;
  if (!fs.existsSync(file)) {
    throw new Error('Missing compiled asset: ' + file);
  }
}

const quantityCases=[
 [{quantity_text:'4',quantity:4,unit:'unidad'},'4 uds.'],
 [{quantity_text:'120',quantity:120,unit:'g'},'120 grs.'],
 [{quantity_text:'2',quantity:2,unit:'kg'},'2 kgs.'],
 [{quantity_text:'250',quantity:250,unit:'ml'},'250 ml.'],
 [{quantity_text:'1',quantity:1,unit:'taza'},'1 tza.'],
 [{quantity_text:'300 g',quantity:300,unit:'g'},'300 grs.'],
 [{quantity_text:'1 cucharadita',quantity:1,unit:'cucharadita'},'1 cdta.'],
 [{quantity_text:'4 unidades medianas',quantity:4,unit:'unidad'},'4 uds.'],
 [{quantity_text:'3 a 4',quantity:3,unit:'lonchas'},'3 a 4 lonchas'],
 [{quantity_text:'a gusto',quantity:null,unit:''},'a gusto']
]

for(const [input,expected] of quantityCases){
 const actual=formatIngredientQuantity(input);
 if(actual!==expected)throw new Error(`Ingredient quantity format mismatch: expected "${expected}", got "${actual}"`);
}

if(formatIngredientQuantityNote({quantity_text:'4 unidades medianas'})!=='medianas'){
 throw new Error('Legacy ingredient descriptor extraction failed');
}

console.log('Production build integrity and ingredient quantity checks passed.');
