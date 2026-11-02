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


// Catalogue growth keeps IDs stable and extends legacy decks exactly once.
vm.runInContext(`{
if(SPECIES.length!==31||BIRD_ILLUSTRATIONS.length!==31)throw Error('Catalogue/artwork alignment');
if(SPECIES.filter(c=>c.hab===0).length!==11||SPECIES.filter(c=>c.hab===1).length!==10||SPECIES.filter(c=>c.hab===2).length!==10)throw Error('Habitat distribution');
for(const name of ['Long-tailed tit','Chaffinch','Goldcrest','Red kite','Buzzard'])if(!SPECIES.some(c=>c.name===name))throw Error('Requested bird missing');
for(const c of SPECIES)if(!POWER[c.power]||!BIRD_ILLUSTRATIONS[c.id])throw Error('Missing ability/artwork');
fresh();if(state.speciesCount!==31||state.deck.length!==115)throw Error('Expanded deck');
const legacy=clone(state);delete legacy.speciesCount;legacy.deck=[0,2,17,5];const sanctuary=JSON.stringify(legacy.players),market=JSON.stringify(legacy.market);
upgradeBirdDeck(legacy);if(legacy.deck.length!==56||legacy.speciesCount!==31||JSON.stringify(legacy.players)!==sanctuary||JSON.stringify(legacy.market)!==market)throw Error('Legacy migration changed progress');
for(let id=18;id<31;id++)if(legacy.deck.filter(c=>c===id).length!==4)throw Error('Missing new cards');
const migrated=JSON.stringify(legacy);upgradeBirdDeck(legacy);if(JSON.stringify(legacy)!==migrated)throw Error('Migration duplicated cards');
const empty={deck:[]};upgradeBirdDeck(empty);if(empty.deck.length!==124)throw Error('Empty legacy deck');
for(let id=18;id<31;id++){
 fresh();showTurnEffects=false;const c=SPECIES[id],p=state.players[0],b={id,nests:2,eggs:0,flock:0,used:false};p.birds[c.hab]=[b];
 const a={type:['forage','eggs','scout'][c.hab],market:0};const predicted=previewAction(p,a),actual=apply(p,a);
 if(JSON.stringify(predicted.delta)!==JSON.stringify(actual.delta)||!actual.steps.some(s=>s.kind==='ability'&&s.text.startsWith(c.name)))throw Error('New bird ability: '+c.name);
 b.eggs=0;p.hand=p.hand.slice(0,4);if(apply(p,a).steps.some(s=>s.kind==='ability'))throw Error('Ability activated twice: '+c.name);
}
fresh();{const p=state.players[0];p.birds[0]=[{id:23,nests:1,eggs:2,flock:0,used:false}];const r=apply(p,{type:'forage'});if(r.delta.eggs!==1||p.birds[0][0].eggs!==3||!r.steps.some(s=>s.text.includes('only one space free')))throw Error('Two-egg ability capacity');}
fresh();{const p=state.players[0];p.birds[0]=[{id:18,nests:1,eggs:0,flock:0,used:false}];if(apply(p,{type:'forage'}).delta.flock!==2)throw Error('Long-tailed tit flock');}
fresh();{const p=state.players[0];p.birds[1]=[{id:21,nests:1,eggs:0,flock:0,used:false}];if(apply(p,{type:'eggs'}).delta.food!==2)throw Error('Red kite food');}
console.log('31 species, saved-game migration and all 13 new abilities verified.');
}`,sandbox);
const audioContext={};vm.createContext(audioContext);vm.runInContext(fs.readFileSync(path.join(project,'assets/audio/flock-calls.js'),'utf8'),audioContext);assert.equal(vm.runInContext('BIRD_CALLS.length',audioContext),31);

