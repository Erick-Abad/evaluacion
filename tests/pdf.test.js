const test=require('node:test');
const assert=require('node:assert/strict');
const {QUESTIONS,CAT_OF_NUMBER,calcScores}=require('../catalog');
const {createPdf}=require('../pdf_report');
function makeReport(){const a=QUESTIONS.map((text,i)=>({number:i+1,text,category:CAT_OF_NUMBER[i+1],choice:i%2}));return {student:{name:'ALUMNO DE PRUEBA',code:'D00',class:'D'},evaluation:{id:17,completed_at:'2026-10-26 12:00:00'},scores:calcScores(a.map(x=>({question_number:x.number,choice:x.choice}))),allAnswers:a}}
test('PDF: documento A4 completo sin dependencias externas',()=>{const b=createPdf(makeReport());assert(b instanceof Buffer);assert(b.length>4000);assert.equal(b.subarray(0,8).toString('ascii'),'%PDF-1.4');assert(b.subarray(-7).toString().includes('%%EOF'));const n=b.toString('latin1').match(/\/Type \/Page \/Parent/g);assert(n&&n.length>=2)});
test('PDF: no emite un informe final incompleto',()=>{const r=makeReport();r.allAnswers[8].choice=null;assert.throws(()=>createPdf(r),/evaluación completa/)});
