'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {DatabaseSync,backup}=require('node:sqlite');
const {QUESTIONS,CATEGORIES,ROSTER,CAT_OF_NUMBER,calcScores}=require('./catalog');
const {createPdf}=require('./pdf_report');

const ROOT=__dirname;
const HOST=process.env.HOST||'127.0.0.1';
const PORT=Number(process.env.PORT||3000);
const DEMO_MODE=process.env.DEMO_MODE !== '0' && (HOST==='127.0.0.1'||HOST==='localhost');
// Clave indicada por la institución. Puede sustituirse mediante ADMIN_PASSWORD sin modificar código.
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD || '0504784075';
if(ADMIN_PASSWORD.length<10){
 console.error('ADMIN_PASSWORD debe tener al menos 10 caracteres.'); process.exit(1);
}
const dbFile=process.env.DB_PATH||path.join(ROOT,'data','vocacional.db');
fs.mkdirSync(path.dirname(dbFile),{recursive:true});
const db=new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(`CREATE TABLE IF NOT EXISTS students(
 code TEXT PRIMARY KEY, class TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL,
 salt TEXT NOT NULL, pin_hash TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS evaluations(
 id INTEGER PRIMARY KEY AUTOINCREMENT, student_code TEXT NOT NULL REFERENCES students(code),
 status TEXT NOT NULL CHECK(status IN ('active','completed','restarted')),
 started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT,
 reset_by TEXT, reset_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_evaluation ON evaluations(student_code) WHERE status='active';
CREATE TABLE IF NOT EXISTS answers(
 id INTEGER PRIMARY KEY AUTOINCREMENT, evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
 question_number INTEGER NOT NULL CHECK(question_number>=1 AND question_number<=50),
 choice INTEGER NOT NULL CHECK(choice IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(evaluation_id,question_number));
CREATE TABLE IF NOT EXISTS sessions(
 token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, student_code TEXT,
 expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT, student_code TEXT, evaluation_id INTEGER,
 action TEXT NOT NULL, actor TEXT NOT NULL, details TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);

function hashPin(pin,salt){return crypto.scryptSync(String(pin),salt,64).toString('hex')}
function safeEqual(a,b){const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function randomPin(){return String(crypto.randomInt(100000,1000000))}
function addStudent(code,className,position,name,pin,demo=0){
 const salt=crypto.randomBytes(16).toString('hex');
 db.prepare('INSERT OR IGNORE INTO students(code,class,position,name,salt,pin_hash,demo) VALUES(?,?,?,?,?,?,?)').run(code,className,position,name,salt,hashPin(pin,salt),demo);
}
if(db.prepare('SELECT COUNT(*) AS n FROM students').get().n===0){
 const lines=['Código,Paralelo,Número,Estudiante,PIN'];
 for(const cl of ['A','B']) ROSTER[cl].forEach((name,i)=>{
  const code=`${cl}${String(i+1).padStart(2,'0')}`; const pin=randomPin();
  addStudent(code,cl,i+1,name,pin);
  lines.push([code,cl,i+1,`"${name.replace(/"/g,'""')}"`,pin].join(','));
 });
 const secretFile=path.join(path.dirname(dbFile),'CLAVES_PRIVADAS_DOCENTE.csv');
 fs.writeFileSync(secretFile,'\ufeff'+lines.join('\r\n'),'utf8');
 fs.chmodSync(secretFile,0o600);
 console.log('Se crearon 60 estudiantes. Claves iniciales privadas en: '+secretFile);
}
if(DEMO_MODE) addStudent('D00','D',0,'ESTUDIANTE DE PRUEBA','123456',1);