// Every mix of people/computers must finish with 24 actions per seat.
vm.runInContext(`
showTurnEffects=false;
for(let count=2;count<=4;count++)for(let mask=0;mask<2**(count-1);mask++){
 document.getElementById('mode').value='expansion';
 const roles=['human',...Array.from({length:count-1},(_,i)=>mask&(1<<i)?'human':'computer')];
 fresh({count,roles});
 if(state.players.length!==count||isComputer(0))throw Error('Expansion setup');
 const counts=Array(count).fill(0),bonuses=Array(count).fill(0);let previousSeason=0;
 while(!state.done){
  const before=clone(state),p=state.players[state.current],choices=options(p),a=choices[Math.floor(Math.random()*choices.length)];
  const actor=state.current;
  const expected=clone(state);
  const delta=previewAction(p,a);if(!delta)throw Error('No expansion preview');
  clarityAct(a);
  const reports=state.lastTurns;
  if(reports[0].actor!==actor||isComputer(actor))throw Error('Human report');
  if(reports.slice(1).some(r=>!isComputer(r.actor)))throw Error('Computer chain included a human');
  if(!state.done&&isComputer(state.current))throw Error('Stopped on computer');
  if(JSON.stringify(history)!==JSON.stringify(before))throw Error('Undo boundary');
  for(const r of reports)counts[r.actor]++;
  if(state.season!==previousSeason||state.done){
   if(counts.some(n=>n!==(previousSeason+1)*6))throw Error('Unequal season turns');
   for(let i=0;i<count;i++){
    const earned=state.seasonResult.bonuses[i];bonuses[i]+=earned;
    if(state.players[i].bonus!==bonuses[i])throw Error('Season goal missing');
    if(earned!==goal(state.players[i],previousSeason))throw Error('Wrong seasonal award');
   }
   previousSeason=state.season;
  }
  for(const q of state.players)for(const b of birds(q))if(b.eggs>capacity(b))throw Error('Expansion capacity');
  if(counts.reduce((a,b)=>a+b,0)>count*24)throw Error('Expansion did not end');
 }
 if(counts.some(n=>n!==24))throw Error('Wrong action count');
 showEnd();
 const best=Math.max(...state.players.map(score));
 for(const p of state.players.filter(p=>score(p)===best))if(!document.getElementById('dialog-body').innerHTML.includes(p.name))throw Error('Winner omitted');
}
document.getElementById('mode').value='expansion';fresh({count:4,roles:['human','computer','computer','human']});
const partyBefore=JSON.stringify(state);clarityAct({type:'forage'});
if(state.current!==3||state.lastTurns.length!==3||state.lastTurns.map(r=>r.actor).join(',')!=='0,1,2')throw Error('Mixed handover');
if(!document.getElementById('dialog-body').innerHTML.includes('Pass to Player 4'))throw Error('Missing pass screen');
if(!document.getElementById('turn-feedback').innerHTML.includes('Computer turn · Computer 2'))throw Error('Computer identity unclear');
document.getElementById('undo').onclick();if(JSON.stringify(state)!==partyBefore)throw Error('Party undo failed');
showTurnEffects=true;clarityAct({type:'forage'});
if(replayController.frames.some(f=>f.report.actor!==0)||!replayController.hasComputer)throw Error('Party replay mixed actors');
finishReplay();if(view!==3)throw Error('Next human sanctuary not shown');
const savedParty=clone(state);state=JSON.parse(JSON.stringify(savedParty));resetSelection();render();
if(state.players.length!==4||!isComputer(1)||isComputer(3))throw Error('Seat types lost on save');
state.players.forEach(p=>{p.bonus=0;p.birds=[[],[],[]]});state.players[3].bonus=100;showEnd();
if(!document.getElementById('dialog-body').innerHTML.includes('Player 4 wins'))throw Error('Fourth seat cannot win');
state.players[2].bonus=100;showEnd();if(!document.getElementById('dialog-body').innerHTML.includes('Shared victory: Computer 3 & Player 4'))throw Error('Multi-seat tie');
document.getElementById('mode').value='ai';fresh();
console.log('All 14 expansion seat combinations finished with 24 actions per seat; computer chains, handovers, undo, replay, saves, scoring and ties passed.');
`,sandbox);

