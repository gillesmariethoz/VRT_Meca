import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {handle} from './worker.mjs';
import {assets} from './build.mjs';
export function adapter(db){return {prepare(sql){let values=[];return {bind(...v){values=v;return this;},async first(){return db.prepare(sql).get(...values)||null;},async run(){return db.prepare(sql).run(...values);}};}};}
if(process.argv[1]?.endsWith('dev.mjs')){
await mkdir('.sites-runtime',{recursive:true});const db=new DatabaseSync('.sites-runtime/preview.sqlite');
for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql'))){const sql=await readFile('drizzle/'+file,'utf8');db.exec(sql.replaceAll('CREATE TABLE ','CREATE TABLE IF NOT EXISTS '));}
const code=process.env.TEAM_CODE||'preview-only';
createServer(async(req,res)=>{try{const chunks=[];for await(const part of req)chunks.push(part);const request=new Request('http://127.0.0.1:4173'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});const response=await handle(request,{DB:adapter(db),TEAM_CODE:code,LOCAL_DEV:true},await assets());res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500);res.end('Preview unavailable');console.error(error);}}).listen(4173,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:4173'));
}
