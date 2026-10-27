const test=require('node:test');
const assert=require('node:assert/strict');
const {QUESTIONS,CATEGORIES,ROSTER,calcScores}=require('../catalog');
test('Catálogo completo: 50 preguntas sin repeticiones y 60 estudiantes',()=>{
 assert.equal(QUESTIONS.length,50);
 assert.equal(ROSTER.A.length,30);assert.equal(ROSTER.B.length,30);
 assert.equal(CATEGORIES.length,5);
 const nums=CATEGORIES.flatMap(c=>c.numbers);
 assert.equal(nums.length,50);assert.equal(new Set(nums).size,50);
 assert.deepEqual([...nums].sort((a,b)=>a-b),Array.from({length:50},(_,i)=>i+1));
});
test('Puntuación: cada me interesa suma en su especialidad',()=>{
 const rows=Array.from({length:50},(_,i)=>({question_number:i+1,choice:[3,5,22,24,28,30,35,39,48,50].includes(i+1)?1:0}));
 const s=calcScores(rows);
 assert.deepEqual(s.scores,{diseno:2,software:8,turismo:0,ciencias:0,gestion:0});
 assert.equal(s.positives,10);assert.equal(s.negatives,40);assert.deepEqual(s.top,['software']);
});
test('Empates de primer lugar se conservan',()=>{
 const rows=Array.from({length:50},(_,i)=>({question_number:i+1,choice:[...CATEGORIES[0].numbers,...CATEGORIES[1].numbers].includes(i+1)?1:0}));
 assert.deepEqual(calcScores(rows).top,['diseno','software']);
});