vm.runInContext(`
document.getElementById('mode').value='ai';fresh();state.players[0].bonus=20;state.players[1].bonus=10;state.done=true;
showEnd();if(gameOutcome().heading!=='You win!'||!document.getElementById('dialog-body').innerHTML.includes('finale-confetti'))throw Error('Solo win celebration');
render();if(!document.getElementById('status').textContent.startsWith('You win!'))throw Error('Result disappeared outside dialog');
state.players[1].bonus=20;showEnd();if(gameOutcome().heading!=='You share the win!'||!gameOutcome().celebrate)throw Error('Solo tie');
state.players[1].bonus=30;showEnd();if(gameOutcome().heading!=='The ranger wins!'||document.getElementById('dialog-body').innerHTML.includes('finale-confetti'))throw Error('Computer win mislabelled');
document.getElementById('mode').value='expansion';fresh({count:4,roles:['human','computer','computer','computer']});state.players[0].bonus=100;if(gameOutcome().heading!=='You win!')throw Error('Solo expansion victory');
fresh({count:4,roles:['human','human','computer','human']});state.players[3].bonus=100;if(gameOutcome().heading!=='Player 4 wins!')throw Error('Multiplayer winner');
state.players[0].bonus=100;if(!gameOutcome().heading.startsWith('Shared victory: Player 1 & Player 4'))throw Error('Multiplayer tie');
console.log('End-game win, loss, tie, multiplayer labels, celebration and persistent result passed.');
`,sandbox);

vm.runInContext(`
document.getElementById('mode').value='ai';fresh();showTurnEffects=false;
const owner=state.players[0],intruder={id:30,nests:1,eggs:0,flock:0,used:false};owner.birds[0]=[intruder];
if(capacity(intruder)!==0||legal(owner,{type:'nest',target:[0,0]})||!unavailable(owner,{type:'nest',target:[0,0]}).includes('other birds'))throw Error('Cuckoo built its own nest');
const isolated=apply(owner,{type:'forage'});if(isolated.delta.eggs!==0||!isolated.steps.some(s=>s.text.includes('no other nest space'))||!intruder.used)throw Error('No host explanation');
intruder.used=false;owner.birds[0].push({id:2,nests:1,eggs:2,flock:0,used:true});owner.birds[1]=[{id:19,nests:1,eggs:1,flock:0,used:true}];
const otherBefore=JSON.stringify(state.players[1]);const beforeHost=JSON.stringify(owner),preview=previewAction(owner,{type:'forage'});
if(JSON.stringify(owner)!==beforeHost||preview.delta.eggs!==1)throw Error('Cuckoo preview mutated host');
const laid=apply(owner,{type:'forage'}),step=laid.steps.find(s=>s.text.startsWith('Cuckoo ability'));
if(laid.delta.eggs!==1||owner.birds[1][0].eggs!==2||intruder.eggs!==0||step.hab!==1||step.index!==0||!step.text.includes('Chaffinch'))throw Error('Host placement or highlight');
if(JSON.stringify(state.players[1])!==otherBefore)throw Error('Cuckoo changed an opponent');
if(apply(owner,{type:'forage'}).delta.eggs!==0)throw Error('Cuckoo triggered twice');
intruder.used=false;const full=apply(owner,{type:'forage'});if(full.delta.eggs!==0||!full.steps.some(s=>s.text.includes('no other nest space')))throw Error('Overfilled host');
owner.birds[0][1].eggs=0;owner.birds[1][0].eggs=0;intruder.used=false;apply(owner,{type:'forage'});if(owner.birds[0][1].eggs!==1||owner.birds[1][0].eggs!==0)throw Error('Host order');
const previous={deck:[0,8],speciesCount:30};upgradeBirdDeck(previous);if(previous.deck.length!==6||previous.deck.filter(id=>id===30).length!==4)throw Error('Existing 30-bird game lost cuckoo');
const again=JSON.stringify(previous);upgradeBirdDeck(previous);if(JSON.stringify(previous)!==again)throw Error('Cuckoo migration duplicated cards');
showTurnEffects=true;intruder.used=false;state.current=0;view=0;const cuckooUndo=JSON.stringify(state);act({type:'forage'});
if(!replayController.frames.some(f=>f.step.text.startsWith('Cuckoo ability')&&f.step.hab===0&&f.step.index===1))throw Error('Host replay missing');
finishReplay();document.getElementById('undo').onclick();if(JSON.stringify(state)!==cuckooUndo)throw Error('Cuckoo undo lost host egg');
console.log('Cuckoo host choice, preview, full nests, once-per-season use, no own nest, replay, undo and old-game upgrade passed.');
`,sandbox);
