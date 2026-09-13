const IDS=['chassis','ia','direction','pedalier','chaise','firewall','suspension-avant','train-avant','train-arriere','suspension-arriere','tsac','punch-bar','aileron-avant','aileron-arriere','carrosserie','fond-plat','side-pod','fixation-chassis','ses','ases','boom'];
const ALLOWED_ORIGINS=['https://gillesmariethoz.github.io'];
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function validate(id,r){
 if(!IDS.includes(id)||!r||typeof r!=='object'||Array.isArray(r))fail('Système ou fiche invalide.');
 if(!Array.isArray(r.steps)||r.steps.length!==5||r.steps.some(s=>!Number.isInteger(s)||s<0||s>2))fail('Étapes invalides.');
 if(!Number.isSafeInteger(r.revision)||r.revision<0)fail('Version de fiche invalide.');
 const clean={steps:[...r.steps]};
 for(const key of ['deadline','owner','problems','solutions','notes']){if(typeof r[key]!=='string'||r[key].length>(key==='owner'?100:key==='deadline'?10:20000))fail('Champ invalide : '+key);clean[key]=r[key];}
 if(clean.deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(clean.deadline)||!Number.isFinite(Date.parse(clean.deadline))||new Date(clean.deadline).toISOString().slice(0,10)!==clean.deadline))fail('Date invalide.');
 return {...clean,revision:r.revision+1,updatedAt:new Date().toISOString()};
}
async function readBody(request){if(Number(request.headers.get('content-length'))>2000000)fail('Fichier trop volumineux.',413);const reader=request.body?.getReader();if(!reader)fail('Données manquantes.');let length=0,parts=[];while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>2000000){await reader.cancel();fail('Fichier trop volumineux.',413);}parts.push(value);}const merged=new Uint8Array(length);let offset=0;for(const p of parts){merged.set(p,offset);offset+=p.length;}try{return JSON.parse(new TextDecoder().decode(merged));}catch{fail('Données JSON invalides.');}}
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
async function authenticate(request,env){
 if(!env.TEAM_CODE||!env.DB)fail('Le service partagé est en cours de configuration.',503);
 const supplied=request.headers.get('Authorization')||'';
 if(supplied.length>300)fail('Code incorrect.',401);
 const ip=request.headers.get('CF-Connecting-IP')||'local';
 const bytes=await digest(ip+env.TEAM_CODE);const key=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const now=Math.floor(Date.now()/1000),window=Math.floor(now/900);
 const attempts=await env.DB.prepare('SELECT fails, window FROM auth_attempts WHERE key = ?').bind(key).first();
 if(attempts?.window===window&&attempts.fails>=8)fail('Trop de tentatives. Réessaie dans 15 minutes.',429);
 const a=await digest(supplied),b=await digest('Bearer '+env.TEAM_CODE);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 if(diff){await env.DB.prepare('INSERT INTO auth_attempts (key, fails, window) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET fails = CASE WHEN window = excluded.window THEN fails + 1 ELSE 1 END, window = excluded.window').bind(key,window).run();fail('Code d’accès incorrect.',401);}
 if(attempts)await env.DB.prepare('DELETE FROM auth_attempts WHERE key = ?').bind(key).run();
 // Expire obsolete attempt buckets without retaining visitors’ addresses.
 await env.DB.prepare('DELETE FROM auth_attempts WHERE window < ?').bind(window-1).run();
}
async function api(request,env,path){
 await authenticate(request,env);
 if(path==='/api/systems'&&request.method==='GET'){const row=await env.DB.prepare('SELECT records FROM project WHERE id = 1').first();return json({records:row?JSON.parse(row.records):{}});}
 if((path.startsWith('/api/systems/')&&request.method==='PUT')||(path==='/api/import'&&request.method==='POST')){
  const body=await readBody(request);const single=path!=='/api/import';const updates=single?[{...body,id:path.slice('/api/systems/'.length)}]:body.updates;
  if(!Array.isArray(updates)||!updates.length||updates.length>IDS.length)fail('Sauvegarde vide ou invalide.');
  if(new Set(updates.map(r=>r?.id)).size!==updates.length)fail('Systèmes dupliqués.');
  const clean=updates.map(r=>({id:r.id,value:validate(r.id,r),expected:r.revision}));
  await env.DB.prepare("INSERT OR IGNORE INTO project (id, records) VALUES (1, '{}')").run();
  // All edits in an import succeed together, or none do. Each revision is checked in the write itself.
  const pairs=clean.map(()=>"?, json(?)").join(', '),guards=clean.map(()=>"coalesce(json_extract(records, ?), 0) = ?").join(' AND ');
  const args=clean.flatMap(r=>['$."'+r.id+'"',JSON.stringify(r.value)]).concat(clean.flatMap(r=>['$."'+r.id+'".revision',r.expected]));
  const row=await env.DB.prepare(`UPDATE project SET records = json_set(records, ${pairs}) WHERE id = 1 AND ${guards} RETURNING records`).bind(...args).first();
  if(!row)fail('Une fiche a été modifiée par un autre membre. Recharge sa dernière version avant de réessayer.',409);
  return json(single?{record:JSON.parse(row.records)[clean[0].id]}:{count:clean.length});
 }
 return json({error:'Route introuvable.'},404);
}
export async function handle(request,env,assets={}){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';const origin=request.headers.get('Origin');const sameOrigin=origin===url.origin;const allowed=!origin||sameOrigin||ALLOWED_ORIGINS.includes(origin)||(env.LOCAL_DEV&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin));
 let response;
 try{
  if(path.startsWith('/api/')){
   if(!allowed)response=json({error:'Origine non autorisée.'},403);
   else if(request.method==='OPTIONS')response=new Response(null,{status:204});
   else response=await api(request,env,path);
  }else{
   const key=path==='/'?'/index.html':path,asset=assets[key];
   response=asset&&['GET','HEAD'].includes(request.method)?new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache'}}):new Response('Page introuvable',{status:404});
  }
 }catch(error){if(!error.status)console.error('VRT service failure:',error.message);response=json({error:error.status?error.message:'Service momentanément indisponible. Les modifications ouvertes sont conservées.'},error.status||503);}
 const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');
 if(origin&&allowed){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET,PUT,POST,OPTIONS');headers.set('Access-Control-Allow-Headers','Authorization,Content-Type');headers.set('Access-Control-Max-Age','600');}
 return new Response(response.body,{status:response.status,headers});
}
