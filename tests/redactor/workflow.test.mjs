import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {readZip,writeZip,hash,buildDocx} from '../../js/redactor/core.mjs';
const html=await readFile(new URL('../../redactor-rbc-text.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'https://example.test/redactor-rbc-text.html'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.DOMParser=dom.window.DOMParser;
window.confirm=()=>true;
const blobs=new Map(),downloads=[];
URL.createObjectURL=blob=>{const key=`blob:test-${blobs.size}`;blobs.set(key,blob);return key;};URL.revokeObjectURL=()=>{};
const originalTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>{const timer=originalTimeout(fn,ms,...args);if(ms>=10000)timer.unref();return timer;};
window.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,blob:blobs.get(this.href)});};
await import('../../js/redactor/app.mjs');
const $=id=>document.getElementById(id), click=id=>$(id).click();
function input(id,value){$(id).value=value;$(id).dispatchEvent(new window.Event('input'));}
function check(id){$(id).checked=true;$(id).dispatchEvent(new window.Event('change'));}
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,2));}throw new Error('Timed out: '+$('status').textContent);}
async function load(text){input('paste',text);click('load');await until(()=>$('source').value===text);}
function signOff(){input('caseRef','SYNTHETIC-1');input('reviewer','Reviewer A');input('checker','Reviewer B');for(const id of ['complete','checkedOutput','authorised'])check(id);}
async function prepare(){signOff();assert.equal($('prepare').disabled,false);click('prepare');await until(()=>!$('downloadDocx').disabled);}
function decisionButton(text){return [...document.querySelectorAll('.decision button')].find(b=>b.textContent===text);}
await test('review workflow',async t=>{
  await t.test('initial controls cannot export',()=>{assert($('prepare').disabled);assert($('downloadDocx').disabled);});
  await t.test('manual search and group redaction use one reason',async()=>{await load('Alex Morgan email alex@example.org.');input('term','Alex Morgan');click('find');assert.equal(document.querySelectorAll('.decision').length,2);input('bulkReason','Personal information in synthetic test');click('bulk');assert(!$('output').value.includes('Alex Morgan'));assert(!$('output').value.includes('alex@example.org'));assert($('prepare').disabled);});
  await t.test('exports contain only reviewed text and matching fingerprints',async()=>{await prepare();click('downloadDocx');click('downloadTxt');click('downloadReport');const word=downloads.find(d=>d.name.endsWith('.docx')),txt=downloads.find(d=>d.name.endsWith('.txt')),report=JSON.parse(await downloads.find(d=>d.name.endsWith('.json')).blob.text());const bytes=new Uint8Array(await word.blob.arrayBuffer()),files=await readZip(bytes),all=[...files.values()].map(v=>new TextDecoder().decode(v)).join('');assert(!all.includes('Alex Morgan'));assert(!all.includes('alex@example.org'));assert.equal(files.size,3);assert.equal(report.outputs.docx.sha256,await hash(bytes));assert.equal(report.outputs.text.sha256,await hash(new Uint8Array(await txt.blob.arrayBuffer())));assert(!JSON.stringify(report).includes('alex@example.org'));assert(!JSON.stringify(report).includes('Alex Morgan'));});
  await t.test('editing a reason revokes exports and sign-off',()=>{const field=document.querySelector('.decision input');field.value='New reason';field.dispatchEvent(new window.Event('input'));assert($('downloadDocx').disabled);assert(!$('complete').checked);assert($('prepare').disabled);});
  await t.test('editing source input blocks stale export until reloaded',async()=>{await prepare();input('paste','Replacement source');assert($('downloadDocx').disabled);assert($('prepare').disabled);assert($('mark').disabled);click('load');await until(()=>$('source').value==='Replacement source');assert.equal(document.querySelectorAll('.decision').length,0);});
  await t.test('manual selection marks only selected offsets, then requires a reason',()=>{$('source').setSelectionRange(0,11);click('mark');decisionButton('Redact').click();assert.equal($('output').value,'[REDACTED R0001] source');signOff();assert($('prepare').disabled);});
  await t.test('reset and remove restore source text and revoke checks',()=>{decisionButton('Reset').click();assert.equal($('output').value,'Replacement source');assert(!$('complete').checked);decisionButton('Remove').click();assert.equal(document.querySelectorAll('.decision').length,0);});
  await t.test('export interrupted by a review edit cannot become downloadable',async()=>{signOff();click('prepare');input('checker','Changed checker');await new Promise(r=>setTimeout(r,30));assert($('downloadDocx').disabled);});
  await t.test('source text is rendered as text, never HTML',async()=>{await load('<img src=x onerror=alert(1)> private@example.org');assert.equal(document.querySelectorAll('#decisions img').length,0);assert($('source').value.startsWith('<img'));});
  await t.test('removing an automatic suggestion restores it as pending',()=>{decisionButton('Remove').click();assert.equal(document.querySelectorAll('.decision').length,1);assert.match($('counts').textContent,/1 pending/);});
  await t.test('a larger manual passage replaces enclosed suggestions',()=>{$('source').setSelectionRange(0,$('source').value.length);click('mark');assert.equal(document.querySelectorAll('.decision').length,1);assert.match(document.querySelector('.decision .meta').textContent,/Selected passage/);});
  await t.test('working review resumes decisions without restoring release approval',async()=>{
    await load('Resume sample');input('term','Resume');click('find');decisionButton('Redact').click();
    const field=document.querySelector('.decision input');field.value='Synthetic resume';field.dispatchEvent(new window.Event('input'));
    await prepare();click('saveReview');await until(()=>downloads.some(d=>d.name==='internal-working-review.json'));
    const saved=await downloads.find(d=>d.name==='internal-working-review.json').blob.text();
    click('returnReview');assert.equal($('output').value,'[REDACTED R0001] sample');assert($('downloadDocx').disabled);assert(!$('complete').checked);
    decisionButton('Keep').click();assert.equal($('output').value,'Resume sample');
    const file={name:'internal-working-review.json',size:saved.length,text:async()=>saved};
    Object.defineProperty($('resumeReview'),'files',{configurable:true,value:[file]});$('resumeReview').dispatchEvent(new window.Event('change'));
    await until(()=>$('status').textContent.startsWith('Working review restored'));
    assert.equal($('output').value,'[REDACTED R0001] sample');assert.equal(document.querySelector('.decision input').value,'Synthetic resume');
    assert($('prepare').disabled);assert(!$('complete').checked);assert(!$('checkedOutput').checked);assert(!$('authorised').checked);
    await load('A different source');$('resumeReview').dispatchEvent(new window.Event('change'));await until(()=>$('status').textContent.startsWith('Could not restore'));
    assert.match($('status').textContent,/does not match/);assert.equal($('source').value,'A different source');assert($('downloadDocx').disabled);
  });
  await t.test('Word-source export stays blocked even after review declarations',async()=>{
    const bytes=buildDocx('Synthetic layout requirement');
    const f={name:'layout.docx',size:bytes.length,arrayBuffer:async()=>bytes.buffer};
    Object.defineProperty($('file'),'files',{configurable:true,value:[f]});
    $('file').dispatchEvent(new window.Event('change'));
    await until(()=>$('source').value.includes('Synthetic layout requirement'));
    signOff();assert($('prepare').disabled);assert.match($('gate').textContent,/cannot preserve the original layout/);
    const count=downloads.length;
    $('prepare').dispatchEvent(new window.Event('click'));
    $('downloadDocx').dispatchEvent(new window.Event('click'));
    await new Promise(r=>setTimeout(r,20));
    assert($('downloadDocx').disabled);assert.equal(downloads.length,count);
    await load('Pasted-text evaluation');await prepare();assert(!$('downloadDocx').disabled);
  });
  await t.test('failed DOCX import leaves no stale document for release',async()=>{const f={name:'broken.docx',size:24,arrayBuffer:async()=>new Uint8Array(24).buffer};Object.defineProperty($('file'),'files',{configurable:true,value:[f]});$('file').dispatchEvent(new window.Event('change'));await until(()=>$('status').className==='error');assert.equal($('source').value,'');assert($('downloadDocx').disabled);assert($('prepare').disabled);});
  await t.test('clear removes the document and case fields',async()=>{await load('Synthetic final test');input('caseRef','Test case');click('clear');assert.equal($('source').value,'');assert.equal($('caseRef').value,'');assert.equal($('paste').value,'');assert($('downloadReport').disabled);});
  await t.test('CSP disables document connections and there are no remote dependencies',()=>{const policy=document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;assert(policy.includes("connect-src 'none'"));assert(policy.includes("object-src 'none'"));assert.equal(document.scripts.length,1);assert(document.scripts[0].src.startsWith('https://example.test/js/'));});
});
