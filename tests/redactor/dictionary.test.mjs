import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeLexicon,assistText} from '../../js/redactor/assistance.js';
const file=new URL('../../assets/name-lexicon-rbc-20261014.json',import.meta.url);
const bytes=await readFile(file),json=JSON.parse(bytes),lex=makeLexicon(json);
test('published dictionary counts, sorted unique entries, bounds and provenance are consistent',()=>{
 assert.equal(json.givenNames.length,json.metadata.counts.givenNames);assert.equal(json.surnames.length,json.metadata.counts.surnames);assert.equal(json.metadata.counts.total,json.givenNames.length+json.surnames.length);
 assert.equal(lex.given.size,json.givenNames.length);assert.equal(lex.surname.size,json.surnames.length);assert.ok(bytes.length<6e6);
 for(const list of [json.givenNames,json.surnames])for(let i=1;i<list.length;i++)assert.ok(list[i-1]<list[i]);
 assert.equal(json.metadata.sources.length,5);assert.ok(json.metadata.sources.every(s=>/^[a-f0-9]{64}$/.test(s.sha256)&&s.url.startsWith('https://')));
 assert.ok(!Object.hasOwn(json,'records'));assert.ok(!Object.hasOwn(json,'gender'));
});
test('common names and multicultural examples work without author labels',()=>{
 for(const name of ['julie','marie','zoe','lara'])assert.ok(lex.given.has(name),name);
 for(const name of ['barker','hobbs','patel'])assert.ok(lex.surname.has(name),name);
 for(const text of ['Julie Smith','Marie Brown','Zoe Jones','Lara Williams','José García','Muhammad Khan','André Martin']){
  const matches=assistText(text,{names:'conservative'},lex).matches.filter(m=>m.type==='Person name');
  assert.ok(matches.some(m=>text.slice(m.start,m.end)===text),text);
 }
});
test('larger sourced dictionary keeps approval and audit headings out of Balanced person suggestions',()=>{
 const text='Resource Commission. Report Author. Senior Auditor. Strategic Lead. Change Delivery. Team Manager. Assurance Definition. Traffic Regulation Orders. Personal Information. Public Sector.';
 assert.deepEqual(assistText(text,{names:'balanced'},lex).matches.filter(m=>m.type==='Person name'),[]);
});
