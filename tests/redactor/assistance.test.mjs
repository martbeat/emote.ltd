import test from 'node:test';
import assert from 'node:assert/strict';
import {assistText,assistPdf,makeLexicon,mergeAssist,batchAssist,parseTerms} from '../../js/redactor/assistance.js';
const lex=makeLexicon({givenNames:['alex','maria'],surnames:['smith','garcia']});
const base={identifiers:false,addresses:false,names:'off'};
const fragment=(text,x=10)=>({text,rect:{x,y:10,width:100,height:14}});
test('conservative names use local lexicon and contextual labels, broad mode adds candidates',()=>{
 const text='Alex Smith attended. Witness: Maria Garcia. Purple Elephant attended. Reading Borough Council.';
 const conservative=assistText(text,{...base,names:'conservative'},lex).matches.map(m=>text.slice(m.start,m.end));
 assert.ok(conservative.includes('Alex Smith'));assert.ok(conservative.includes('Maria Garcia'));assert.ok(!conservative.some(x=>x.includes('Purple')));assert.ok(!conservative.some(x=>x.includes('Council')));
 const broad=assistText(text,{...base,names:'broad'},lex).matches;
 assert.ok(broad.some(m=>text.slice(m.start,m.end)==='Purple Elephant'));
});
test('options keep dates and organisations opt-in, known terms match whitespace and whole tokens',()=>{
 const text='Contact alex@example.org at 21 Maple Road. Acme Limited met on 14/10/2026. Ann saw annual results. Alex\nSmith.';
 const usual=assistText(text,{names:'off'},lex).matches;
 assert.ok(usual.some(x=>x.type==='Email'));assert.ok(usual.some(x=>x.type==='Street address'));assert.ok(!usual.some(x=>x.type==='Date'||x.type==='Organisation'));
 const extras=assistText(text,{...base,companies:true,dates:true,terms:'Ann\nAlex Smith'},lex).matches;
 assert.ok(extras.some(x=>x.type==='Date'));assert.ok(extras.some(x=>x.type==='Organisation'));
 assert.equal(extras.filter(x=>x.type==='Supplied term').length,2);
});
test('names split over PDF fragments mark every source fragment and keep original bounds',()=>{
 const pages=[{fragments:[{...fragment('Alex',10),rect:{x:10,y:10,width:50,height:14}},{...fragment('Smith',70),rect:{x:70,y:10,width:60,height:14}},fragment('not sensitive',140)]}];
 const r=assistPdf(pages,{...base,terms:'Alex Smith'},lex);
 assert.equal(r.areas.length,2);assert.equal(r.areas[0].rect.x,10);assert.equal(r.areas[1].rect.x,70);
});
test('exclusions protect shared fragments from automatic over-redaction and report manual work',()=>{
 const pages=[{fragments:[fragment('Keep Council and alex@example.org'),fragment('sam@example.org',120)]}];
 const r=assistPdf(pages,{names:'off',exclusions:'Keep Council'});
 assert.equal(r.excludedFragments,1);assert.equal(r.areas.length,1);assert.equal(r.areas[0].rect.x,120);
});
test('unpositioned text is reported rather than silently treated as covered',()=>{
 const r=assistPdf([{fragments:[{text:'alex@example.org',rect:null}]}],{names:'off'});
 assert.equal(r.unlocatable,1);assert.equal(r.areas.length,0);
});
test('rescanning preserves decisions and manual areas without duplicate boxes',()=>{
 const old=[{id:'P1',page:0,rect:fragment('').rect,status:'redact',reason:'Reviewed',assistantType:'Email'},
 {id:'P2',page:0,rect:fragment('',120).rect,status:'pending',reason:'',assistantType:'Email'},
 {id:'P3',page:0,rect:fragment('',240).rect,status:'pending',reason:''}];
 const proposals=[10,120,240,360].map(x=>({page:0,rect:fragment('',x).rect,assistantType:'Email',hint:'New'}));
 const r=mergeAssist(old,proposals,4);assert.equal(r.marks.length,4);assert.equal(r.marks[0],old[0]);assert.equal(r.marks[1],old[2]);assert.equal(r.marks[2].id,'P4');assert.equal(r.nextId,6);
});
test('batch scope and groups change only pending automatic proposals with an explicit reason',()=>{
 const marks=[{id:'P1',page:0,status:'pending',assistantType:'Email'},{id:'P2',page:1,status:'pending',assistantType:'Email'},{id:'P3',page:0,status:'pending',assistantType:'Person name'},{id:'P4',page:0,status:'keep',assistantType:'Email',reason:'Keep'},{id:'P5',page:0,status:'pending'}];
 assert.throws(()=>batchAssist(marks,{types:['Email'],reason:'',action:'redact'}));
 const r=batchAssist(marks,{types:['Email'],page:0,reason:'Test identifiers',action:'redact'});
 assert.equal(r.changed,1);assert.equal(r.marks[0].status,'redact');assert.equal(r.marks[1].status,'pending');assert.equal(r.marks[3].reason,'Keep');assert.equal(r.marks[4].status,'pending');assert.equal(marks[0].status,'pending');
});
test('malformed or oversized term and lexicon inputs fail clearly',()=>{
 assert.throws(()=>parseTerms('x'.repeat(20001)));assert.throws(()=>parseTerms(Array.from({length:201},(_,i)=>`term ${i}`).join('\n')));assert.throws(()=>makeLexicon({givenNames:[],surnames:null}));
});

