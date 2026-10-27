'use strict';
const app=document.getElementById('app');
const printArea=document.getElementById('print-area');
const CATS=[
 {key:'diseno',name:'Diseño Gráfico',short:'Diseño',color:'#8b64dc'},
 {key:'software',name:'Desarrollo de Software',short:'Software',color:'#2872d5'},
 {key:'turismo',name:'Turismo',short:'Turismo',color:'#00a498'},
 {key:'ciencias',name:'Ciencias',short:'Ciencias',color:'#d99434'},
 {key:'gestion',name:'Gestión Administrativa',short:'Gestión',color:'#e5747c'}
];
const icons={
 cap:'<path d="m2 10 10-5 10 5-10 5z"/><path d="M6 13v5c4 3 8 3 12 0v-5M22 10v8"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 clipboard:'<rect x="6" y="5" width="14" height="17" rx="2"/><path d="M9 5V3h8v2M9 11h8M9 16h8"/>',
 results:'<path d="M3 3v18h18M7 16l4-5 4 2 5-8"/>',
 logout:'<path d="M10 17l5-5-5-5M15 12H3M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',
 checkcircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-8h.01"/>',
 rotate:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
 printer:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 15h12v7H6z"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
 medal:'<circle cx="12" cy="8" r="5"/><path d="m8 12-2 10 6-3 6 3-2-10"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
 close:'<path d="M18 6 6 18M6 6l12 12"/>',
 arrowleft:'<path d="m14 6-6 6 6 6M8 12h13"/>',
 eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 bar:'<path d="M3 3v18h18M7 18v-6h3v6M13 18V7h3v11M19 18v-9h2"/>',
 hour:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 alert:'<path d="m12 3 10 18H2z"/><path d="M12 9v5m0 4h.01"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
 database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'
};
function ico(name,cls=''){return `<span class="icon ${cls}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.info}</svg></span>`}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shortName(n){let parts=String(n).split(' ');return parts.slice(-2).join(' ')}
function initials(n){return String(n).split(' ').slice(0,2).map(s=>s[0]||'').join('')}
function dateFmt(s){return s?new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',year:'numeric',month:'long',day:'numeric'}).format(new Date(s.includes('T')?s:s.replace(' ','T')+'Z')):'—'}
const state={config:null,role:null,loginTab:'student',summary:null,report:null,overview:null,answer:null,modal:null,search:'',classFilter:'Todos',adminDetail:null,toast:null,working:false};
async function request(url,method='GET',body){
 const res=await fetch(url,{method,headers:{...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 let data;try{data=await res.json()}catch{throw Error('No se pudo leer la respuesta del servidor')}
 if(!res.ok)throw Error(data.error||'Error de comunicación');return data;
}
function toast(msg,bad=false){const old=document.querySelector('.toast');if(old)old.remove();const el=document.createElement('div');el.className='toast'+(bad?' error-toast':'');el.textContent=msg;document.body.append(el);setTimeout(()=>el.remove(),4200)}
function brand(){return `<div class="brand"><div class="logo-mark">${ico('cap','lg')}</div><div><div class="brand-name">MIGUEL FEBRES<br>CORDERO</div><div class="brand-sub">ORIENTACIÓN VOCACIONAL</div></div></div>`}
function landing(){return `<div class="login-page"><section class="login-hero">${brand()}
 <div class="hero-body"><div class="hero-kicker">AÑO LECTIVO 2026 — 2027</div><h1>Tu futuro<br>comienza con<br><em>tus intereses.</em></h1><p>Descubre las áreas de estudio que más conectan contigo. Una evaluación sencilla, personal y diseñada para acompañarte en tu próxima etapa académica.</p>
 <div class="hero-badges"><div class="hero-stat"><b>50</b><span>Preguntas</span></div><div class="hero-stat"><b>05</b><span>Especialidades</span></div><div class="hero-stat"><b>02</b><span>Paralelos</span></div></div></div>
 <div class="hero-footer"><span>Unidad Educativa Miguel Febres Cordero</span><span>Décimo EGB · A y B</span></div></section>
 <section class="login-side"><div class="login-panel"><span class="tag">PLATAFORMA INSTITUCIONAL</span><h2>¡Hola! Bienvenido 👋</h2><p class="login-intro">Ingresa tus credenciales para continuar con la evaluación.</p>
 <div class="tab-switch"><button data-action="tab" data-value="student" class="${state.loginTab==='student'?'active':''}">${ico('cap','sm')} &nbsp;Estudiante</button><button data-action="tab" data-value="admin" class="${state.loginTab==='admin'?'active':''}">${ico('users','sm')} &nbsp;Docente</button></div>
 <form id="login-form">${state.loginTab==='student'?`<div class="field"><label for="code">Código de estudiante</label><input id="code" name="code" required autocomplete="username" placeholder="Ejemplo: A01 o B15" maxlength="3"></div><div class="field"><label for="pin">Clave de acceso</label><input id="pin" name="pin" type="password" required placeholder="Tu clave individual" autocomplete="current-password" inputmode="numeric" maxlength="12"></div>`:
 `<div class="field"><label for="password">Contraseña del docente</label><input id="password" name="password" type="password" required autocomplete="current-password" placeholder="Introduce la contraseña de administración"></div>`}
 <button type="submit" class="btn btn-primary btn-block" ${state.working?'disabled':''}>${ico('lock','sm')} ${state.loginTab==='student'?'Ingresar a mi evaluación':'Acceder al panel docente'} ${ico('arrow','sm')}</button></form>
 <div class="form-help">${ico('shield','sm')} <span>Acceso privado. Tus respuestas se almacenan en el sistema y no se muestran a tus compañeros.</span></div>
 ${state.config?.demo&&state.loginTab==='student'?`<div class="login-divider">PRUEBA DE LA PLATAFORMA</div><button class="btn btn-soft btn-block" data-action="demo-login">${ico('eye','sm')} Entrar como estudiante de prueba</button><div class="demo-note">El estudiante de prueba no pertenece a los 60 alumnos registrados.</div>`:''}
 <div class="login-lower">${ico('checkcircle','sm')} <span>Evaluación de 50 preguntas · Resultados individuales · Impresión A4</span></div></div></section></div>`}
function sidebar(role,selected){return `<aside class="sidebar">${brand()}<div class="sidebar-heading">MI ESPACIO</div><nav class="side-nav">
 ${role==='student'?`<button class="nav-item ${selected==='evaluation'?'active':''}" data-action="student-nav" data-page="evaluation">${ico('clipboard')} Evaluación</button><button class="nav-item ${selected==='report'?'active':''}" data-action="student-nav" data-page="report">${ico('results')} Mis resultados</button>`:
 `<button class="nav-item active">${ico('grid')} Panel general</button><button class="nav-item" data-action="download-csv">${ico('download')} Exportar resultados</button>`}</nav>
 <div class="side-bottom"><div class="side-note"><b>${role==='student'?'Un paso hacia tu futuro':'Gestión académica'}</b><p>${role==='student'?'Responde con sinceridad. No hay respuestas correctas ni incorrectas.':'Consulta el avance y los resultados de ambos paralelos.'}</p></div><button class="nav-item side-logout" data-action="logout">${ico('logout')} Cerrar sesión</button></div></aside>`}
function topbar(role,student){return `<header class="topbar"><div class="breadcrumbs">Inicio &nbsp; / &nbsp; <b>${role==='student'?'Mi evaluación':'Panel docente'}</b></div><div class="top-right"><span class="class-pill">${role==='student'?student?.class==='D'?'PRUEBA':`DÉCIMO ${esc(student?.class)}`:'DÉCIMOS A + B'}</span><span class="small muted">${role==='student'?esc(shortName(student?.name||'')):'Administrador'}</span><div class="avatar">${role==='student'?esc(initials(student?.name||'')):'AD'}</div></div></header>`}
function shell(body,role,nav='evaluation',student=null){return `<div class="app-shell">${sidebar(role,nav)}<main class="content">${topbar(role,student)}<div class="main-content">${body}</div></main></div>`}
function studentView(){const s=state.summary;if(!s)return `<div class="boot"><div class="spinner"></div></div>`;
 if(s.evaluation.status==='completed'){if(!state.report){loadReport();return shell('<div class="boot"><div class="spinner"></div></div>','student','report',s.student)}return renderResults(state.report)}
 const n=s.question.number,percent=Math.round((n-1)/50*100);
 return shell(`<div class="page-heading"><div><div class="eyebrow">TU RECORRIDO VOCACIONAL</div><h1>Encuentra lo que te apasiona.</h1><p>Lee cada afirmación y selecciona la opción que mejor represente tus intereses.</p></div><span class="tag">${ico('sun','sm')} &nbsp; TÓMATE TU TIEMPO</span></div>
 <div class="main-grid"><div class="card question-panel">
 <div class="progress-head"><span>Progreso de tu evaluación</span><span class="muted">${String(n-1).padStart(2,'0')} de 50 respondidas &nbsp; · &nbsp; ${percent}%</span></div>
 <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
 <div class="q-chip">PREGUNTA ${String(n).padStart(2,'0')} / 50</div>
 <h2 class="question-title">${esc(s.question.text)}</h2><p class="question-hint">Elige solamente una de las siguientes opciones:</p>
 <button class="answer-choice ${state.answer===1?'selected':''}" aria-pressed="${state.answer===1}" data-action="select-answer" data-choice="1"><span class="radio-circle"></span><span><strong>Me interesa</strong><small>Esta actividad despierta mi curiosidad o motivación</small></span></button>
 <button class="answer-choice ${state.answer===0?'selected':''}" aria-pressed="${state.answer===0}" data-action="select-answer" data-choice="0"><span class="radio-circle"></span><span><strong>No me interesa</strong><small>No es algo que me gustaría desarrollar o estudiar</small></span></button>
 <div class="question-actions"><div class="save-hint">${ico('shield','sm')} <span>Tu respuesta quedará guardada y bloqueada al avanzar.</span></div>
 <button class="btn btn-primary" data-action="submit-answer" ${state.answer===null||state.working?'disabled':''}>${n===50?'Finalizar evaluación':'Guardar y continuar'} ${ico('arrow','sm')}</button></div></div>
 <aside class="card side-card"><div><div class="info-icon">${ico('lock','lg')}</div><h3>Evaluación sin retroceso</h3><p>Una vez que guardes una respuesta y avances, no podrás modificar las preguntas anteriores. Elige con tranquilidad.</p>
 <div class="side-divider"></div><h3>Áreas de orientación</h3><div class="topic-list"><span>Diseño gráfico</span><span>Software</span><span>Turismo</span><span>Ciencias</span><span>Gestión</span></div></div>
 <div><div class="warning-box">${ico('info','sm')} <span>Si necesitas comenzar de nuevo, puedes reiniciar antes de finalizar. El sistema conservará un registro del intento anterior.</span></div><button class="btn btn-plain btn-block" style="margin-top:15px" data-action="open-restart">${ico('rotate','sm')} Reiniciar evaluación</button></div></aside></div>`,'student','evaluation',s.student)
}
function barRows(scores){return CATS.map(c=>`<div class="score-row"><div class="score-head"><span class="score-label"><i class="score-dot" style="--score:${c.color}"></i>${esc(c.name)}</span><span>${scores[c.key]} <span class="muted">/ 10 &nbsp;·&nbsp; ${scores[c.key]*10}%</span></span></div><div class="score-track"><div class="score-fill" style="--score:${c.color};--width:${scores[c.key]*10}%"></div></div></div>`).join('')}
function reviewItems(r){return r.allAnswers.map(a=>`<article class="review-item"><div class="review-num">${String(a.number).padStart(2,'0')}</div><div><div class="review-question">${esc(a.text)}</div><div class="review-cat">${esc(CATS.find(c=>c.key===a.category)?.name||'')}</div><div class="review-answer ${a.choice===1?'yes':a.choice===0?'no':''}">${a.choice===1?'✓ Me interesa':a.choice===0?'✕ No me interesa':'Sin responder'}</div></div></article>`).join('')}
function renderResults(r){const sc=r.scores,topNames=sc.top.map(k=>CATS.find(c=>c.key===k).name);
 return shell(`<div class="page-heading"><div><div class="eyebrow">TU EVALUACIÓN HA FINALIZADO</div><h1>¡Lo lograste! Estos son tus resultados.</h1><p>Tu perfil refleja tus intereses actuales, no un examen de conocimientos ni una decisión definitiva.</p></div><div class="report-buttons"><button class="btn btn-primary" data-action="download-student-pdf">${ico('download','sm')} Descargar PDF completo</button><button class="btn btn-soft" data-action="print-student">${ico('printer','sm')} Imprimir</button></div></div>
 <div class="welcome-card">${ico('checkcircle','xl')}<div><h3>¡Felicitaciones, ${esc(shortName(r.student.name))}!</h3><p>Completaste las 50 preguntas. Tus respuestas están registradas y puedes consultar tu informe cuando lo necesites.</p></div></div>
 <div class="metrics"><div class="card metric-card"><span class="label">Respuestas «Me interesa»</span><strong style="color:#138d79">${sc.positives}</strong><small>De 50 afirmaciones</small><div class="metric-icon">${ico('checkcircle')}</div></div>
 <div class="card metric-card"><span class="label">Respuestas «No me interesa»</span><strong>${sc.negatives}</strong><small>De 50 afirmaciones</small><div class="metric-icon">${ico('list')}</div></div>
 <div class="card metric-card"><span class="label">Preguntas completadas</span><strong>50<span style="font-size:15px;color:#9aaeba">/50</span></strong><small>Evaluación finalizada</small><div class="metric-icon">${ico('medal')}</div></div></div>
 <div class="result-grid"><div class="card results-card"><h2>Tu afinidad por especialidad</h2><p>Cada especialidad tiene 10 preguntas. Un punto por cada «Me interesa».</p>${barRows(sc.scores)}</div>
 <aside class="card best-card"><div class="badge-icon">${ico('medal','lg')}</div><h3>${topNames.length>1?'Tus principales intereses':'Tu mayor área de interés'}:<br>${esc(topNames.join(' y '))}</h3><p>${topNames.length>1?'Hay un empate en el mayor puntaje. Ambas áreas merecen explorarse.':'Esta especialidad obtuvo el mayor número de respuestas «Me interesa».'} Recuerda: el resultado es orientativo y no determina por sí solo tus aptitudes.</p><span class="badge">${Math.max(...Object.values(sc.scores))}/10 puntos</span></aside></div>
 <section class="card answers-card"><div class="page-heading" style="margin:0"><div><h2 style="margin:0 0 7px;font-size:19px">Revisa tus 50 respuestas</h2><p>Consulta lo que seleccionaste en cada pregunta. Las respuestas finales son de solo lectura.</p></div></div><div class="answer-list">${reviewItems(r)}</div></section>`,'student','report',r.student);
}
function rowsFiltered(){const all=state.overview?.students||[];const q=state.search.trim().toLowerCase();return all.filter(s=>(state.classFilter==='Todos'||s.class===state.classFilter)&&(!q||(s.name+' '+s.code).toLowerCase().includes(q)))}
function rowHtml(s){return `<tr><td><b>${esc(s.code)}</b></td><td><button class="rowlink" data-action="open-detail" data-code="${esc(s.code)}">${esc(s.name)}</button></td><td>Décimo ${esc(s.class)}</td><td><span class="status ${s.status}">${s.status==='completed'?'Finalizado':s.status==='active'?'En proceso':'Pendiente'}</span></td><td>${s.progress} / 50</td><td>${s.scores?esc(s.scores.top.map(k=>CATS.find(c=>c.key===k).short).join(' / ')):'—'}</td><td><button class="btn btn-soft btn-sm" data-action="open-detail" data-code="${esc(s.code)}">${ico('eye','sm')} Ver</button></td></tr>`}
function teacherView(){if(!state.overview)return shell('<div class="boot"><div class="spinner"></div></div>','admin');const rows=state.overview.students;
 const finished=rows.filter(x=>x.status==='completed').length,active=rows.filter(x=>x.status==='active').length,pending=rows.filter(x=>x.status==='pending').length;
 return shell(`<div class="page-heading"><div><div class="eyebrow">PANEL DE CONTROL DOCENTE</div><h1>Resumen de evaluaciones</h1><p>Seguimiento de estudiantes · Décimo de EGB, paralelos A y B.</p></div><div style="display:flex;gap:9px;flex-wrap:wrap"><button class="btn btn-soft" data-action="download-credentials">${ico('lock','sm')} Claves iniciales</button><button class="btn btn-soft" data-action="download-backup">${ico('database','sm')} Respaldar SQLite</button><button class="btn btn-primary" data-action="download-csv">${ico('download','sm')} Exportar CSV</button></div></div>
 <div class="metrics"><div class="card metric-card"><span class="label">Estudiantes inscritos</span><strong>60</strong><small>30 de A + 30 de B</small><div class="metric-icon">${ico('users')}</div></div>
 <div class="card metric-card"><span class="label">Evaluaciones finalizadas</span><strong style="color:#159078">${finished}</strong><small>${Math.round(finished/60*100)}% de estudiantes</small><div class="metric-icon">${ico('checkcircle')}</div></div>
 <div class="card metric-card"><span class="label">Pendientes / En proceso</span><strong>${pending} <span style="font-size:18px;color:#a1b0bd">/</span> ${active}</strong><small>Situación en tiempo real</small><div class="metric-icon">${ico('hour')}</div></div></div>
 <div class="admin-toolbar"><div class="filter-set">${['Todos','A','B'].map(c=>`<button data-action="filter-class" data-value="${c}" class="${state.classFilter===c?'active':''}">${c==='Todos'?'Todos':`Décimo ${c}`}</button>`).join('')}</div><label class="search-field">${ico('search','sm')}<input id="student-search" placeholder="Buscar estudiante o código..." value="${esc(state.search)}" aria-label="Buscar estudiante"></label></div>
 <div class="card table-card"><div class="table-top"><div><h2>Registro de estudiantes</h2><p>Abre un estudiante para ver sus resultados, progreso o autorizar reinicio.</p></div><span class="class-pill" id="row-count">${rowsFiltered().length} ESTUDIANTES</span></div>
 <div class="table-scroll"><table><thead><tr><th>Código</th><th>Estudiante</th><th>Paralelo</th><th>Estado</th><th>Progreso</th><th>Mayor interés</th><th>Acción</th></tr></thead><tbody id="student-rows">${rowsFiltered().map(rowHtml).join('')}</tbody></table></div>
 <div id="empty-list" class="empty" style="${rowsFiltered().length?'display:none':''}">No encontramos estudiantes con esos filtros.</div></div>
 <p class="demo-note">Los datos se guardan en el servidor. La calificación vocacional se calcula con 10 preguntas por especialidad. La exportación incluye los cinco puntajes por alumno.</p>`,'admin','dashboard')}
function renderModal(){const m=state.modal;if(!m)return '';
 if(m.type==='restart')return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-icon">${ico('alert','lg')}</div><h2>¿Reiniciar toda la evaluación?</h2><p>Volverás a la pregunta 1 y comenzarás sin respuestas seleccionadas. El intento anterior quedará registrado para fines de control. Esta acción no se puede deshacer.</p><div class="warning-box">${ico('info','sm')} <span>No podrás recuperar las respuestas del intento anterior desde tu cuenta.</span></div><div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-restart">${ico('rotate','sm')} Sí, reiniciar</button></div></div></div>`;
 if(m.type==='admin-reset')return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-icon">${ico('alert','lg')}</div><h2>Autorizar nuevo intento</h2><p>Se abrirá un intento nuevo para <b>${esc(m.name)}</b>. El intento actual pasará al historial y el estudiante podrá responder desde la pregunta 1.</p><div class="modal-actions"><button class="btn btn-ghost" data-action="open-detail" data-code="${esc(m.code)}">Cancelar</button><button class="btn btn-danger" data-action="confirm-admin-reset" data-code="${esc(m.code)}">Sí, autorizar</button></div></div></div>`;
 if(m.type==='pin')return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-icon">${ico('lock','lg')}</div><h2>Clave regenerada</h2><p>Entrega esta clave de manera privada al estudiante <b>${esc(m.code)}</b>. La clave anterior ya no funcionará.</p><div class="welcome-card"><h3 style="margin:0;letter-spacing:2px;font-size:25px">${esc(m.pin)}</h3><button class="btn btn-soft btn-sm" data-action="copy-pin">${ico('copy','sm')} Copiar</button></div><div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">Entendido</button></div></div></div>`;
 if(m.type==='confirm-pin')return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-icon">${ico('alert','lg')}</div><h2>¿Regenerar clave?</h2><p>La clave anterior de <b>${esc(m.code)}</b> dejará de funcionar. Tendrás que entregar la nueva en privado.</p><div class="modal-actions"><button class="btn btn-ghost" data-action="open-detail" data-code="${esc(m.code)}">Cancelar</button><button class="btn btn-danger" data-action="confirm-pin-reset" data-code="${esc(m.code)}">Regenerar</button></div></div></div>`;
 if(m.type==='detail'){
  const r=state.adminDetail;if(!r)return '';
  const done=r.evaluation.status==='completed',sc=r.scores;
  return `<div class="modal-backdrop"><div class="modal large" role="dialog" aria-modal="true"><div style="display:flex;align-items:start;justify-content:space-between;gap:10px"><div><div class="eyebrow">FICHA DEL ESTUDIANTE</div><h2 style="margin-top:8px">${esc(r.student.name)}</h2><p style="margin:0">Código ${esc(r.student.code)} · Décimo ${esc(r.student.class)}</p></div><button class="btn btn-soft btn-sm" aria-label="Cerrar" data-action="close-modal">${ico('close','sm')}</button></div>
  <div class="detail-meta"><div><b>${r.progress}<span style="font-size:12px">/50</span></b><span>Respuestas</span></div><div><b>${done?'100%':Math.round(r.progress/50*100)+'%'}</b><span>Avance</span></div><div><b>${r.history.length}</b><span>Intentos registrados</span></div></div>
  ${done?`<h3 style="font-size:13px">Resultados por especialidad</h3><div class="detail-scores">${CATS.map(c=>`<div><b>${sc.scores[c.key]}/10</b><span>${esc(c.short)}</span></div>`).join('')}</div><p>Mayor interés: <b>${esc(sc.top.map(k=>CATS.find(c=>c.key===k).name).join(' / '))}</b></p>`:`<div class="warning-box">${ico('hour','sm')} <span>${r.progress===0?'Aún no ha respondido ninguna pregunta.':'La evaluación está en curso. Los puntajes se muestran al finalizar las 50 preguntas.'}</span></div>`}
  ${done?`<h3 style="margin-top:22px;font-size:13px">Detalle de respuestas</h3><div style="max-height:230px;overflow:auto">${r.allAnswers.map(a=>`<div style="border-bottom:1px solid #e8eff3;padding:8px 0;font-size:11px"><b>${a.number}.</b> ${esc(a.text)} <strong style="color:${a.choice?'#16876b':'#a46e71'}">— ${a.choice?'Me interesa':'No me interesa'}</strong></div>`).join('')}</div>`:''}
  ${r.history.some(e=>e.completed_at)?`<div class="archived-reports"><h3>Constancias de intentos finalizados</h3><p>Los PDFs anteriores permanecen disponibles incluso después de reiniciar.</p>${r.history.filter(e=>e.completed_at).map(e=>`<button class="btn btn-soft btn-sm" data-action="download-admin-pdf" data-code="${esc(r.student.code)}" data-attempt="${e.id}">${ico('file','sm')} Intento ${e.id} · ${dateFmt(e.completed_at)} · PDF</button>`).join('')}</div>`:''}
  <div class="detail-actions"><button class="btn btn-soft btn-sm" data-action="show-admin-reset" data-code="${esc(r.student.code)}">${ico('rotate','sm')} Autorizar nuevo intento</button><button class="btn btn-soft btn-sm" data-action="show-pin-reset" data-code="${esc(r.student.code)}">${ico('lock','sm')} Regenerar clave</button>${done?`<button class="btn btn-primary btn-sm" data-action="download-admin-pdf" data-code="${esc(r.student.code)}" data-attempt="${r.evaluation.id}">${ico('download','sm')} Descargar PDF</button><button class="btn btn-soft btn-sm" data-action="print-admin">${ico('printer','sm')} Imprimir</button>`:''}</div>
  </div></div>`;
 }
 return '';
}
function render(){app.innerHTML=state.role==='student'?studentView():state.role==='admin'?teacherView():landing();const old=document.getElementById('active-modal');if(old)old.remove();if(state.modal){const el=document.createElement('div');el.id='active-modal';el.innerHTML=renderModal();document.body.append(el)}}
async function login(body){state.working=true;try{const result=await request('/api/login','POST',body);state.role=result.role;state.report=null;state.answer=null;await refresh();toast('Acceso correcto. ¡Bienvenido!')}catch(e){toast(e.message,true)}finally{state.working=false;render()}}
async function refresh(){if(state.role==='student'){const s=await request('/api/session');state.summary=s.student;if(s.student?.evaluation.status==='completed'){state.report=await request('/api/report')} }else if(state.role==='admin'){state.overview=await request('/api/admin/overview')}}
async function loadReport(){if(state.working)return;state.working=true;try{state.report=await request('/api/report')}catch(e){toast(e.message,true)}finally{state.working=false;render()}}
async function saveAnswer(){if(state.working||state.answer===null)return;state.working=true;
 try{const s=await request('/api/answer','POST',{number:state.summary.question.number,choice:state.answer});state.summary=s;state.answer=null;if(s.evaluation.status==='completed')state.report=await request('/api/report');render();toast('Respuesta guardada correctamente')}
 catch(e){toast(e.message,true);await refresh();render()}finally{state.working=false}}
function printReport(r){if(!r||r.evaluation.status!=='completed'){toast('El informe estará disponible al finalizar las 50 preguntas.',true);return}printArea.innerHTML=buildPrint(r);window.print()}
function buildPrint(r){const sc=r.scores;const top=sc.top.map(k=>CATS.find(c=>c.key===k).name).join(' / ');
 return `<div class="print-head"><div><p style="font-weight:bold;color:#165c83;letter-spacing:1.3px">UNIDAD EDUCATIVA MIGUEL FEBRES CORDERO</p><h1>Informe individual de orientación vocacional</h1><p>Año lectivo 2026–2027 · Décimo de Educación General Básica</p></div><div class="print-logo">MFC</div></div>
 <div class="print-grid"><div><b>Estudiante:</b> ${esc(r.student.name)}</div><div><b>Paralelo:</b> Décimo ${esc(r.student.class)}</div><div><b>Código:</b> ${esc(r.student.code)}</div><div><b>Fecha:</b> ${dateFmt(r.evaluation.completed_at)}</div></div>
 <div class="print-stats"><div><b>${sc.positives}</b>Me interesa</div><div><b>${sc.negatives}</b>No me interesa</div><div><b>50 / 50</b>Preguntas respondidas</div></div>
 <h2 class="print-section">Resultados por especialidad</h2><table class="print-score"><thead><tr><th>Especialidad</th><th>Puntaje</th><th>Porcentaje</th></tr></thead><tbody>${CATS.map(c=>`<tr><td>${esc(c.name)}</td><td>${sc.scores[c.key]} / 10</td><td>${sc.scores[c.key]*10}%</td></tr>`).join('')}</tbody></table>
 <p><b>Área(s) de mayor interés:</b> ${esc(top)}. <em>Este resultado describe intereses y no constituye una evaluación de aptitudes o una asignación obligatoria de especialidad.</em></p>
 <h2 class="print-section">Respuestas seleccionadas (50 preguntas)</h2>${r.allAnswers.map(a=>`<div class="print-answer"><b>${a.number}.</b><span>${esc(a.text)}</span><b>${a.choice===1?'Me interesa':'No me interesa'}</b></div>`).join('')}
 <div class="print-foot">Plataforma de evaluación vocacional · Documento individual generado a partir de las respuestas almacenadas. Uso académico interno y confidencial.</div>`}
async function init(){try{state.config=await request('/api/config');const s=await request('/api/session');if(s.authenticated){state.role=s.role;if(s.role==='student'){state.summary=s.student;if(s.student?.evaluation.status==='completed')state.report=await request('/api/report')}else state.overview=await request('/api/admin/overview')}render()}catch(e){app.innerHTML=`<div class="boot"><h2>No se pudo conectar con el servidor.</h2><p>${esc(e.message)}</p><button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div>`}}

app.addEventListener('submit',async ev=>{if(ev.target.id==='login-form'){ev.preventDefault();const f=new FormData(ev.target);if(state.loginTab==='student')await login({role:'student',code:String(f.get('code')).trim(),pin:String(f.get('pin'))});else await login({role:'admin',password:String(f.get('password'))})}});
app.addEventListener('input',ev=>{if(ev.target.id==='student-search'){state.search=ev.target.value;const tbody=document.getElementById('student-rows');if(tbody)tbody.innerHTML=rowsFiltered().map(rowHtml).join('');document.getElementById('row-count').textContent=rowsFiltered().length+' ESTUDIANTES';document.getElementById('empty-list').style.display=rowsFiltered().length?'none':''}});
async function action(ev){const t=ev.target.closest('[data-action]');if(!t)return;ev.preventDefault();const a=t.dataset.action;
 try{
 if(a==='tab'){state.loginTab=t.dataset.value;render()}
 else if(a==='demo-login'&&state.loginTab==='student'){await login({role:'student',code:'D00',pin:'123456'})}
 else if(a==='select-answer'){state.answer=Number(t.dataset.choice);render()}
 else if(a==='submit-answer'){await saveAnswer()}
 else if(a==='student-nav'){if(t.dataset.page==='report'&&state.summary?.evaluation.status!=='completed'){toast('Tu informe estará listo después de completar las 50 respuestas.');return}render()}
 else if(a==='open-restart'){state.modal={type:'restart'};render()}
 else if(a==='close-modal'){state.modal=null;render()}
 else if(a==='confirm-restart'){const s=await request('/api/restart','POST',{confirm:'REINICIAR'});state.summary=s;state.answer=null;state.report=null;state.modal=null;render();toast('Evaluación reiniciada. Comienzas en la pregunta 1.')}
 else if(a==='logout'){await request('/api/logout','POST');state.role=null;state.summary=null;state.overview=null;state.report=null;state.modal=null;state.answer=null;render()}
 else if(a==='print-student'){printReport(state.report)}
 else if(a==='download-student-pdf'){window.location='/api/report.pdf'}
 else if(a==='filter-class'){state.classFilter=t.dataset.value;render()}
 else if(a==='download-csv'){window.location='/api/admin/export.csv'}
 else if(a==='download-backup'){window.location='/api/admin/backup.sqlite';toast('Se generó una copia de la base local. Guárdala en un lugar seguro.')}
 else if(a==='download-credentials'){window.location='/api/admin/credentials.csv';toast('Este archivo contiene claves privadas. Guárdalo de manera segura.')}
 else if(a==='open-detail'){const r=await request('/api/admin/student?code='+encodeURIComponent(t.dataset.code));state.adminDetail=r;state.modal={type:'detail'};render()}
 else if(a==='show-admin-reset'){state.modal={type:'admin-reset',code:t.dataset.code,name:state.adminDetail.student.name};render()}
 else if(a==='show-pin-reset'){state.modal={type:'confirm-pin',code:t.dataset.code};render()}
 else if(a==='confirm-admin-reset'){await request('/api/admin/reset','POST',{code:t.dataset.code,confirm:'REINICIAR',reason:'Autorizado desde panel docente'});state.modal=null;state.adminDetail=null;state.overview=await request('/api/admin/overview');render();toast('Se autorizó un nuevo intento; el historial se conserva.')}
 else if(a==='confirm-pin-reset'){const r=await request('/api/admin/reset-pin','POST',{code:t.dataset.code,confirm:'REGENERAR'});state.modal={type:'pin',code:r.code,pin:r.pin};render()}
 else if(a==='copy-pin'){if(navigator.clipboard){await navigator.clipboard.writeText(state.modal.pin);toast('Clave copiada')}
 else{toast('Copia esta clave de forma privada: '+state.modal.pin)}}
 else if(a==='print-admin'){printReport(state.adminDetail)}
 else if(a==='download-admin-pdf'){window.location='/api/admin/report.pdf?code='+encodeURIComponent(t.dataset.code)+'&attempt='+encodeURIComponent(t.dataset.attempt)}
 }catch(e){toast(e.message,true)}
}
app.addEventListener('click',action);
document.addEventListener('click',ev=>{if(ev.target.closest('#active-modal [data-action]'))action(ev);else if(ev.target.classList.contains('modal-backdrop')){state.modal=null;render()}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&state.modal){state.modal=null;render()}});
init();
