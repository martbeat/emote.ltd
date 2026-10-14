import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachReasonPresets,suggestReason,REASONS} from '../../js/redactor/reason-presets.js';
test('suggestions distinguish contact-only groups and avoid inferring confidential or privileged reasons',()=>{
 assert.equal(suggestReason(['Email','Telephone']),'contact');assert.equal(suggestReason(['Person name + Email']),'personal');
 for(const types of [[],['Supplied term'],['Date'],['Organisation'],['Email','Supplied term']])assert.equal(suggestReason(types),null);
});
test('auto filling can be disabled and never overwrites custom or existing reasons',()=>{
 const dom=new JSDOM('<input id="reason">'),input=dom.window.document.getElementById('reason');
 const ui=attachReasonPresets(input);dom.window.document.getElementById('reasonAutoReason').checked=false;
 ui.suggest(['Email']);assert.equal(input.value,'');
 dom.window.document.getElementById('reasonAutoReason').checked=true;ui.suggest(['Email']);assert.equal(input.value,REASONS.contact[1]);
 input.value='Specific case note';ui.suggest(['Person name']);assert.equal(input.value,'Specific case note');
 ui.lock(true);assert.ok([...dom.window.document.querySelectorAll('input')].every(x=>x.disabled));
 ui.reset();assert.equal(input.value,'');
});
