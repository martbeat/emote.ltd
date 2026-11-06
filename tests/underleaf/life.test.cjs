const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),storage=new Map(),events={},timers=new Map(),contexts=[];let timerId=0;
function el(id){if(!elements.has(id)){const classes=new Set();elements.set(id,{innerHTML:'',textContent:'',disabled:false,hidden:false,value:'25',dataset:{},style:{},attrs:{},classes,classList:{add:k=>classes.add(k),toggle(k,v){if(v)classes.add(k);else classes.delete(k)}},setAttribute(k,v){this.attrs[k]=v},addEventListener(){},showModal(){},close(){},replaceChildren(){},append(){},remove(){}})}return elements.get(id)}
class Param{constructor(){this.value=0}setValueAtTime(v){assert.ok(Number.isFinite(v))}setTargetAtTime(v){assert.ok(Number.isFinite(v))}linearRampToValueAtTime(v){assert.ok(Number.isFinite(v))}exponentialRampToValueAtTime(v){assert.ok(Number.isFinite(v)&&v>0)}}
class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.started=false;this.stopped=false}connect(){}disconnect(){}start(t){this.started=true;this.when=t}stop(){this.stopped=true;this.onended?.()}}
class AudioContext{constructor(){this.state='suspended';this.sampleRate=44100;this.currentTime=0;this.destination=new Node();this.nodes=[];contexts.push(this)}node(){let n=new Node();this.nodes.push(n);return n}createGain(){return this.node()}createOscillator(){let n=this.node();n.isOscillator=true;return n}createBiquadFilter(){return this.node()}createBufferSource(){return this.node()}createBuffer(ch,n){return{duration:n/this.sampleRate,getChannelData:()=>new Float32Array(n)}}async resume(){this.state='running'}async suspend(){this.state='suspended'}}
let observed=[],observer;class IntersectionObserver{constructor(fn){this.fn=fn;observer=this}observe(node){observed.push(node)}disconnect(){observed=[]}}
const reduced={matches:false,addEventListener(){}};
const document={hidden:false,body:el('body'),getElementById:el,querySelector:el,querySelectorAll:s=>s==='.creature-art'?[el('visible-creature'),el('hidden-creature')]:[],addEventListener:(name,fn)=>events[name]=fn,createElement:()=>el(Symbol())};
const context={document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},crypto:require('node:crypto').webcrypto,AudioContext,IntersectionObserver,matchMedia:()=>reduced,location:{hostname:'localhost'},navigator:{},URLSearchParams,Date,Math,console,setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId},clearTimeout:id=>timers.delete(id)};
vm.createContext(context);vm.runInContext(fs.readFileSync('Underleaf.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1],context);
const run=s=>vm.runInContext(s,context);
(async()=>{
 assert.equal(contexts.length,0,'audio must not initialise on page load');
 assert.equal(el('soundToggle').textContent,'Sound: off');
 const savedState=run('JSON.stringify(state)');
 await el('soundToggle').onclick();assert.equal(contexts.length,1);assert.equal(contexts[0].state,'running');
 const patterns={};for(const name of ['buzz','grasshopper','cricket','water']){const before=contexts[0].nodes.length;await run(`playSketch('${name}')`);assert.equal(run('activeSketch'),name);patterns[name]=contexts[0].nodes.slice(before).filter(n=>n.started).map(n=>n.when);if(name==='cricket'||name==='water')assert.ok(!contexts[0].nodes.slice(before).some(n=>n.isOscillator),'no ringing oscillator tones in '+name);assert.equal(el('soundToggle').attrs['aria-pressed'],'true');await run(`playSketch('${name}')`);assert.equal(run('activeSketch'),'')}
 assert.equal(patterns.grasshopper.length,27);assert.equal(patterns.cricket.length,2);assert.ok(Math.max(...patterns.cricket)>3.6);assert.ok(Math.max(...patterns.grasshopper)<2.2);
 for(const cue of ['observe','bloom','season','win']){const before=contexts[0].nodes.length;run(`gardenSound.cue('${cue}')`);assert.ok(!contexts[0].nodes.slice(before).some(n=>n.isOscillator),'no musical game cues');}
 assert.equal(run('JSON.stringify(state)'),savedState,'sounds must not alter gameplay or its random seed');
 await el('gardenAudio').onclick();assert.equal(run('gardenAudio'),true);assert.ok([...timers.values()].some(t=>t.ms===6500));
 document.hidden=true;events.visibilitychange();assert.equal(contexts[0].state,'suspended');assert.equal(timers.size,0,'all audio timers stop in the background');assert.equal(run('activeSketch'),'');
 document.hidden=false;events.visibilitychange();assert.equal(contexts[0].state,'suspended','returning to the page must not autoplay');
 await el('soundToggle').onclick();assert.equal(contexts[0].state,'running');
 await el('soundToggle').onclick();assert.equal(run('life.sound'),false);assert.equal(run('gardenAudio'),false);assert.equal(contexts[0].state,'suspended');
 assert.equal(JSON.parse(storage.get('emote-underleaf-life-v1')).sound,false);
 observer.fn([{target:el('visible-creature'),isIntersecting:true},{target:el('hidden-creature'),isIntersecting:false}]);assert.ok(el('visible-creature').classes.has('is-visible'));assert.ok(!el('hidden-creature').classes.has('is-visible'));
 reduced.matches=true;run('lifeUI()');assert.equal(el('motionToggle').disabled,true);assert.ok(!el('body').classes.has('life-running'));
 reduced.matches=false;run('lifeUI()');el('motionToggle').onclick();assert.equal(run('life.motion'),false);assert.ok(!el('body').classes.has('life-running'));
 // Final-turn advice must prefer an established flower/soil network over a weak arrival.
 run(`state.turn=22;state.homes=[{cap:4,ids:['0','1','2']},{cap:4,ids:['13','15','16']},{cap:2,ids:[]}];state.market=['25','26','27','29'];state.care=20;state.nudges=3;coach();`);
 assert.ok(run("state.tip.startsWith('Let it bloom')"));
 console.log('PASS: sound opt-in, four distinct sketches, stop/mute, atmosphere timer cleanup, background pause, no autoplay on return, gameplay independence, offscreen motion and reduced motion.');
})().catch(e=>{console.error(e);process.exitCode=1});
