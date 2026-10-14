import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalLearning,LEARNING_KEY} from '../../js/redactor/local-learning.js';
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
test('local reason preferences survive reload without storing source IDs or custom wording',()=>{
 const store=storage(),first=createLocalLearning(store);
 first.observe('SENSITIVE-SOURCE-ID',['Email'],'redact','scope');
 first.observe('P2',['Person name'],'redact','Secret name and case text');
 const raw=store.getItem(LEARNING_KEY);assert.ok(!raw.includes('SENSITIVE'));assert.ok(!raw.includes('Secret'));assert.ok(!raw.includes('P2'));
 const resumed=createLocalLearning(store);assert.equal(resumed.prediction(['Email']).reasonKey,'scope');assert.equal(resumed.summary().length,2);
 assert.equal(resumed.prediction(['Email','Person name']).reasonKey,null);
});
test('corrected and repeated decisions update rather than duplicate their session contribution',()=>{
 const memory=createLocalLearning(storage());memory.observe('P1',['Email'],'redact','contact');memory.observe('P1',['Email'],'redact','contact');
 assert.equal(memory.summary()[0].redact,1);
 memory.observe('P1',['Email'],'keep','retain');assert.equal(memory.summary()[0].redact,0);assert.equal(memory.summary()[0].keep,1);assert.equal(memory.prediction(['Email']).reasonKey,null);
 memory.observe('P1',[],'pending',null);assert.equal(memory.summary().length,0);
});
test('turning learning off persists, ignores future choices and forgetting preserves opt-out',()=>{
 const store=storage(),memory=createLocalLearning(store);memory.observe('P1',['Email'],'redact','contact');memory.setEnabled(false);memory.observe('P2',['Telephone'],'redact','scope');
 assert.equal(memory.summary().length,1);assert.equal(memory.prediction(['Email']),null);assert.equal(createLocalLearning(store).enabled,false);
 memory.forget();assert.equal(memory.summary().length,0);assert.equal(createLocalLearning(store).enabled,false);
});
test('legal and sensitivity presets are never inferred as a reason for a new case',()=>{
 for(const preset of ['privileged','confidential','sensitive','retain']){const memory=createLocalLearning(storage());memory.observe('P1',['Email'],'redact',preset);assert.equal(memory.prediction(['Email']).reasonKey,null);}
});
test('unavailable storage disables learning without stopping redaction',()=>{
 const memory=createLocalLearning({getItem(){throw Error('blocked');}});assert.equal(memory.available,false);assert.equal(memory.enabled,false);assert.doesNotThrow(()=>memory.observe('P1',['Email'],'redact','contact'));
 const store=storage();store.setItem=()=>{throw Error('quota');};const full=createLocalLearning(store);assert.doesNotThrow(()=>full.observe('P1',['Email'],'redact','contact'));assert.equal(full.enabled,false);
});
test('untrusted storage is restricted to bounded counters, known categories and preset codes',()=>{
 const store=storage();store.setItem(LEARNING_KEY,JSON.stringify({schema:1,enabled:true,stats:{Email:{redact:3,keep:-1,reasons:{redact:{scope:2,custom:'Secret',privileged:999999},keep:{}}},'Private name':{redact:100}},caseRef:'Secret'}));
 const memory=createLocalLearning(store);memory.observe('P1',['Telephone'],'redact','contact');const raw=store.getItem(LEARNING_KEY);
 assert.ok(!raw.includes('Secret'));assert.ok(!raw.includes('Private name'));assert.ok(!raw.includes('999999'));assert.equal(memory.prediction(['Email']).reasonKey,'scope');
});

test('corrupted stored JSON is discarded so local learning can recover',()=>{
 const store=storage();store.setItem(LEARNING_KEY,'broken JSON');const memory=createLocalLearning(store);
 assert.equal(memory.available,true);memory.observe('P1',['Email'],'redact','contact');assert.equal(createLocalLearning(store).prediction(['Email']).reasonKey,'contact');
});
