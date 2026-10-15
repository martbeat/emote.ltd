import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as memory from '../../js/redactor/local-learning.js';
import * as reasons from '../../js/redactor/reason-presets.js';
import * as assistance from '../../js/redactor/assistance.js';
const root=new URL('../../',import.meta.url);
const engineSource=(await readFile(new URL('js/redactor/pdf-engine.js',root),'utf8')).replace(/^import[\s\S]*?;\n/gm,'').replace(/export /g,'').replaceAll('import.meta.url',JSON.stringify('https://example.test/js/redactor/pdf-engine.js')).replace('globalThis.PDFLib','PDFLib');
const engine=new Function('pdfjs','PDFLib',engineSource+';return {validateMarks,savePdfReview,restorePdfReview,PDF_LIMITS,PDF_VERSION,pixelRect};')({GlobalWorkerOptions:{}},{});
async function harness(){
 const dom=new JSDOM(await readFile(new URL('redactor-rbc.html',root),'utf8'),{url:'https://example.test/redactor-rbc.html'});
 const {window}=dom,document=window.document;
 const ctx={clearRect(){},drawImage(){},fillRect(){},strokeRect(){}};
 window.HTMLCanvasElement.prototype.getContext=()=>ctx;
 window.HTMLElement.prototype.scrollIntoView=()=>{};
 const pages=[{width:600,height:800,fragments:[{text:'Alex Smith',rect:{x:10,y:10,width:110,height:14}},{text:'alex@example.org',rect:{x:10,y:30,width:130,height:14}}]}, {width:600,height:800,fragments:[{text:'Maria Garcia',rect:{x:10,y:10,width:110,height:14}}]}];
 const source={pages,sourceHash:'a'.repeat(64),doc:{destroy:async()=>{}}};
 const dependencies={...engine,...assistance,...reasons,...memory,openPdf:async()=>source,renderPage:async()=>Object.assign(document.createElement('canvas'),{width:1200,height:1600}),buildRelease:async()=>({bytes:new Uint8Array([1]),sha256:'b'.repeat(64),doc:{destroy:async()=>{}}})};
 const code=(await readFile(new URL('js/redactor/pdf-app.js',root),'utf8')).replace(/^import[\s\S]*?;\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://example.test/js/redactor/pdf-app.js'));
 const fetch=async url=>({ok:true,text:async()=>JSON.stringify({givenNames:['alex','maria'],surnames:['smith','garcia']}),arrayBuffer:async()=>new ArrayBuffer(1)});
 const app=new Function('window','document','fetch',...Object.keys(dependencies),code+';return {state:()=>({marks,prepared,workingChecks,finalChecks,assistSettingsDirty}),loadFile};')(window,document,fetch,...Object.values(dependencies));
 const $=id=>document.getElementById(id);
 const change=(id,value,event='input')=>{$(id).value=value;$(id).dispatchEvent(new window.Event(event));};
 const check=id=>{$(id).checked=true;$(id).dispatchEvent(new window.Event('change'));};
 return {app,$,change,check,window,source};
}
test('demonstration makes first-pass groups, explicit batch reason is required and release gates remain',async()=>{
 const h=await harness();await h.$('demo').onclick();
 assert.equal(h.app.state().marks.length,3);assert.equal(h.$('assistGroups').children.length,2);
 h.change('assistReason','');h.$('assistRedact').onclick();assert.ok(h.app.state().marks.every(m=>m.status==='pending'));assert.match(h.$('status').textContent,/shared reason/);
 h.change('assistReason','Personal information selected for removal');h.$('assistRedact').onclick();
 assert.ok(h.app.state().marks.every(m=>m.status==='redact'));assert.ok(h.$('prepare').disabled);assert.equal(h.app.state().workingChecks.size,0);
 h.change('caseRef','TEST');h.change('reviewer','Reviewer A');h.change('checker','Reviewer B');
 h.check('pageChecked');await h.$('next').onclick();h.check('pageChecked');
 for(const id of ['imageAccepted','reviewComplete','authorised'])h.check(id);
 assert.equal(h.$('prepare').disabled,false);await h.$('prepare').onclick();
 assert.ok(h.$('download').disabled);h.check('pageChecked');await h.$('prev').onclick();h.check('pageChecked');
 assert.equal(h.$('download').disabled,false);
 h.$('return').onclick();h.change('assistTerms','Known reference');
 assert.equal(h.app.state().prepared,null);assert.ok(h.$('download').disabled);assert.ok(h.app.state().assistSettingsDirty);
 await h.$('assistScan').onclick();assert.equal(h.app.state().marks.length,3);assert.ok(h.app.state().marks.every(m=>m.status==='redact'));
});
test('page-scoped batch preserves other pages and adjusted proposals become manual areas',async()=>{
 const h=await harness();await h.$('demo').onclick();h.change('assistReason','Page one selection');h.change('assistScope','page','change');h.$('assistRedact').onclick();
 assert.equal(h.app.state().marks.filter(m=>m.status==='redact').length,2);assert.equal(h.app.state().marks.filter(m=>m.status==='pending').length,1);
 await h.$('next').onclick();await h.$('assistNext').onclick();h.change('w','100');h.$('adjust').onclick();
 const adjusted=h.app.state().marks.find(m=>m.page===1);assert.equal(adjusted.assistantType,undefined);
 await h.$('assistScan').onclick();assert.ok(h.app.state().marks.includes(adjusted));
 h.change('assistTerms','Sensitive supplied term');h.change('assistExclusions','Sensitive exclusion');h.change('assistReason','Sensitive reason');h.$('clear').onclick();
 for(const id of ['assistTerms','assistExclusions','assistReason'])assert.equal(h.$(id).value,'');
});
test('saved suggestion groups resume without excerpts and malformed group metadata is rejected',async()=>{
 const h=await harness();await h.$('demo').onclick();
 const plan=engine.savePdfReview(h.source,h.app.state().marks,{caseRef:'TEST',reviewer:'A',checker:'B'});
 assert.ok(!JSON.stringify(plan).includes('alex@example.org'));assert.ok(!JSON.stringify(plan).includes('Alex Smith'));
 const restored=engine.restorePdfReview(plan,h.source);assert.equal(restored.marks[0].assistantType,'Person name');
 plan.marks[0].assistantType='<script>';assert.throws(()=>engine.restorePdfReview(plan,h.source),/Invalid PDF area/);
});

test('reason radios fill individual and batch fields and saved custom reasons remain editable',async()=>{
 const h=await harness();await h.$('demo').onclick();
 assert.match(h.$('assistReason').value,/Personal information/);
 const radio=h.$('assistReason').ownerDocument.querySelector('input[name="assistReasonPreset"][value="scope"]');
 radio.click();assert.match(h.$('assistReason').value,/agreed scope/);
 await h.$('assistNext').onclick();
 h.$('reason').ownerDocument.querySelector('input[name="reasonPreset"][value="confidential"]').click();
 h.$('redact').onclick();assert.equal(h.app.state().marks.find(m=>m.status==='redact').reason,'Confidential information withheld following review.');
 h.change('reason','Case-specific review note');assert.ok(h.$('reason').ownerDocument.querySelector('input[name="reasonPreset"][value="custom"]').checked);
 assert.ok(h.app.state().marks.some(m=>m.reason==='Case-specific review note'));assert.ok(h.$('prepare').disabled);
 h.$('clear').onclick();assert.equal(h.$('reason').value,'');assert.equal(h.$('assistReason').value,'');
});
test('local learning uses actual decisions, survives session clearing and can be forgotten',async()=>{
 const h=await harness();await h.$('demo').onclick();await h.$('assistNext').onclick();
 h.$('reason').ownerDocument.querySelector('input[name="reasonPreset"][value="scope"]').click();h.$('redact').onclick();
 const raw=h.window.localStorage.getItem(memory.LEARNING_KEY);assert.ok(raw);assert.ok(!raw.includes('Alex Smith'));assert.ok(!raw.includes('sourceHash'));
 h.$('clear').onclick();assert.ok(h.window.localStorage.getItem(memory.LEARNING_KEY));await h.$('demo').onclick();await h.$('assistNext').onclick();assert.match(h.$('reason').value,/agreed scope/);
 h.$('forgetLearning').onclick();assert.equal(h.window.localStorage.getItem(memory.LEARNING_KEY),null);assert.equal(h.app.state().marks.length,3);assert.match(h.$('learningStatus').textContent,/0 categories/);
});

test('manual areas use learned manual-category reason preferences too',async()=>{
 const h=await harness();await h.$('demo').onclick();h.$('add').onclick();
 h.$('reason').ownerDocument.querySelector('input[name="reasonPreset"][value="scope"]').click();h.$('redact').onclick();
 h.change('x','250');h.change('y','250');h.$('add').onclick();assert.match(h.$('reason').value,/agreed scope/);
});
test('dictionary refresh displays counts and requires a fresh scan while preserving decisions',async()=>{
 const h=await harness();await h.$('demo').onclick();h.$('assistRedact').onclick();const before=h.app.state().marks;
 await h.$('refreshDictionary').onclick();assert.match(h.$('dictionaryInfo').textContent,/Dictionary ready/);assert.ok(h.app.state().assistSettingsDirty);assert.equal(h.app.state().marks,before);assert.ok(h.$('prepare').disabled);
 await h.$('assistScan').onclick();assert.equal(h.app.state().assistSettingsDirty,false);
});

test('textless PDFs show a persistent alert through rescans and allow manual marking',async()=>{
 const h=await harness();h.source.pages.forEach(p=>p.fragments=[]);
 await h.$('demo').onclick();
 assert.equal(h.app.state().marks.length,0);assert.equal(h.$('textWarning').hidden,false);
 assert.match(h.$('textWarning').textContent,/Automatic detection unavailable: none of the 2/);
 assert.match(h.$('textWarning').textContent,/Names, emails/);assert.match(h.$('textWarning').textContent,/no OCR/);
 assert.match(h.$('status').textContent,/could not check every page/);
 assert.equal(h.$('add').disabled,false);h.$('add').onclick();assert.equal(h.app.state().marks.length,1);
 await h.$('assistScan').onclick();assert.equal(h.$('textWarning').hidden,false);
 h.$('clear').onclick();assert.equal(h.$('textWarning').hidden,true);assert.equal(h.$('textWarning').textContent,'');
});
test('mixed PDFs warn only about textless pages and loading a readable file clears the alert',async()=>{
 const h=await harness(),original=h.source.pages[1].fragments;h.source.pages[1].fragments=[];
 await h.$('demo').onclick();assert.match(h.$('textWarning').textContent,/unavailable on pages 2:/);
 assert.equal(h.app.state().marks.length,2);
 h.source.pages[1].fragments=original;await h.$('demo').onclick();
 assert.equal(h.$('textWarning').hidden,true);assert.equal(h.$('textWarning').textContent,'');
});
