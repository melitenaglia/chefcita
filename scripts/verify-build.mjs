import fs from 'node:fs';
import {formatIngredientQuantity,formatIngredientQuantityNote,formatIngredientDisplay} from '../src/recipeFormat.js';

const html = fs.readFileSync('dist/index.html', 'utf8');

if (html.includes('/src/main.jsx')) {
  throw new Error('Production HTML still references the source entrypoint');
}

const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((ref) => ref.startsWith('/assets/'));

if (refs.length === 0) {
  throw new Error('No compiled assets were found in production HTML');
}

for (const ref of refs) {
  const relative = ref.replace(/^\//, '');
  const file = 'dist/' + relative;
  if (!fs.existsSync(file)) {
    throw new Error('Missing compiled asset: ' + file);
  }
}

for (const file of [
  'dist/manifest.webmanifest',
  'dist/sw.js',
  'dist/icons/chefcita-180.png',
  'dist/icons/chefcita-192.png',
  'dist/icons/chefcita-512.png'
]) {
  if (!fs.existsSync(file)) {
    throw new Error('Missing installable app asset: ' + file);
  }
}

const manifest=JSON.parse(fs.readFileSync('dist/manifest.webmanifest','utf8'));
if(manifest.name!=='Chefcita'||manifest.start_url!=='/'||manifest.display!=='standalone'){
 throw new Error('Invalid Chefcita web app manifest');
}
const manifestSizes=new Set((manifest.icons||[]).map(icon=>icon.sizes));
if(!manifestSizes.has('192x192')||!manifestSizes.has('512x512')){
 throw new Error('Chefcita manifest is missing required install icons');
}
if(!html.includes('rel="manifest"')||!html.includes('rel="apple-touch-icon"')){
 throw new Error('Production HTML is missing install metadata');
}

const quantityCases=[
 [{quantity_text:'4',quantity:4,unit:'unidad'},'4 uds.'],
 [{quantity_text:'120',quantity:120,unit:'g'},'120 grs.'],
 [{quantity_text:'2',quantity:2,unit:'kg'},'2 kgs.'],
 [{quantity_text:'250',quantity:250,unit:'ml'},'250 ml.'],
 [{quantity_text:'1',quantity:1,unit:'taza'},'1 tza.'],
 [{quantity_text:'300 g',quantity:300,unit:'g'},'300 grs.'],
 [{quantity_text:'1 cucharadita',quantity:1,unit:'cucharadita'},'1 cdta.'],
 [{quantity_text:'½',quantity:.5,unit:'cucharadita'},'½ cdta.'],
 [{quantity_text:'1/3',quantity:null,unit:'taza'},'1/3 tza.'],
 [{quantity_text:'4',quantity:4,unit:'unidades medianas'},'4 uds.'],
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
if(formatIngredientQuantityNote({quantity_text:'4',unit:'unidades medianas'})!=='medianas'){
 throw new Error('Unit descriptor extraction failed');
}
const salt=formatIngredientDisplay({quantity_text:'a gusto',original_name:'sal',note:''});
if(salt.quantity!==''||salt.name!=='sal'||salt.note!=='a gusto'){
 throw new Error('Qualitative ingredient display failed');
}
const eggs=formatIngredientDisplay({quantity_text:'3',original_name:'huevo',unit:''});
if(eggs.quantity!=='3 uds.'||eggs.name!=='huevos'){
 throw new Error('Countable ingredient display failed');
}

console.log('Production build integrity and ingredient quantity checks passed.');
