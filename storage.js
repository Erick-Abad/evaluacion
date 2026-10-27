'use strict';

const {AsyncLocalStorage}=require('node:async_hooks');

const schema={
 sqlite:`CREATE TABLE IF NOT EXISTS students(
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
CREATE TABLE IF NOT EXISTS login_attempts(
 ip TEXT PRIMARY KEY, count INTEGER NOT NULL, until_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT, student_code TEXT, evaluation_id INTEGER,
 action TEXT NOT NULL, actor TEXT NOT NULL, details TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
 postgres:`CREATE TABLE IF NOT EXISTS students(
 code TEXT PRIMARY KEY, class TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL,
 salt TEXT NOT NULL, pin_hash TEXT NOT NULL, demo SMALLINT NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS evaluations(
 id SERIAL PRIMARY KEY, student_code TEXT NOT NULL REFERENCES students(code),
 status TEXT NOT NULL CHECK(status IN ('active','completed','restarted')),
 started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMPTZ,
 reset_by TEXT, reset_at TIMESTAMPTZ);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_evaluation ON evaluations(student_code) WHERE status='active';
CREATE TABLE IF NOT EXISTS answers(
 id SERIAL PRIMARY KEY, evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
 question_number INTEGER NOT NULL CHECK(question_number>=1 AND question_number<=50),
 choice INTEGER NOT NULL CHECK(choice IN (0,1)), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(evaluation_id,question_number));
CREATE TABLE IF NOT EXISTS sessions(
 token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, student_code TEXT,
 expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts(
 ip TEXT PRIMARY KEY, count INTEGER NOT NULL, until_ms BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events(
 id SERIAL PRIMARY KEY, student_code TEXT, evaluation_id INTEGER,
 action TEXT NOT NULL, actor TEXT NOT NULL, details TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS initial_credentials(
 id INTEGER PRIMARY KEY CHECK(id=1), iv TEXT NOT NULL, auth_tag TEXT NOT NULL, ciphertext TEXT NOT NULL);`
};

function createStorage({mode,databaseUrl,sqlitePath}){
 if(mode==='postgres'){
  const {Pool}=require('pg');
  const pool=new Pool({
   connectionString:databaseUrl,
   max:2,
   idleTimeoutMillis:10000,
   connectionTimeoutMillis:10000,
   ssl:{rejectUnauthorized:true}
  });
  const transactions=new AsyncLocalStorage();
  const normalize=row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[
   key,value instanceof Date?value.toISOString().slice(0,19).replace('T',' '):value
  ]));
  function prepared(sql){
   let index=0;
   const text=sql.replace(/\?/g,()=>'$'+(++index));
   return {
    get:async(...args)=>{
     const row=(await (transactions.getStore()||pool).query(text,args)).rows[0];
     return row?normalize(row):row;
    },
    all:async(...args)=>(await (transactions.getStore()||pool).query(text,args)).rows.map(normalize),
    run:async(...args)=>{
     let statement=text;
     const isInsertEvaluation=/^\s*INSERT\s+INTO\s+evaluations\b/i.test(statement);
     if(isInsertEvaluation)statement+=' RETURNING id';
     const result=await (transactions.getStore()||pool).query(statement,args);
     return {changes:result.rowCount,lastInsertRowid:result.rows[0]?.id};
    }
   };
  }
  return {
   mode,
   prepare(sql){
    if(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql))sql=sql.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i,'INSERT INTO')+' ON CONFLICT DO NOTHING';
    return prepared(sql);
   },
   async exec(sql){await (transactions.getStore()||pool).query(sql)},
   async transaction(fn){
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     const result=await transactions.run(client,fn);
     await client.query('COMMIT');
     return result;
    }catch(error){
     await client.query('ROLLBACK');
     throw error;
    }finally{client.release()}
   },
   close(){return pool.end()}
  };
 }

 const {DatabaseSync}=require('node:sqlite');
 const sqlite=new DatabaseSync(sqlitePath);
 sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 return {
  mode,
  prepare(sql){
   const stmt=sqlite.prepare(sql);
   return {
    get:async(...args)=>stmt.get(...args),
    all:async(...args)=>stmt.all(...args),
    run:async(...args)=>{
     if(/^\s*INSERT\s+INTO\s+evaluations\b/i.test(sql)){
      const row=sqlite.prepare(sql+' RETURNING id').get(...args);
      return {changes:row?1:0,lastInsertRowid:row?.id};
     }
     return stmt.run(...args);
    }
   };
  },
  async exec(sql){sqlite.exec(sql)},
  async transaction(fn){
   sqlite.exec('BEGIN IMMEDIATE');
   try{const result=await fn();sqlite.exec('COMMIT');return result}
   catch(error){sqlite.exec('ROLLBACK');throw error}
  },
  raw:sqlite
 };
}

async function initializeStorage(db){
 await db.exec(schema[db.mode]);
}

function createSqliteSnapshot(){
 const {DatabaseSync}=require('node:sqlite');
 const snapshot=new DatabaseSync(':memory:');
 snapshot.exec(schema.sqlite);
 snapshot.exec(`CREATE TABLE initial_credentials(
 id INTEGER PRIMARY KEY CHECK(id=1), iv TEXT NOT NULL, auth_tag TEXT NOT NULL, ciphertext TEXT NOT NULL);`);
 return snapshot;
}

module.exports={createStorage,initializeStorage,createSqliteSnapshot};
