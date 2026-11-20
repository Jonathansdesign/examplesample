import {mkdir,copyFile,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('../',import.meta.url);
const dist = new URL('../dist/',import.meta.url);
await mkdir(dist,{recursive:true});
for(const file of ['index.html','app.js','worker.js','styles.css','favicon.svg','.nojekyll']) await copyFile(new URL(file,root),new URL(file,dist));
await cp(new URL('python/',root),new URL('python/',dist),{recursive:true});
console.log(`Static build ready: ${fileURLToPath(dist)}`);