test('name inference handles heading prefixes and accented names without consuming adjacent labels',()=>{
 const text='Contact Alex Smith. Óscar Núñez arrived.';
 const lex=makeLexicon({givenNames:['alex','óscar'],surnames:['smith','núñez']});
 const names=assistText(text,{...base,names:'conservative'},lex).matches.map(m=>text.slice(m.start,m.end));
 assert.ok(names.includes('Alex Smith'));assert.ok(names.includes('Óscar Núñez'));
});
test('rescanning does not reintroduce a whole-fragment box over a manually adjusted region',()=>{
 const manual={id:'P1',page:0,rect:{x:10,y:10,width:30,height:14},status:'keep',reason:'Retained context'};
 const r=mergeAssist([manual],[{page:0,rect:{x:10,y:10,width:130,height:14},assistantType:'Email',hint:'Candidate'}],2);
 assert.equal(r.marks.length,1);assert.equal(r.skipped,1);
});

test('overlapping new fragments remain marked so both portions of a split name are covered',()=>{
 const proposals=[{page:0,rect:{x:10,y:10,width:100,height:14},assistantType:'Person name',hint:'Alex Smith'},{page:0,rect:{x:70,y:10,width:100,height:14},assistantType:'Person name',hint:'Alex Smith'}];
 assert.equal(mergeAssist([],proposals,1).marks.length,2);
});