// Respaldo local consistente al iniciar y una vez al día mientras el servidor esté encendido.
// Complementar obligatoriamente con una copia cifrada y automatizada fuera del equipo.
let backupBusy=false;
async function takeBackup(){
 if(backupBusy)return;
 backupBusy=true;
 const dir=path.join(path.dirname(dbFile),'backups');
 fs.mkdirSync(dir,{recursive:true});
 const day=new Date().toISOString().slice(0,10);
 const dest=path.join(dir,`vocacional-${day}.sqlite`);
 const temp=dest+'.tmp';
 try{
  if(fs.existsSync(temp))fs.unlinkSync(temp);
  await backup(db,temp);
  fs.renameSync(temp,dest);
  const archived=fs.readdirSync(dir).filter(f=>/^vocacional-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort();
  for(const old of archived.slice(0,Math.max(0,archived.length-14)))fs.unlinkSync(path.join(dir,old));
  console.log('Respaldo local creado: '+dest);
 }catch(e){console.error('ATENCIÓN: no se pudo crear respaldo local:',e.message)}
 finally{backupBusy=false}
}


function getCurrent(code){
 return db.prepare("SELECT * FROM evaluations WHERE student_code=? AND status IN ('active','completed') ORDER BY id DESC LIMIT 1").get(code);
}
function ensureCurrent(code){let e=getCurrent(code);if(!e){
 const r=db.prepare("INSERT INTO evaluations(student_code,status) VALUES(?,'active')").run(code);
 e=db.prepare('SELECT * FROM evaluations WHERE id=?').get(r.lastInsertRowid);
}return e}
function getAnswers(id){return db.prepare('SELECT question_number,choice,created_at FROM answers WHERE evaluation_id=? ORDER BY question_number').all(id)}
function summary(code,create=true){
 const student=db.prepare('SELECT code,class,position,name,demo FROM students WHERE code=?').get(code);
 const e=create?ensureCurrent(code):getCurrent(code);
 const rows=e?getAnswers(e.id):[]; const scores=calcScores(rows);
 return {student,evaluation:{id:e?.id||null,status:e?.status||'pending',started_at:e?.started_at||null,completed_at:e?.completed_at||null,current:Math.min(rows.length+1,50)},progress:rows.length, scores:e?.status==='completed'?scores:null,
  question:e?.status==='active'?{number:rows.length+1,text:QUESTIONS[rows.length]}:null};
}
function event(code,id,action,actor,details=''){
 db.prepare('INSERT INTO audit_events(student_code,evaluation_id,action,actor,details) VALUES(?,?,?,?,?)').run(code,id,action,actor,details);
}
function newSession(res,role,studentCode=null,req){
 const token=crypto.randomBytes(32).toString('hex');const h=crypto.createHash('sha256').update(token).digest('hex');
 db.prepare('INSERT INTO sessions(token_hash,role,student_code,expires_at) VALUES(?,?,?,?)').run(h,role,studentCode,Date.now()+8*60*60*1000);
 const secure=req.socket.encrypted?'; Secure':'';
 res.setHeader('Set-Cookie',`voc_sess=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
}
function session(req){
 const cookie=req.headers.cookie||'';const m=cookie.match(/(?:^|;\s*)voc_sess=([a-f0-9]{64})(?:;|$)/);
 if(!m)return null;
 const h=crypto.createHash('sha256').update(m[1]).digest('hex');
 return db.prepare('SELECT role,student_code FROM sessions WHERE token_hash=? AND expires_at>?').get(h,Date.now())||null;
}
function removeSession(req,res){
 const m=(req.headers.cookie||'').match(/(?:^|;\s*)voc_sess=([a-f0-9]{64})(?:;|$)/);
 if(m)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(m[1]).digest('hex'));
 res.setHeader('Set-Cookie','voc_sess=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
function err(res,code,message){json(res,code,{error:message})}
function readJson(req){return new Promise((resolve,reject)=>{
 let data='';req.on('data',chunk=>{data+=chunk;if(data.length>50000){reject(Error('Solicitud demasiado grande'));req.destroy()}});
 req.on('end',()=>{try{resolve(data?JSON.parse(data):{})}catch(e){reject(Error('JSON inválido'))}});req.on('error',reject);
})}
const attempts=new Map();
function loginAllowed(ip){const r=attempts.get(ip);return !r || r.until<Date.now()||r.count<8}
function loginFailed(ip){const r=attempts.get(ip)||{count:0,until:Date.now()+15*60*1000};if(r.until<Date.now()){r.count=0;r.until=Date.now()+15*60*1000}r.count++;attempts.set(ip,r)}
function csvEscape(s){let text=String(s??'');if(/^[=+@\-]/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`}
function adminRows(){
 const students=db.prepare('SELECT code,class,position,name,demo FROM students WHERE demo=0 ORDER BY class,position').all();
 return students.map(s=>{
 const e=getCurrent(s.code);const a=e?getAnswers(e.id):[];
 const scores=e&&e.status==='completed'?calcScores(a):null;
 return {...s,status:e?.status||'pending',progress:a.length,completed_at:e?.completed_at||null,scores};
 });
}
function fullReport(code,create=false){
 const s=summary(code,create),e=getCurrent(code),rows=e?getAnswers(e.id):[],map=Object.fromEntries(rows.map(r=>[r.question_number,r.choice]));
 return {...s,allAnswers:QUESTIONS.map((text,i)=>({number:i+1,text,category:CAT_OF_NUMBER[i+1],choice:map[i+1]??null}))};
}
function archivedCompletedReport(code,attempt){
 const student=db.prepare('SELECT code,class,position,name,demo FROM students WHERE code=?').get(code);
 const evaluation=db.prepare('SELECT id,status,started_at,completed_at FROM evaluations WHERE id=? AND student_code=?').get(attempt,code);
 if(!student||!evaluation||!evaluation.completed_at)return null;
 const rows=getAnswers(evaluation.id);
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
function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v}catch(e){db.exec('ROLLBACK');throw e}}

const server=http.createServer(async(req,res)=>{
 securityHeaders(res);
 const pathname=new URL(req.url,'http://localhost').pathname;
 const method=req.method;
 try{
  if(pathname==='/api/config'&&method==='GET')return json(res,200,{institution:'Miguel Febres Cordero',year:'2026–2027',students:60,questions:50,categories:CATEGORIES.map(({numbers,...c})=>c),demo:DEMO_MODE});
  if(pathname==='/api/login'&&method==='POST'){
   if(!loginAllowed(req.socket.remoteAddress))return err(res,429,'Demasiados intentos. Intenta más tarde.');
   const body=await readJson(req);
   if(body.role==='admin'){
    if(!safeEqual(body.password||'',ADMIN_PASSWORD)){loginFailed(req.socket.remoteAddress);return err(res,401,'Credenciales incorrectas.');}
    newSession(res,'admin',null,req);return json(res,200,{ok:true,role:'admin'});
   }
   const code=String(body.code||'').trim().toUpperCase();
   const student=db.prepare('SELECT code,salt,pin_hash,demo FROM students WHERE code=?').get(code);
   if(!student || (student.demo&&!DEMO_MODE) || !safeEqual(hashPin(body.pin||'',student.salt),student.pin_hash)){
    loginFailed(req.socket.remoteAddress);return err(res,401,'Código o clave incorrectos.');
   }
   ensureCurrent(code);newSession(res,'student',code,req);return json(res,200,{ok:true,role:'student'});
  }
  if(pathname==='/api/logout'&&method==='POST'){removeSession(req,res);return json(res,200,{ok:true})}
  const sess=session(req);
  if(pathname==='/api/session'&&method==='GET')return json(res,200,sess?{authenticated:true,...sess,student:sess.role==='student'?summary(sess.student_code):null}:{authenticated:false});
  if(!sess&&pathname.startsWith('/api/'))return err(res,401,'Inicia sesión.');
  if(pathname==='/api/answer'&&method==='POST'){
   if(sess.role!=='student')return err(res,403,'Acceso denegado.');
   const body=await readJson(req),num=Number(body.number);
   if(!Number.isInteger(num)||![0,1].includes(body.choice))return err(res,400,'Respuesta inválida.');
   const code=sess.student_code;
   try{
    transaction(()=>{
     const e=ensureCurrent(code);if(e.status!=='active')throw Error('La evaluación ya fue finalizada.');
     const count=db.prepare('SELECT COUNT(*) AS n FROM answers WHERE evaluation_id=?').get(e.id).n;
     if(num!==count+1)throw Error('La pregunta anterior quedó bloqueada. No se permite retroceder ni editar respuestas.');
     db.prepare('INSERT INTO answers(evaluation_id,question_number,choice) VALUES(?,?,?)').run(e.id,num,body.choice);
     if(num===50){db.prepare("UPDATE evaluations SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);event(code,e.id,'completed','student');}
    });
    return json(res,200,summary(code));
   }catch(e){return err(res,409,e.message)}
  }
  if(pathname==='/api/restart'&&method==='POST'){
   if(sess.role!=='student')return err(res,403,'Acceso denegado.');
   const b=await readJson(req);if(b.confirm!=='REINICIAR')return err(res,400,'Debes confirmar el reinicio.');
   try{transaction(()=>{
    const e=ensureCurrent(sess.student_code);if(e.status==='completed')throw Error('Evaluación finalizada: solo el docente puede autorizar otro intento.');
    db.prepare("UPDATE evaluations SET status='restarted',reset_by='student',reset_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);
    event(sess.student_code,e.id,'restarted','student','Nuevo intento desde la primera pregunta');
    db.prepare("INSERT INTO evaluations(student_code,status) VALUES(?,'active')").run(sess.student_code);
   });return json(res,200,summary(sess.student_code));}catch(e){return err(res,409,e.message)}
  }
  if(pathname==='/api/report'&&method==='GET'){
   if(sess.role!=='student')return err(res,403,'Acceso denegado.');
   const s=fullReport(sess.student_code);if(s.evaluation.status!=='completed')return err(res,403,'Completa primero las 50 preguntas.');
   return json(res,200,s);
  }
  if(pathname==='/api/report.pdf'&&method==='GET'){
   if(sess.role!=='student')return err(res,403,'Acceso denegado.');
   const e=getCurrent(sess.student_code);
   if(!e||e.status!=='completed')return err(res,403,'Completa las 50 preguntas antes de descargar el informe.');
   return sendPdf(res,archivedCompletedReport(sess.student_code,e.id));
  }
  if(pathname==='/api/admin/report.pdf'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const params=new URL(req.url,'http://localhost').searchParams;
   const code=params.get('code'),attempt=Number(params.get('attempt'));
   if(!/^[AB]\d{2}$/.test(code||'') || !Number.isSafeInteger(attempt)||attempt<1)return err(res,400,'Código de estudiante o intento inválido.');
   const report=archivedCompletedReport(code,attempt);
   if(!report)return err(res,404,'El intento solicitado no tiene 50 respuestas finalizadas.');
   event(code,attempt,'pdf_downloaded','admin');
   return sendPdf(res,report);
  }
  if(pathname==='/api/admin/overview'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   return json(res,200,{students:adminRows(),categories:CATEGORIES});
  }
  if(pathname==='/api/admin/student'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const code=new URL(req.url,'http://localhost').searchParams.get('code');
   if(!db.prepare('SELECT code FROM students WHERE code=? AND demo=0').get(code))return err(res,404,'Estudiante no encontrado.');
   const result=fullReport(code);result.history=db.prepare('SELECT id,status,started_at,completed_at,reset_by,reset_at FROM evaluations WHERE student_code=? ORDER BY id DESC').all(code);
   return json(res,200,result);
  }
  if(pathname==='/api/admin/reset'&&method==='POST'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const b=await readJson(req);const code=String(b.code||'').toUpperCase();
   if(b.confirm!=='REINICIAR'||!db.prepare('SELECT code FROM students WHERE code=? AND demo=0').get(code))return err(res,400,'Solicitud inválida.');
   transaction(()=>{
    const e=getCurrent(code);
    if(e){db.prepare("UPDATE evaluations SET status='restarted',reset_by='admin',reset_at=CURRENT_TIMESTAMP WHERE id=?").run(e.id);event(code,e.id,'restarted','admin',String(b.reason||'Reinicio autorizado').slice(0,200))}
    db.prepare("INSERT INTO evaluations(student_code,status) VALUES(?,'active')").run(code);
   });return json(res,200,{ok:true});
  }
  if(pathname==='/api/admin/reset-pin'&&method==='POST'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const b=await readJson(req),code=String(b.code||'').toUpperCase();
   const st=db.prepare('SELECT code FROM students WHERE code=? AND demo=0').get(code);
   if(!st)return err(res,404,'Estudiante no encontrado.');
   if(b.confirm!=='REGENERAR')return err(res,400,'Confirmación requerida.');
   const pin=randomPin(),salt=crypto.randomBytes(16).toString('hex');
   db.prepare('UPDATE students SET salt=?,pin_hash=? WHERE code=?').run(salt,hashPin(pin,salt),code);
   event(code,null,'pin_regenerated','admin');return json(res,200,{code,pin});
  }
  if(pathname==='/api/admin/export.csv'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const rows=adminRows();const cols=['Código','Paralelo','N°','Estudiante','Estado','Respondidas',...CATEGORIES.map(c=>c.name),'Mayor interés','Finalizado'];
   const csv='\ufeff'+[cols,...rows.map(s=>[s.code,s.class,s.position,s.name,s.status,s.progress,...CATEGORIES.map(c=>s.scores?.scores[c.key]??''),s.scores?.top.map(k=>CATEGORIES.find(c=>c.key===k).name).join(' / ')||'',s.completed_at||''])].map(a=>a.map(csvEscape).join(',')).join('\r\n');
   res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="resultados_vocacionales.csv"','Cache-Control':'no-store'});return res.end(csv);
  }
  if(pathname==='/api/admin/backup.sqlite'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const dir=path.join(path.dirname(dbFile),'backups');fs.mkdirSync(dir,{recursive:true});
   const tmp=path.join(dir,`export-${crypto.randomBytes(12).toString('hex')}.sqlite`);
   try{
    await backup(db,tmp);
    const bytes=fs.readFileSync(tmp);
    event(null,null,'backup_downloaded','admin');
    res.writeHead(200,{'Content-Type':'application/vnd.sqlite3',
     'Content-Disposition':`attachment; filename="respaldo_vocacional_${new Date().toISOString().slice(0,10)}.sqlite"`,
     'Content-Length':String(bytes.length),'Cache-Control':'private, no-store'});
    return res.end(bytes);
   }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
  }
  if(pathname==='/api/admin/credentials.csv'&&method==='GET'){
   if(sess.role!=='admin')return err(res,403,'Acceso denegado.');
   const p=path.join(path.dirname(dbFile),'CLAVES_PRIVADAS_DOCENTE.csv');
   if(!fs.existsSync(p))return err(res,404,'Las claves iniciales no están disponibles. Puedes regenerar individualmente desde el panel.');
   res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="CLAVES_PRIVADAS_DOCENTE.csv"','Cache-Control':'no-store'});return fs.createReadStream(p).pipe(res);
  }
  if(pathname.startsWith('/api/'))return err(res,404,'Ruta no encontrada.');
  if(method!=='GET'&&method!=='HEAD')return err(res,405,'Método no permitido.');
  serveStatic(req,res,pathname);
 }catch(e){console.error(e);if(!res.headersSent)err(res,500,'Ocurrió un error del servidor.');else res.end()}
});

if(require.main===module){
 takeBackup();
 setInterval(takeBackup,24*60*60*1000);
 server.listen(PORT,HOST,()=>{
 console.log(`Plataforma vocacional: http://${HOST}:${PORT}`);
 if(DEMO_MODE) console.log('Modo demostración LOCAL: alumno D00 / 123456. Docente: contraseña institucional configurada.');
 console.log('Para publicar: configura HOST, ADMIN_PASSWORD, HTTPS, políticas de respaldo y privacidad.');
});
}
module.exports={server,db};
