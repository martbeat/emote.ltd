const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const project=path.resolve(__dirname,'../..');
const elements={},events=[];let rngCalls=0;
const el=id=>elements[id]??={value:id==='mode'?'ai':'',innerHTML:'',textContent:'',disabled:false,hidden:false,classList:{add(){},toggle(){},remove(){}},setAttribute(){},getAttribute(){return ''},addEventListener(){},showModal(){},close(){},scrollIntoView(){},focus(){}};
const math=Object.create(Math);math.random=()=>{rngCalls++;return Math.random()};
const sandbox={document:{getElementById:el,querySelector:el,querySelectorAll(){return []},addEventListener(...e){events.push(e)}},localStorage:{getItem(){return null},setItem(){}},console,Math:math,matchMedia:()=>({matches:true}),setTimeout,clearTimeout};vm.createContext(sandbox);
for(const f of ['assets/js/flock-bird-art.js','assets/js/flock-clarity.js'])vm.runInContext(fs.readFileSync(path.join(project,f),'utf8'),sandbox);
vm.runInContext(fs.readFileSync(path.join(project,'Flock.html'),'utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1],sandbox);
vm.runInContext(`
showTurnEffects=false;let covered=new Set(),previewChecks=0;
for(let game=0;game<100;game++){
 fresh();let moves=0;
 while(!state.done){const p=state.players[state.current],choices=options(p),a=choices[Math.floor(Math.random()*choices.length)];covered.add(a.type);
  const before=JSON.stringify(state);const projected=previewAction(p,a);if(JSON.stringify(state)!==before)throw Error('Preview changed state');
  const result=apply(p,a);if(JSON.stringify(projected.delta)!==JSON.stringify(result.delta)||projected.goalDelta!==result.goalDelta)throw Error('Preview/result mismatch '+a.type);
  previewChecks++;next();moves++;
  if(state.current===1&&!state.done){if(!ai())throw Error('Missing AI report');moves++}
  for(const p of state.players){if(p.food<0||p.hand.length>8)throw Error('Resources');for(const row of p.birds){if(row.length>3)throw Error('Habitat');for(const b of row)if(b.eggs>capacity(b)||b.nests>3)throw Error('Nest')}}
  if(moves>48)throw Error('Game length');
 }
 if(moves!==48)throw Error('Game did not finish at 48 actions');
}
if(covered.size!==6)throw Error('Missing action coverage');
fresh();let p=state.players[0];p.hand=[0];apply(p,{type:'attract',hand:0,hab:0});const b=p.birds[0][0];b.nests=1;b.eggs=2;b.used=false;const report=apply(p,{type:'forage'});
if(!report.steps.some(s=>s.text.includes('no egg space'))||!b.used)throw Error('Full nest ability explanation');
if(report.delta.eggs!==0||report.delta.food!==3)throw Error('Full nest preview');
p.hand=Array(7).fill(0);p.birds[2]=[{id:15,nests:1,eggs:0,flock:0,used:false},{id:16,nests:1,eggs:0,flock:0,used:false}];const scout=apply(p,{type:'scout',market:0});if(p.hand.length!==8||!scout.steps.some(s=>s.text.includes('hand full')))throw Error('Hand limit explanation');
if(!unavailable(p,{type:'scout'}).includes('hand is full'))throw Error('Unavailable reason');
fresh();const exactBefore=JSON.stringify(state);act({type:'attract',hand:0,hab:0});if(state.lastTurns.length!==2||state.lastTurns[0].actor!==0||state.lastTurns[1].actor!==1)throw Error('Separate turn recaps');if(state.turn!==1)throw Error('AI response');document.getElementById('undo').onclick();if(JSON.stringify(state)!==exactBefore)throw Error('Undo');
fresh();state.mode='local';state.current=1;state.turn=5;view=1;state.players[0].birds[0]=[{id:0,nests:2,eggs:1,flock:2,used:true}];act({type:'forage'});if(state.season!==1||state.seasonResult.bonuses[0]!==2||state.players[0].birds[0][0].used)throw Error('Season boundary');if(!document.getElementById('dialog-body').innerHTML.includes('Summer begins'))throw Error('Season announcement');
console.log(previewChecks+' exact previews matched real results across 100 full games; all actions, capacity limits, AI recaps, undo and season transition passed.');
`,sandbox);
const startRng=rngCalls;vm.runInContext('fresh();',sandbox);const beforeRng=rngCalls;vm.runInContext('for(const a of options(state.players[0]))previewAction(state.players[0],a)',sandbox);assert.equal(rngCalls,beforeRng,'Previews must not consume randomness');
console.log('Preview does not consume random draws or change the deck.');


// Replaying explanations must never reapply an action or leave a stale timer.
let replayTimers=new Map(),timerSequence=0;
sandbox.matchMedia=()=>({matches:false});
sandbox.setTimeout=(fn,ms)=>{const id=++timerSequence;replayTimers.set(id,{fn,ms});return id};
sandbox.clearTimeout=id=>replayTimers.delete(id);
vm.runInContext(`
document.getElementById('mode').value='ai';fresh();showTurnEffects=true;autoReplay=false;
state.players[0].birds[0]=[{id:0,nests:1,eggs:0,flock:0,used:false}];
const replayBefore=JSON.stringify(state);act({type:'forage'});
const settled=JSON.stringify(state);
if(!isResolving||replayController.cursor!==0||replayController.autoplay)throw Error('Guided replay must wait by default');
if(!replayController.hasComputer||replayController.frames.some(f=>f.report.actor!==0||f.display.current!==0))throw Error('Computer moves must stay out of the player replay');
if(!effectCalloutHTML().includes('Your turn'))throw Error('Player turn label');
if(replayController.frames[0].step.gain!=='+3 food'||replayController.frames[1].step.gain!=='+1 egg')throw Error('Per-effect gains');
advanceReplay();if(replayController.cursor!==1)throw Error('Next effect');
showReplayStep(0);if(replayController.cursor!==0||JSON.stringify(state)!==settled)throw Error('Back changed game state');
replayController.autoplay=true;showReplayStep(0);
`,sandbox);
assert.equal(replayTimers.size,1);assert.equal([...replayTimers.values()][0].ms,4000);
const staleCallback=[...replayTimers.values()][0].fn;
vm.runInContext('replayController.autoplay=false;showReplayStep(replayController.cursor)',sandbox);
assert.equal(replayTimers.size,0,'Pause must clear the timer');
vm.runInContext('finishReplay();if(isResolving||replayController||JSON.stringify(state)!==settled)throw Error("Finish changed the settled game");document.getElementById("undo").onclick();if(JSON.stringify(state)!==replayBefore)throw Error("Replay undo")',sandbox);
staleCallback();
vm.runInContext('if(isResolving||JSON.stringify(state)!==replayBefore)throw Error("Stale replay timer")',sandbox);
console.log('Guided controls, pause, finish, undo and cancelled timers passed; player-only replay and computer labelling verified.');


vm.runInContext(`
fresh();showTurnEffects=false;act({type:'forage'});
if(state.lastTurns.length!==2||!document.getElementById('turn-feedback').innerHTML.includes('Computer turn · The ranger')||!document.getElementById('turn-feedback').innerHTML.includes('Review computer move'))throw Error('Computer summary missing');
fresh();state.mode='local';state.current=1;view=1;showTurnEffects=true;act({type:'forage'});
if(replayController.frames.some(f=>f.report.actor!==1)||replayController.hasComputer)throw Error('Local player replay changed');
cancelReplay();console.log('Computer summary and two-person play verified.');
`,sandbox);
