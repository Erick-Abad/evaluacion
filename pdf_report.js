'use strict';
// Generador de PDF A4 sin paquetes externos: utiliza fuentes estándar PDF Type 1.
// El PDF se crea en memoria a partir de las respuestas persistidas en SQLite.
const zlib=require('node:zlib');
const {CATEGORIES}=require('./catalog');
const W=595.28,H=841.89,M=39;
const INK='#1A394C',BLUE='#165C83',MUTED='#637B89',LIGHT='#EBF3F8',LINE='#D6E4EA',GREEN='#087B68',RED='#9D5A62';
const cp1252={0x20ac:128,0x201a:130,0x0192:131,0x201e:132,0x2026:133,0x2020:134,0x2021:135,0x02c6:136,0x2030:137,0x0160:138,0x2039:139,0x0152:140,0x017d:142,0x2018:145,0x2019:146,0x201c:147,0x201d:148,0x2022:149,0x2013:150,0x2014:151,0x02dc:152,0x2122:153,0x0161:154,0x203a:155,0x0153:156,0x017e:158,0x0178:159};
function winAnsi(s){const bytes=[];for(const char of String(s??'')){const c=char.codePointAt(0);bytes.push(c>=32&&c<=126?c:c>=160&&c<=255?c:cp1252[c]||63)}return Buffer.from(bytes)}
function pdfEscape(s){return Array.from(winAnsi(s),b=>b===40?'\\(':b===41?'\\)':b===92?'\\\\':b<32?'?':String.fromCharCode(b)).join('')}
function rgb(hex){const s=hex.replace('#','');return [0,2,4].map(i=>(parseInt(s.slice(i,i+2),16)/255).toFixed(3)).join(' ')}
function approxWidth(t,size,bold=false){let w=0;for(const ch of String(t)){let k=0.51;if('il.,:;|!'.includes(ch))k=.25;else if('mwMW@'.includes(ch))k=.80;else if('ABCDEFGHJKLMNOPQRSUVXYZ'.includes(ch))k=.65;else if('  '.includes(ch))k=.28;else if('ñÑáéíóúÁÉÍÓÚüÜ'.includes(ch))k=.52;w+=k}return w*size*(bold?1.04:1)}
function wrap(text,maxWidth,size=9,bold=false){const words=String(text).split(/\s+/).filter(Boolean),lines=[];let line='';for(const word of words){const candidate=line?line+' '+word:word;if(approxWidth(candidate,size,bold)>maxWidth&&line){lines.push(line);line=word}else line=candidate}if(line)lines.push(line);return lines.length?lines:['']}
function pdfDocument(pages){const objects=[null];const add=(buf)=>{objects.push(Buffer.isBuffer(buf)?buf:Buffer.from(String(buf),'latin1'));return objects.length-1};
 const catalog=add(''),rootPages=add('');const reg=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const refs=[];for(const page of pages){const body=Buffer.from(page,'latin1'),compressed=zlib.deflateSync(body);const stream=add(Buffer.concat([Buffer.from(`<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`,'ascii'),compressed,Buffer.from('\nendstream','ascii')]));const pageRef=add(`<< /Type /Page /Parent ${rootPages} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${reg} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R >>`);refs.push(pageRef)}
 objects[rootPages]=Buffer.from(`<< /Type /Pages /Kids [${refs.map(x=>`${x} 0 R`).join(' ')}] /Count ${refs.length} >>`,'ascii');objects[catalog]=Buffer.from(`<< /Type /Catalog /Pages ${rootPages} 0 R >>`,'ascii');
 const parts=[Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n','latin1')],offsets=[0];let offset=parts[0].length;
 for(let i=1;i<objects.length;i++){offsets.push(offset);const obj=Buffer.concat([Buffer.from(`${i} 0 obj\n`,'ascii'),objects[i],Buffer.from('\nendobj\n','ascii')]);parts.push(obj);offset+=obj.length}
 const startXref=offset;let xref=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
 for(let i=1;i<offsets.length;i++)xref+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
 xref+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;parts.push(Buffer.from(xref,'ascii'));
 return Buffer.concat(parts);
}
function createPdf(report){
 if(!report?.scores||!report.allAnswers||report.allAnswers.length!==50||report.allAnswers.some(a=>a.choice!==0&&a.choice!==1))throw Error('Solo se puede emitir un informe de una evaluación completa.');
 const pages=[];let commands=[],y=0;
 const cmd=s=>commands.push(s);
 const rect=(x,t,w,h,color)=>cmd(`${rgb(color)} rg ${x.toFixed(2)} ${(H-t-h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
 const line=(x1,t1,x2,t2,color=LINE,width=.7)=>cmd(`${rgb(color)} RG ${width} w ${x1.toFixed(2)} ${(H-t1).toFixed(2)} m ${x2.toFixed(2)} ${(H-t2).toFixed(2)} l S`);
 const text=(s,x,t,size=9,color=INK,bold=false)=>cmd(`BT /F${bold?2:1} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x.toFixed(2)} ${(H-t).toFixed(2)} Tm (${pdfEscape(s)}) Tj ET`);
 function header(first){rect(0,0,W,9,BLUE);text('UNIDAD EDUCATIVA MIGUEL FEBRES CORDERO',M,38,9.3,BLUE,true);text('EVALUACIÓN DE INTERESES VOCACIONALES  |  AÑO LECTIVO 2026-2027',M,55,8,MUTED);line(M,68,W-M,68);if(first){text('INFORME INDIVIDUAL',M,94,16,INK,true);text('Respuestas y afinidades por especialidad',M,114,10,MUTED);y=138}else{text('DETALLE DE RESPUESTAS · CONTINUACIÓN',M,91,11,BLUE,true);y=110}}
 function finish(){pages.push(commands.join('\n')+'\n');commands=[]}
 function next(first){if(commands.length)finish();header(first)}
 function sectionHeading(label){text(label,M,y,10.7,BLUE,true);y+=16}
 function infoField(label,value,x,t){text(label,x,t,8,MUTED,true);text(value,x,t+16,10,INK,true)}
 function answerHeader(){rect(M,y,W-2*M,26,LIGHT);text('Nº',M+9,y+17,8,BLUE,true);text('PREGUNTA',M+42,y+17,8,BLUE,true);text('ÁREA',M+325,y+17,8,BLUE,true);text('RESPUESTA',M+425,y+17,8,BLUE,true);y+=30}
 const fmtDate=s=>{if(!s)return 'No registrada';const m=String(s).match(/^(\d{4})-(\d\d)-(\d\d)/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(s)};
 const sc=report.scores;
 const top=sc.top.map(k=>CATEGORIES.find(c=>c.key===k)?.name||k).join(' / ');
 next(true);
 rect(M,y,W-2*M,72,'#F5F9FC');
 infoField('ESTUDIANTE',report.student.name,M+13,y+19);
 infoField('PARALELO',report.student.class==='D'?'Prueba':'Décimo '+report.student.class,M+13,y+52);
 infoField('CÓDIGO',report.student.code,340,y+19);
 infoField('FECHA DE FINALIZACIÓN',fmtDate(report.evaluation.completed_at),340,y+52);
 y+=88;
 const boxes=[['ME INTERESA',sc.positives,GREEN],['NO ME INTERESA',sc.negatives,RED],['RESPUESTAS',sc.positives+sc.negatives,BLUE]];
 const boxW=(W-2*M-18)/3;
 boxes.forEach(([title,count,color],i)=>{const x=M+i*(boxW+9);rect(x,y,boxW,57,LIGHT);text(title,x+11,y+16,8,MUTED,true);text(String(count)+' / 50',x+11,y+43,20,color,true)});
 y+=79;
 sectionHeading('RESULTADOS POR ESPECIALIDAD');
 rect(M,y,W-2*M,23,BLUE);text('ESPECIALIDAD',M+10,y+15,8,'#FFFFFF',true);text('PUNTAJE',M+376,y+15,8,'#FFFFFF',true);text('AFINIDAD',M+453,y+15,8,'#FFFFFF',true);y+=23;
 CATEGORIES.forEach((c,i)=>{rect(M,y,W-2*M,25,i%2===0?'#F5F9FC':'#FFFFFF');text(c.name,M+10,y+17,9,INK);text(`${sc.scores[c.key]} / 10`,M+376,y+17,9,INK,true);text(`${sc.scores[c.key]*10}%`,M+455,y+17,9,BLUE,true);line(M,y+25,W-M,y+25);y+=25});
 y+=17;
 const areaLines=wrap('Mayor afinidad declarada: '+top,W-2*M-18,9.6,true);
 rect(M,y,W-2*M,14+areaLines.length*15,LIGHT);
 areaLines.forEach((s,i)=>text(s,M+10,y+20+i*15,9.6,BLUE,true));
 y+=21+areaLines.length*15;
 const disclaimer='Este informe describe intereses declarados. No mide aptitudes ni determina una especialidad obligatoria.';
 wrap(disclaimer,W-2*M,8).forEach(s=>{text(s,M,y,8,MUTED);y+=11});y+=18;
 sectionHeading('REGISTRO DE LAS 50 PREGUNTAS Y RESPUESTAS');
 answerHeader();
 for(const a of report.allAnswers){const questionLines=wrap(a.text,273,8.8);const cat=CATEGORIES.find(c=>c.key===a.category);const area=(cat&&({diseno:'Diseño',software:'Software',turismo:'Turismo',ciencias:'Ciencias',gestion:'Gestión'}[cat.key]))||'Área';const height=Math.max(31,questionLines.length*12+13);
  if(y+height>H-70){next(false);answerHeader()}
  rect(M,y,W-2*M,height,a.number%2===0?'#F5F9FC':'#FFFFFF');
  text(String(a.number).padStart(2,'0'),M+8,y+18,8.6,BLUE,true);
  questionLines.forEach((s,i)=>text(s,M+42,y+17+i*12,8.8,INK));
  text(area,M+325,y+18,8.1,MUTED);
  text(a.choice===1?'Me interesa':'No me interesa',M+425,y+18,8.1,a.choice===1?GREEN:RED,true);
  line(M,y+height,W-M,y+height,LINE,.45);y+=height;
 }
 if(y+35<H-60){y+=21;text('Registro generado a partir de respuestas almacenadas en la base de datos local.',M,y,8,MUTED)}
 finish();
 const all=pages.length;
 // Añadir en cada página pie con folio, código de evaluación y clasificación de confidencialidad.
 const final=pages.map((content,i)=>{const temp=[];temp.push(`${rgb(LINE)} RG .7 w ${M} 47 m ${W-M} 47 l S`);temp.push(`BT /F1 7.3 Tf ${rgb(MUTED)} rg 1 0 0 1 ${M} 31 Tm (${pdfEscape('USO ACADÉMICO INTERNO · DOCUMENTO CONFIDENCIAL')}) Tj ET`);temp.push(`BT /F2 7.3 Tf ${rgb(BLUE)} rg 1 0 0 1 ${W-M-139} 31 Tm (${pdfEscape(`Intento ${report.evaluation.id}  |  Página ${i+1} de ${all}`)}) Tj ET`);return content+temp.join('\n')+'\n'});
 return pdfDocument(final);
}
module.exports={createPdf};
