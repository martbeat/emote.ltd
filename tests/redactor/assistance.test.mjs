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
 const pages=[{fragments:[fragment('Alex',10),fragment('Smith',70),fragment('not sensitive',140)]}];
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
