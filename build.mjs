import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
const types={'index.html':'text/html; charset=utf-8','style.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8','config.js':'text/javascript; charset=utf-8','icon.svg':'image/svg+xml','vrt-logo.svg':'image/svg+xml','manifest.webmanifest':'application/manifest+json'};
export async function assets(){const map={};for(const [name,type] of Object.entries(types))map['/'+name]={type,body:await readFile(new URL(name,import.meta.url),'utf8')};return map;}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith('/'+process.argv[1].replaceAll('\\','/').split('/').pop())){
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',(await readFile('worker.mjs','utf8'))+'\nconst assets = '+JSON.stringify(await assets())+';\nexport default { fetch(request,env) { return handle(request,env,assets); } };\n');
await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('VRT application built successfully.');}