const formLex=makeLexicon({givenNames:['amelia','aisha','sofia','patel'],surnames:['patel']});
const formText='Record everyone’s approval of this Resource Commission (RC) form:\nProject/Programme Sponsor\nAmelia Fenwickson EXAMPLE\nAisha Patel\nClick to enter date.\nPMO & Change Delivery Management\nSofia Brackenmoor - Strategic Lead for Change Delivery (PMO & CD Team Manager)\nFOR INTERNAL PMO & CD TEAM USE\nInternal approval to allocate team member(s)';
test('balanced finds the three names in a synthetic approval form without its headings or affiliation suffix',()=>{
 const names=assistText(formText,{names:'balanced'},formLex).matches.filter(m=>m.type==='Person name').map(m=>formText.slice(m.start,m.end));
 assert.deepEqual(names,['Amelia Fenwickson','Aisha Patel','Sofia Brackenmoor']);
 const conservative=assistText(formText,{names:'conservative'},formLex).matches.filter(m=>m.type==='Person name').map(m=>formText.slice(m.start,m.end));
 assert.deepEqual(conservative,['Aisha Patel']);
});
test('balanced is the default and role headings do not become name matches',()=>{
 assert.ok(assistText('Amelia Fenwickson. Sofia Brackenmoor.',{},formLex).matches.some(m=>m.type==='Person name'));
 const text='Name: Resource Commission. May Budget. Project Programme Sponsor. Strategic Lead. Internal Approval. Amelia Example Trust.';
 const lex=makeLexicon({givenNames:['may','amelia'],surnames:[]});
 assert.deepEqual(assistText(text,{names:'balanced'},lex).matches.filter(m=>m.type==='Person name'),[]);
});
test('balanced supports unknown names with explicit context, initials, particles and missing surnames',()=>{
 const text='Witness: Qiana Zorwick. Sofia A. Brackenmoor. Amelia van der Fenwickson.';
 const names=assistText(text,{names:'balanced'},formLex).matches.filter(m=>m.type==='Person name').map(m=>text.slice(m.start,m.end));
 assert.ok(names.includes('Qiana Zorwick'));assert.ok(names.includes('Sofia A. Brackenmoor'));assert.ok(names.includes('Amelia van der Fenwickson'));
});
test('PDF layout prevents candidates spanning unrelated table columns or distant rows',()=>{
 const f=(text,x,y,width)=>({text,rect:{x,y,width,height:12}});
 const pages=[{fragments:[f('Amelia',100,10,30),f('Fenwickson',135,10,55),f('EXAMPLE',200,10,30),f('Aisha Patel',100,100,80),f('Click to enter date.',350,100,110),f('Sofia Brackenmoor - Strategic Lead for',100,200,190),f('Change Delivery (PMO & CD',100,214,190),f('Team Manager)',100,228,100),f('Resource Commission',10,300,160)]}];
 const r=assistPdf(pages,{names:'balanced'},formLex);
 assert.equal(r.areas.length,4);assert.deepEqual(r.areas.map(a=>a.hint),['Amelia Fenwickson','Amelia Fenwickson','Aisha Patel','Sofia Brackenmoor']);
 const disconnected=assistPdf([{fragments:[f('Aisha',100,10,30),f('Patel',350,10,30)]}],{names:'balanced'},formLex);
 assert.equal(disconnected.areas.length,0);
});
test('adjacent line-wrapped names remain detectable while separate rows are not joined',()=>{
 const f=(text,y)=>({text,rect:{x:100,y,width:50,height:12}});
 assert.equal(assistPdf([{fragments:[f('Amelia',10),f('Fenwickson',24)]}],{names:'balanced'},formLex).areas.length,2);
 assert.equal(assistPdf([{fragments:[f('Amelia',10),f('Fenwickson',100)]}],{names:'balanced'},formLex).areas.length,0);
});
test('report-author and prepared-by fields find unfamiliar full names without dictionary entries',()=>{
 const lex=makeLexicon({givenNames:[],surnames:[]});
 for(const label of ['Report Author:','REPORT AUTHOR:','Author:','Prepared by:','Written by','Reviewed by:','Approved by:','Contact officer:']){
  const text=`${label}\nQiana Zorwick, Senior Auditor`;
  const names=assistText(text,{names:'balanced'},lex).matches.filter(m=>m.type==='Person name').map(m=>text.slice(m.start,m.end));
  assert.deepEqual(names,['Qiana Zorwick'],label);
 }
});
test('name plus job title supplies evidence but does not mark the job title as a name',()=>{
 const lex=makeLexicon({givenNames:[],surnames:[]});
 const text='Qiana Zorwick, Senior Auditor. Elora Fenwickson - Principal Solicitor. Resource Commission, Senior Manager.';
 const names=assistText(text,{names:'balanced'},lex).matches.filter(m=>m.type==='Person name').map(m=>text.slice(m.start,m.end));
 assert.deepEqual(names,['Qiana Zorwick','Elora Fenwickson']);
});
test('personal-field table labels bridge a wider cell gap without joining ordinary table columns',()=>{
 const f=(text,x,width)=>({text,rect:{x,y:10,width,height:12}}),lex=makeLexicon({givenNames:[],surnames:[]});
 const pages=[{fragments:[f('Report Author:',10,70),f('Qiana Zorwick',190,90),f(', Senior Auditor',280,100)]}];
 const found=assistPdf(pages,{names:'balanced'},lex);assert.equal(found.areas.length,1);assert.equal(found.areas[0].hint,'Qiana Zorwick');assert.equal(found.areas[0].rect.x,190);
 const ordinary=assistPdf([{fragments:[f('Qiana',10,40),f('Zorwick',190,90)]}],{names:'balanced'},makeLexicon({givenNames:['qiana'],surnames:[]}));assert.equal(ordinary.areas.length,0);
});
test('organisation and form-label values are not treated as authors solely because of the field',()=>{
 const lex=makeLexicon({givenNames:[],surnames:[]});
 for(const text of ['Report Author: Resource Commission','Report Author: Strategic Lead','Report Author: Qiana Zorwick Limited'])assert.equal(assistText(text,{names:'balanced'},lex).matches.filter(m=>m.type==='Person name').length,0);
});

test('textless pages become whole-page pending targets while readable pages keep text suggestions',()=>{
 const pages=[{width:600,height:800,fragments:[]},{width:600,height:800,fragments:[fragment('alex@example.org')]}];
 const result=assistPdf(pages,{names:'off'});
 assert.equal(result.areas.length,2);assert.equal(result.areas[0].assistantType,'Image page');
 assert.deepEqual(result.areas[0].rect,{x:0,y:0,width:600,height:800});
 const merged=mergeAssist([],result.areas,1);assert.ok(merged.marks.every(m=>m.status==='pending'&&m.reason===''));
 const plan=merged.marks;plan[0]={...plan[0],status:'keep',reason:'Reviewed image content'};
 const rescanned=mergeAssist(plan,result.areas,merged.nextId);assert.equal(rescanned.marks.length,2);assert.equal(rescanned.marks[0],plan[0]);
});
