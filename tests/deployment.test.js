'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
test('Vercel startup rejects missing cloud secrets instead of using local demo defaults',()=>{
 const env={...process.env,VERCEL:'1'};
 delete env.DATABASE_URL;
 delete env.ADMIN_PASSWORD;
 delete env.CREDENTIALS_ENCRYPTION_KEY;
 delete env.DATABASE_CA_CERT_B64;
 const result=spawnSync(process.execPath,['-e',"require('./app_server')"],{cwd:root,env,encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/pooler de Supabase/);
});

test('Vercel startup requires a valid Supabase CA certificate',()=>{
 const env={...process.env,VERCEL:'1',
  DATABASE_URL:'postgresql://postgres.project:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ADMIN_PASSWORD:'a-long-test-password',
  CREDENTIALS_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64')};
 delete env.DATABASE_CA_CERT_B64;
 const result=spawnSync(process.execPath,['-e',"require('./app_server')"],{cwd:root,env,encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/DATABASE_CA_CERT_B64/);
});

test('Vercel routes requests to the Node API function',()=>{
 const config=require('../vercel.json');
 const pkg=require('../package.json');
 assert.deepEqual(config.routes,[{src:'/(.*)',dest:'/api/index.js'}]);
 assert.equal(config.functions['api/index.js'].includeFiles,'public/**');
 assert.equal(pkg.main,'api/index.js');
 assert.equal(fs.existsSync(path.join(root,'server.js')),false);
 assert.equal(fs.existsSync(path.join(root,'app_server.js')),true);
});

test('storage supports transactional SQLite operations for existing local installs',async()=>{
 const {createStorage,initializeStorage}=require('../storage');
 const db=createStorage({mode:'sqlite',sqlitePath:':memory:'});
 try{
  await initializeStorage(db);
  await db.prepare('INSERT INTO students(code,class,position,name,salt,pin_hash) VALUES(?,?,?,?,?,?)')
   .run('A01','A',1,'Estudiante','salt','hash');
  const id=await db.transaction(async()=>{
   const inserted=await db.prepare("INSERT INTO evaluations(student_code,status) VALUES(?,'active')").run('A01');
   await db.prepare('INSERT INTO answers(evaluation_id,question_number,choice) VALUES(?,?,?)').run(inserted.lastInsertRowid,1,1);
   return inserted.lastInsertRowid;
  });
  const answer=await db.prepare('SELECT question_number,choice FROM answers WHERE evaluation_id=?').get(id);
  assert.equal(answer.question_number,1);
  assert.equal(answer.choice,1);
 }finally{db.raw.close()}
});

test('cloud backup snapshot is a serializable in-memory SQLite database',()=>{
 const {createSqliteSnapshot}=require('../storage');
 const snapshot=createSqliteSnapshot();
 try{
  snapshot.prepare('INSERT INTO students(code,class,position,name,salt,pin_hash) VALUES(?,?,?,?,?,?)')
   .run('A01','A',1,'Estudiante','salt','hash');
  snapshot.prepare('INSERT INTO initial_credentials(id,iv,auth_tag,ciphertext) VALUES(1,?,?,?)')
   .run('iv','tag','encrypted');
  const bytes=snapshot.serialize();
  const restored=new (require('node:sqlite').DatabaseSync)(':memory:');
  try{
   restored.deserialize(bytes);
   assert.equal(restored.prepare('SELECT code FROM students').get().code,'A01');
   assert.equal(restored.prepare('SELECT ciphertext FROM initial_credentials').get().ciphertext,'encrypted');
  }finally{restored.close()}
 }finally{snapshot.close()}
});

test('initial cloud credentials are authenticated ciphertext at rest',()=>{
 const {encryptCredentials,decryptCredentials}=require('../credential_vault');
 const key=require('node:crypto').randomBytes(32);
 const csv='Código,Paralelo,PIN\r\nA01,A,846201';
 const encrypted=encryptCredentials(csv,key);
 assert.equal(encrypted.ciphertext.includes('846201'),false);
 assert.equal(decryptCredentials(encrypted,key).toString('utf8'),csv);
 assert.throws(()=>decryptCredentials({...encrypted,auth_tag:'00'.repeat(16)},key));
});

test('local HTTP workflows retain demo, session, answer, teacher, and credential delivery',async t=>{
 const envNames=['DB_PATH','HOST','DEMO_MODE','ADMIN_PASSWORD','VERCEL','PERSISTENCE'];
 const previous=Object.fromEntries(envNames.map(name=>[name,process.env[name]]));
 for(const name of ['VERCEL','PERSISTENCE'])delete process.env[name];
 const dbPath=path.join(__dirname,`.test-local-${process.pid}.sqlite`);
 process.env.DB_PATH=dbPath;
 process.env.HOST='127.0.0.1';
 process.env.DEMO_MODE='1';
 process.env.ADMIN_PASSWORD='test-local-admin-password';
 const {server,db,initialization}=require('../app_server');
 await initialization;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{
  await new Promise(resolve=>server.close(resolve));
  db.raw.close();
  for(const file of [dbPath,dbPath+'-wal',dbPath+'-shm',path.join(__dirname,'CLAVES_PRIVADAS_DOCENTE.csv')]){
   if(fs.existsSync(file))fs.unlinkSync(file);
  }
  for(const name of envNames){
   if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];
  }
 });
 const config=await fetch(`${base}/api/config`).then(response=>response.json());
 assert.equal(config.demo,true);
 for(let i=0;i<8;i++){
  const response=await fetch(`${base}/api/login`,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.25'},body:JSON.stringify({role:'admin',password:'incorrecta'})});
  assert.equal(response.status,401);
 }
 const blocked=await fetch(`${base}/api/login`,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.25'},body:JSON.stringify({role:'admin',password:'test-local-admin-password'})});
 assert.equal(blocked.status,429);
 const studentLogin=await fetch(`${base}/api/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'D00',pin:'123456'})});
 assert.equal(studentLogin.status,200);
 const studentCookie=studentLogin.headers.get('set-cookie').split(';')[0];
 const answer=await fetch(`${base}/api/answer`,{method:'POST',headers:{'content-type':'application/json',cookie:studentCookie},body:JSON.stringify({number:1,choice:1})});
 assert.equal((await answer.json()).progress,1);
 const teacherLogin=await fetch(`${base}/api/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role:'admin',password:'test-local-admin-password'})});
 assert.equal(teacherLogin.status,200);
 const teacherCookie=teacherLogin.headers.get('set-cookie').split(';')[0];
 const overview=await fetch(`${base}/api/admin/overview`,{headers:{cookie:teacherCookie}}).then(response=>response.json());
 assert.equal(overview.students.length,60);
 const credentials=await fetch(`${base}/api/admin/credentials.csv`,{headers:{cookie:teacherCookie}});
 assert.equal(credentials.status,200);
 assert.match(await credentials.text(),/A01,A,1/);
});
