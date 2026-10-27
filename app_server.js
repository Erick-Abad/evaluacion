'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {backup}=require('node:sqlite');
const {createStorage,initializeStorage,createSqliteSnapshot}=require('./storage');
const {encryptCredentials,decryptCredentials}=require('./credential_vault');
const {QUESTIONS,CATEGORIES,ROSTER,CAT_OF_NUMBER,calcScores}=require('./catalog');
const {createPdf}=require('./pdf_report');

const ROOT=__dirname;
const HOST=process.env.HOST||'127.0.0.1';
const PORT=Number(process.env.PORT||3000);
const CLOUD=process.env.VERCEL==='1'||process.env.PERSISTENCE==='postgres';
const DEMO_MODE=!CLOUD&&process.env.DEMO_MODE!=='0'&&(HOST==='127.0.0.1'||HOST==='localhost');
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||(CLOUD?'':'0504784075');
const credentialKey=CLOUD?Buffer.from(process.env.CREDENTIALS_ENCRYPTION_KEY||'','base64'):null;
const databaseCaCert=CLOUD?Buffer.from(process.env.DATABASE_CA_CERT_B64||'','base64').toString('utf8'):'';
let databaseHost='';
try{databaseHost=new URL(process.env.DATABASE_URL||'').hostname}catch{}
if(CLOUD&&( !databaseHost.endsWith('.pooler.supabase.com')||
 new URL(process.env.DATABASE_URL).port!=='6543'||
 ADMIN_PASSWORD.length<16||ADMIN_PASSWORD==='0504784075'||credentialKey.length!==32)){
 throw new Error('Configura DATABASE_URL (pooler de Supabase), ADMIN_PASSWORD de al menos 16 caracteres y CREDENTIALS_ENCRYPTION_KEY de 32 bytes en base64.');
}
if(CLOUD){
 try{new crypto.X509Certificate(databaseCaCert)}
 catch{throw new Error('Configura DATABASE_CA_CERT_B64 con el certificado CA de Supabase codificado en Base64.')}
}
if(!CLOUD&&ADMIN_PASSWORD.length<10)throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres.');
const dbFile=CLOUD?null:(process.env.DB_PATH||path.join(ROOT,'data','vocacional.db'));
if(dbFile)fs.mkdirSync(path.dirname(dbFile),{recursive:true});
const db=createStorage({mode:CLOUD?'postgres':'sqlite',databaseUrl:process.env.DATABASE_URL,databaseCaCert,sqlitePath:dbFile});
const initialization=initialize();
initialization.catch(error=>console.error('No se pudo inicializar la persistencia:',error));

