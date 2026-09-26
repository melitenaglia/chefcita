import fs from 'node:fs';

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

console.log('Production build integrity check passed.');