function hashPin(pin,salt){return crypto.scryptSync(String(pin),salt,64).toString('hex')}
function safeEqual(a,b){const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function randomPin(){return String(crypto.randomInt(100000,1000000))}
async function addStudent(code,className,position,name,pin,demo=0){
 const salt=crypto.randomBytes(16).toString('hex');
 await db.prepare('INSERT OR IGNORE INTO students(code,class,position,name,salt,pin_hash,demo) VALUES(?,?,?,?,?,?,?)').run(code,className,position,name,salt,hashPin(pin,salt),demo);
}
async function initialize(){
 await initializeStorage(db);
 await db.transaction(async()=>{
  if(CLOUD)await db.prepare('SELECT pg_advisory_xact_lock(73190126)').get();
  const count=await db.prepare('SELECT COUNT(*) AS n FROM students').get();
  if(Number(count.n)===0){
   const lines=['Código,Paralelo,Número,Estudiante,PIN'];
   for(const cl of ['A','B'])for(let i=0;i<ROSTER[cl].length;i++){
    const name=ROSTER[cl][i],code=`${cl}${String(i+1).padStart(2,'0')}`,pin=randomPin();
    await addStudent(code,cl,i+1,name,pin);
    lines.push([code,cl,i+1,`"${name.replace(/"/g,'""')}"`,pin].join(','));
   }
   const csv='\ufeff'+lines.join('\r\n');
   if(CLOUD){
    const encrypted=encryptCredentials(csv,credentialKey);
    await db.prepare('INSERT INTO initial_credentials(id,iv,auth_tag,ciphertext) VALUES(1,?,?,?)').run(encrypted.iv,encrypted.auth_tag,encrypted.ciphertext);
   }else{
    const secretFile=path.join(path.dirname(dbFile),'CLAVES_PRIVADAS_DOCENTE.csv');
    fs.writeFileSync(secretFile,csv,'utf8');fs.chmodSync(secretFile,0o600);
    console.log('Se crearon 60 estudiantes. Claves iniciales privadas en: '+secretFile);
   }
  }
 });
 if(CLOUD){
  const credentials=await db.prepare('SELECT iv,auth_tag,ciphertext FROM initial_credentials WHERE id=1').get();
  if(credentials)decryptCredentials(credentials,credentialKey);
 }
 if(DEMO_MODE)await addStudent('D00','D',0,'ESTUDIANTE DE PRUEBA','123456',1);
}

// Respaldo local consistente al iniciar y una vez al día mientras el servidor esté encendido.
// Complementar obligatoriamente con una copia cifrada y automatizada fuera del equipo.
let backupBusy=false;
async function takeBackup(){
 if(CLOUD||backupBusy)return;
 backupBusy=true;
 const dir=path.join(path.dirname(dbFile),'backups');
 fs.mkdirSync(dir,{recursive:true});
 const day=new Date().toISOString().slice(0,10);
 const dest=path.join(dir,`vocacional-${day}.sqlite`);
 const temp=dest+'.tmp';
 try{
  if(fs.existsSync(temp))fs.unlinkSync(temp);
  await backup(db.raw,temp);
  fs.renameSync(temp,dest);
  const archived=fs.readdirSync(dir).filter(f=>/^vocacional-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort();
  for(const old of archived.slice(0,Math.max(0,archived.length-14)))fs.unlinkSync(path.join(dir,old));
  console.log('Respaldo local creado: '+dest);
 }catch(e){console.error('ATENCIÓN: no se pudo crear respaldo local:',e.message)}
 finally{backupBusy=false}
}


async function getCurrent(code){
 return db.prepare("SELECT * FROM evaluations WHERE student_code=? AND status IN ('active','completed') ORDER BY id DESC LIMIT 1").get(code);
}
async function ensureCurrent(code){let e=await getCurrent(code);if(!e){
 await db.prepare("INSERT INTO evaluations(student_code,status) VALUES(?,'active') ON CONFLICT DO NOTHING").run(code);
 e=await getCurrent(code);
}return e}
async function lockEvaluation(id){
 if(CLOUD)return db.prepare('SELECT * FROM evaluations WHERE id=? FOR UPDATE').get(id);
 return db.prepare('SELECT * FROM evaluations WHERE id=?').get(id);
}
async function getCurrentForUpdate(code){
 if(CLOUD)return db.prepare("SELECT * FROM evaluations WHERE student_code=? AND status IN ('active','completed') ORDER BY id DESC LIMIT 1 FOR UPDATE").get(code);
 return getCurrent(code);
}
function getAnswers(id){return db.prepare('SELECT question_number,choice,created_at FROM answers WHERE evaluation_id=? ORDER BY question_number').all(id)}
async function summary(code,create=true){
 const student=await db.prepare('SELECT code,class,position,name,demo FROM students WHERE code=?').get(code);
 const e=create?await ensureCurrent(code):await getCurrent(code);
 const rows=e?await getAnswers(e.id):[]; const scores=calcScores(rows);
 return {student,evaluation:{id:e?.id||null,status:e?.status||'pending',started_at:e?.started_at||null,completed_at:e?.completed_at||null,current:Math.min(rows.length+1,50)},progress:rows.length, scores:e?.status==='completed'?scores:null,
  question:e?.status==='active'?{number:rows.length+1,text:QUESTIONS[rows.length]}:null};
}
async function event(code,id,action,actor,details=''){
 await db.prepare('INSERT INTO audit_events(student_code,evaluation_id,action,actor,details) VALUES(?,?,?,?,?)').run(code,id,action,actor,details);
}
async function newSession(res,role,studentCode=null,req){
 const token=crypto.randomBytes(32).toString('hex');const h=crypto.createHash('sha256').update(token).digest('hex');
 await db.prepare('INSERT INTO sessions(token_hash,role,student_code,expires_at) VALUES(?,?,?,?)').run(h,role,studentCode,Date.now()+8*60*60*1000);
 const secure=CLOUD||req.socket?.encrypted?'; Secure':'';
 res.setHeader('Set-Cookie',`voc_sess=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
}
async function session(req){
 const cookie=req.headers.cookie||'';const m=cookie.match(/(?:^|;\s*)voc_sess=([a-f0-9]{64})(?:;|$)/);
 if(!m)return null;
 const h=crypto.createHash('sha256').update(m[1]).digest('hex');
 return await db.prepare('SELECT role,student_code FROM sessions WHERE token_hash=? AND expires_at>?').get(h,Date.now())||null;
}
async function removeSession(req,res){
 const m=(req.headers.cookie||'').match(/(?:^|;\s*)voc_sess=([a-f0-9]{64})(?:;|$)/);
 if(m)await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(m[1]).digest('hex'));
 res.setHeader('Set-Cookie','voc_sess=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
function err(res,code,message){json(res,code,{error:message})}
function readJson(req){return new Promise((resolve,reject)=>{
 if(req.body!==undefined){
  if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body))return resolve(req.body);
  const body=Buffer.isBuffer(req.body)?req.body.toString('utf8'):String(req.body);
  try{return resolve(body?JSON.parse(body):{})}catch{return reject(Error('JSON inválido'))}
 }
 let data='';req.on('data',chunk=>{data+=chunk;if(data.length>50000){reject(Error('Solicitud demasiado grande'));req.destroy()}});
 req.on('end',()=>{try{resolve(data?JSON.parse(data):{})}catch(e){reject(Error('JSON inválido'))}});req.on('error',reject);
})}
function clientIp(req){
 const forwarded=req.headers['x-forwarded-for'];
 return (typeof forwarded==='string'?forwarded.split(',')[0].trim():'')||req.socket?.remoteAddress||'unknown';
}
async function loginAllowed(ip){
 const r=await db.prepare('SELECT count,until_ms FROM login_attempts WHERE ip=?').get(ip);
 return !r||Number(r.until_ms)<Date.now()||Number(r.count)<8;
}
async function loginFailed(ip){
 const now=Date.now();
 await db.prepare(`INSERT INTO login_attempts(ip,count,until_ms) VALUES(?,1,?)
  ON CONFLICT(ip) DO UPDATE SET
  count=CASE WHEN login_attempts.until_ms<? THEN 1 ELSE login_attempts.count+1 END,
  until_ms=CASE WHEN login_attempts.until_ms<? THEN excluded.until_ms ELSE login_attempts.until_ms END`).run(ip,now+15*60*1000,now,now);
}
function csvEscape(s){let text=String(s??'');if(/^[=+@\-]/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`}
async function adminRows(){
 const students=await db.prepare('SELECT code,class,position,name,demo FROM students WHERE demo=0 ORDER BY class,position').all();
 return Promise.all(students.map(async s=>{
 const e=await getCurrent(s.code);const a=e?await getAnswers(e.id):[];
 const scores=e&&e.status==='completed'?calcScores(a):null;
 return {...s,status:e?.status||'pending',progress:a.length,completed_at:e?.completed_at||null,scores};
 }));
}
async function fullReport(code,create=false){
 const s=await summary(code,create),e=await getCurrent(code),rows=e?await getAnswers(e.id):[],map=Object.fromEntries(rows.map(r=>[r.question_number,r.choice]));
 return {...s,allAnswers:QUESTIONS.map((text,i)=>({number:i+1,text,category:CAT_OF_NUMBER[i+1],choice:map[i+1]??null}))};
}
async function archivedCompletedReport(code,attempt){
 const student=await db.prepare('SELECT code,class,position,name,demo FROM students WHERE code=?').get(code);
 const evaluation=await db.prepare('SELECT id,status,started_at,completed_at FROM evaluations WHERE id=? AND student_code=?').get(attempt,code);
 if(!student||!evaluation||!evaluation.completed_at)return null;
 const rows=await getAnswers(evaluation.id);
 if(rows.length!==50)return null;
 const choices=Object.fromEntries(rows.map(r=>[r.question_number,r.choice]));
 return {student,evaluation:{...evaluation,current:50},progress:50,scores:calcScores(rows),
  allAnswers:QUESTIONS.map((text,i)=>({number:i+1,text,category:CAT_OF_NUMBER[i+1],choice:choices[i+1]??null}))};
}
function sendPdf(res,report){
 const file=`Informe_vocacional_${report.student.code}_intento_${report.evaluation.id}.pdf`;
 const pdf=createPdf(report);
 res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${file}"`,
  'Content-Length':String(pdf.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
 return res.end(pdf);
}
function securityHeaders(res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'");
}
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml'};
function serveStatic(req,res,pathname){
 const available={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/favicon.svg':'favicon.svg'};
 const filename=available[pathname];if(!filename)return err(res,404,'No encontrado');
 const file=path.join(ROOT,'public',filename);
 try{res.writeHead(200,{'Content-Type':TYPES[path.extname(filename)],'Cache-Control':pathname==='/'?'no-store':'max-age=300'});fs.createReadStream(file).pipe(res)}catch(e){err(res,404,'Archivo no encontrado')}
}
function transaction(fn){return db.transaction(fn)}
async function cloudSqliteBackup(){
 const snapshot=createSqliteSnapshot();
 try{
  await transaction(async()=>{
   await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   for(const table of ['students','evaluations','answers','sessions','login_attempts','audit_events','initial_credentials']){
    const rows=await db.prepare(`SELECT * FROM ${table}`).all();
    if(!rows.length)continue;
    const columns=Object.keys(rows[0]);
    const stmt=snapshot.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`);
    for(const row of rows)stmt.run(...columns.map(column=>row[column]));
   }
  });
  return snapshot.serialize();
 }finally{snapshot.close()}
}

const server=http.createServer(async(req,res)=>{
 securityHeaders(res);
 const pathname=new URL(req.url,'http://localhost').pathname;
 const method=req.method;
 try{
  await initialization;
  if(pathname==='/api/config'&&method==='GET')return json(res,200,{institution:'Miguel Febres Cordero',year:'2026–2027',students:60,questions:50,categories:CATEGORIES.map(({numbers,...c})=>c),demo:DEMO_MODE});
  if(pathname==='/api/login'&&method==='POST'){
   const ip=clientIp(req);
   if(!await loginAllowed(ip))return err(res,429,'Demasiados intentos. Intenta más tarde.');
   const body=await readJson(req);
   if(body.role==='admin'){
    if(!safeEqual(body.password||'',ADMIN_PASSWORD)){await loginFailed(ip);return err(res,401,'Credenciales incorrectas.');}
    await newSession(res,'admin',null,req);return json(res,200,{ok:true,role:'admin'});
   }
   const code=String(body.code||'').trim().toUpperCase();
   const student=await db.prepare('SELECT code,salt,pin_hash,demo FROM students WHERE code=?').get(code);
   if(!student || (student.demo&&!DEMO_MODE) || !safeEqual(hashPin(body.pin||'',student.salt),student.pin_hash)){
    await loginFailed(ip);return err(res,401,'Código o clave incorrectos.');
   }
   await ensureCurrent(code);await newSession(res,'student',code,req);return json(res,200,{ok:true,role:'student'});
  }
  if(pathname==='/api/logout'&&method==='POST'){await removeSession(req,res);return json(res,200,{ok:true})}
  const sess=await session(req);
  if(pathname==='/api/session'&&method==='GET')return json(res,200,sess?{authenticated:true,...sess,student:sess.role==='student'?await summary(sess.student_code):null}:{authenticated:false});
  if(!sess&&pathname.startsWith('/api/'))return err(res,401,'Inicia sesión.');
  if(pathname==='/api/answer'&&method==='POST'){
   if(sess.role!=='student')return err(res,403,'Acceso denegado.');
   const body=await readJson(req),num=Number(body.number);
   if(!Number.isInteger(num)||![0,1].includes(body.choice))return err(res,400,'Respuesta inválida.');
   const code=sess.student_code;
   try{
    await transaction(async()=>{
     const current=await ensureCurrent(code),e=await lockEvaluation(current.id);
     if(!e||e.status!=='active')throw Error('La evaluación ya fue finalizada.');
     const count=await db.prepare('SELECT COUNT(*) AS n FROM answers WHERE evaluation_id=?').get(e.id);
     if(num!==Number(count.n)+1)throw Error('La pregunta anterior quedó bloqueada. No se permite retroceder ni editar respuestas.');
     await db.prepare('INSERT INTO answers(evaluation_id,question_number,choice) VALUES(?,?,?)').run(e.id,num,body.choice);
     if(num===50){await db.prepare("UPDATE evaluations SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);await event(code,e.id,'completed','student');}
    });
    return json(res,200,await summary(code));
   }catch(e){return err(res,409,e.message)}
  }
  if(pathname==='/api/restart'&&method==='POST'){
   if(sess.role!=='student')return err(res,403,'Acceso denegado.');
   const b=await readJson(req);if(b.confirm!=='REINICIAR')return err(res,400,'Debes confirmar el reinicio.');
   try{await transaction(async()=>{
    const current=await ensureCurrent(sess.student_code),e=await lockEvaluation(current.id);
    if(!e||e.status==='completed')throw Error('Evaluación finalizada: solo el docente puede autorizar otro intento.');
    await db.prepare("UPDATE evaluations SET status='restarted',reset_by='student',reset_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);
    await event(sess.student_code,e.id,'restarted','student','Nuevo intento desde la primera pregunta');
    await db.prepare("INSERT INTO evaluations(student_code,status) VALUES(?,'active')").run(sess.student_code);
   });return json(res,200,await summary(sess.student_code));}catch(e){return err(res,409,e.message)}
  }
  if(pathname==='/api/report'&&method==='GET'){
   if(sess.role!=='student')return err(res,403,'Acceso denegado.');
   const s=await fullReport(sess.student_code);if(s.evaluation.status!=='completed')return err(res,403,'Completa primero las 50 preguntas.');
   return json(res,200,s);
  }
  if(pathname==='/api/report.pdf'&&method==='GET'){
   if(sess.role!=='student')return err(res,403,'Acceso denegado.');
   const e=await getCurrent(sess.student_code);
   if(!e||e.status!=='completed')return err(res,403,'Completa las 50 preguntas antes de descargar el informe.');
   return sendPdf(res,await archivedCompletedReport(sess.student_code,e.id));
  }
  if(pathname==='/api/admin/report.pdf'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const params=new URL(req.url,'http://localhost').searchParams;
   const code=params.get('code'),attempt=Number(params.get('attempt'));
   if(!/^[AB]\d{2}$/.test(code||'') || !Number.isSafeInteger(attempt)||attempt<1)return err(res,400,'Código de estudiante o intento inválido.');
   const report=await archivedCompletedReport(code,attempt);
   if(!report)return err(res,404,'El intento solicitado no tiene 50 respuestas finalizadas.');
   await event(code,attempt,'pdf_downloaded','admin');
   return sendPdf(res,report);
  }
  if(pathname==='/api/admin/overview'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   return json(res,200,{students:await adminRows(),categories:CATEGORIES});
  }
  if(pathname==='/api/admin/student'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const code=new URL(req.url,'http://localhost').searchParams.get('code');
   if(!await db.prepare('SELECT code FROM students WHERE code=? AND demo=0').get(code))return err(res,404,'Estudiante no encontrado.');
   const result=await fullReport(code);result.history=await db.prepare('SELECT id,status,started_at,completed_at,reset_by,reset_at FROM evaluations WHERE student_code=? ORDER BY id DESC').all(code);
   return json(res,200,result);
  }
  if(pathname==='/api/admin/reset'&&method==='POST'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const b=await readJson(req);const code=String(b.code||'').toUpperCase();
   if(b.confirm!=='REINICIAR'||!await db.prepare('SELECT code FROM students WHERE code=? AND demo=0').get(code))return err(res,400,'Solicitud inválida.');
   await transaction(async()=>{
    const e=await getCurrentForUpdate(code);
    if(e){await db.prepare("UPDATE evaluations SET status='restarted',reset_by='admin',reset_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);await event(code,e.id,'restarted','admin',String(b.reason||'Reinicio autorizado').slice(0,200))}
    await db.prepare("INSERT INTO evaluations(student_code,status) VALUES(?,'active')").run(code);
   });return json(res,200,{ok:true});
  }
  if(pathname==='/api/admin/reset-pin'&&method==='POST'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const b=await readJson(req),code=String(b.code||'').toUpperCase();
   const st=await db.prepare('SELECT code FROM students WHERE code=? AND demo=0').get(code);
   if(!st)return err(res,404,'Estudiante no encontrado.');
   if(b.confirm!=='REGENERAR')return err(res,400,'Confirmación requerida.');
   const pin=randomPin(),salt=crypto.randomBytes(16).toString('hex');
   await db.prepare('UPDATE students SET salt=?,pin_hash=? WHERE code=?').run(salt,hashPin(pin,salt),code);
   await event(code,null,'pin_regenerated','admin');return json(res,200,{code,pin});
  }
  if(pathname==='/api/admin/export.csv'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const rows=await adminRows();const cols=['Código','Paralelo','N°','Estudiante','Estado','Respondidas',...CATEGORIES.map(c=>c.name),'Mayor interés','Finalizado'];
   const csv='\ufeff'+[cols,...rows.map(s=>[s.code,s.class,s.position,s.name,s.status,s.progress,...CATEGORIES.map(c=>s.scores?.scores[c.key]??''),s.scores?.top.map(k=>CATEGORIES.find(c=>c.key===k).name).join(' / ')||'',s.completed_at||''])].map(a=>a.map(csvEscape).join(',')).join('\r\n');
   res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="resultados_vocacionales.csv"','Cache-Control':'no-store'});return res.end(csv);
  }
  if(pathname==='/api/admin/backup.sqlite'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   if(CLOUD){
    const bytes=await cloudSqliteBackup();
    await event(null,null,'backup_downloaded','admin');
    res.writeHead(200,{'Content-Type':'application/vnd.sqlite3',
     'Content-Disposition':`attachment; filename="respaldo_vocacional_${new Date().toISOString().slice(0,10)}.sqlite"`,
     'Content-Length':String(bytes.length),'Cache-Control':'private, no-store'});
    return res.end(bytes);
   }
   const dir=path.join(path.dirname(dbFile),'backups');fs.mkdirSync(dir,{recursive:true});
   const tmp=path.join(dir,`export-${crypto.randomBytes(12).toString('hex')}.sqlite`);
   try{
    await backup(db.raw,tmp);
    const bytes=fs.readFileSync(tmp);
    await event(null,null,'backup_downloaded','admin');
    res.writeHead(200,{'Content-Type':'application/vnd.sqlite3',
     'Content-Disposition':`attachment; filename="respaldo_vocacional_${new Date().toISOString().slice(0,10)}.sqlite"`,
     'Content-Length':String(bytes.length),'Cache-Control':'private, no-store'});
    return res.end(bytes);
   }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
  }
  if(pathname==='/api/admin/credentials.csv'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   if(CLOUD){
    const stored=await db.prepare('SELECT iv,auth_tag,ciphertext FROM initial_credentials WHERE id=1').get();
    if(!stored)return err(res,404,'Las claves iniciales no están disponibles. Puedes regenerar individualmente desde el panel.');
    const csv=decryptCredentials(stored,credentialKey);
    await event(null,null,'credentials_downloaded','admin');
    res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="CLAVES_PRIVADAS_DOCENTE.csv"','Cache-Control':'no-store','Content-Length':String(csv.length)});
    return res.end(csv);
   }
   const p=path.join(path.dirname(dbFile),'CLAVES_PRIVADAS_DOCENTE.csv');
   if(!fs.existsSync(p))return err(res,404,'Las claves iniciales no están disponibles. Puedes regenerar individualmente desde el panel.');
   await event(null,null,'credentials_downloaded','admin');
   res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="CLAVES_PRIVADAS_DOCENTE.csv"','Cache-Control':'no-store'});return fs.createReadStream(p).pipe(res);
  }
  if(pathname.startsWith('/api/'))return err(res,404,'Ruta no encontrada.');
  if(method!=='GET'&&method!=='HEAD')return err(res,405,'Método no permitido.');
  serveStatic(req,res,pathname);
 }catch(e){console.error(e);if(!res.headersSent)err(res,500,'Ocurrió un error del servidor.');else res.end()}
});

if(require.main===module){
 initialization.then(()=>{
  takeBackup();
  if(!CLOUD)setInterval(takeBackup,24*60*60*1000);
  server.listen(PORT,HOST,()=>{
   console.log(`Plataforma vocacional: http://${HOST}:${PORT}`);
   if(DEMO_MODE) console.log('Modo demostración LOCAL: alumno D00 / 123456. Docente: contraseña institucional configurada.');
   console.log(CLOUD?'Persistencia PostgreSQL de Supabase habilitada.':'Modo SQLite local.');
  });
 }).catch(()=>process.exitCode=1);
}
module.exports={server,db,initialization,config:{CLOUD,DEMO_MODE}};
