const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../Wildhaven.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function harness(storage={},hostname='preview.local'){
 const elements={},pings=[];
 const el=id=>elements[id]??={textContent:'',innerHTML:'',disabled:false,hidden:false,open:false,handlers:{},showModal(){this.open=true},close(){if(this.open){this.open=false;this.handlers.close?.()}},addEventListener(event,fn){this.handlers[event]=fn},replaceChildren(){},classList:{toggle(){}},append(){},remove(){},style:{}};
 const ctx=vm.createContext({document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){},createElement:()=>el('dummy'),body:{append(){}}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},location:{hostname},navigator:{sendBeacon:url=>pings.push(url)},URLSearchParams,crypto:{getRandomValues:require('node:crypto').webcrypto.getRandomValues.bind(require('node:crypto').webcrypto)},matchMedia:()=>({matches:true}),setTimeout(){},console});
 vm.runInContext(script,ctx);
 return {run:s=>vm.runInContext(s,ctx),elements,storage,pings};
}
const h=harness(),run=h.run;
run("start('balanced');state.seed=42;state.market=['mouse','hedgehog','watervole','otter'];welcome('mouse');welcome('hedgehog')");
assert.equal(run('state.turn'),2);assert.equal(run('state.care'),1);
run('coach()');assert.equal(run('state.nudges'),2);run("$('undo').onclick()");assert.equal(run('state.turn'),1);assert.equal(run('state.nudges'),2,'Undo must not refund coaching');assert.equal(run('state.care'),4);
run('coach();coach();coach()');assert.equal(run('state.nudges'),0);
run("for(let i=0;i<5;i++) $('gather').onclick()");assert.equal(run('state.turn'),6);assert.equal(run('state.nudges'),1);assert.equal(run('state.points'),4);
assert(h.elements.seasonHeading.textContent.includes('Summer'));assert(h.elements.seasonDialog.open);run("$('seasonDialog').close()");assert.equal(run('state.seasonNotice'),null);
run("$('undo').onclick()");assert.equal(run('state.turn'),5);assert.equal(run('state.nudges'),0);run("$('gather').onclick();$('seasonDialog').close();coach();$('undo').onclick()");assert.equal(run('state.nudges'),0,'New season coaching cannot be farmed with undo');
// Legal arrivals, restores and explore: invalid actions must not spend resources or turns.
run("start('gentle');state.market=['mouse','bankvole','squirrel','dormouse'];welcome('mouse');welcome('bankvole')");
assert.equal(run('state.homes[0].animals.length'),2);const before=run('JSON.stringify(state)');run("welcome('squirrel')");assert.equal(run('JSON.stringify(state)'),before);
run("$('gather').onclick();restore(0)");assert.equal(run('state.homes[0].cap'),3);assert.equal(run('state.points'),7);
assert(run("$('encounters').innerHTML.includes('Need')"));assert(run("$('habitats').innerHTML.includes('data-animal=')"));
run("showGuide('mouse')");assert(h.elements.guideList.innerHTML.includes('Wood mouse'));assert(h.elements.guide.open);
run("$('refresh').onclick()");assert.equal(run('state.turn'),5);assert.equal(run('state.market.length'),4);
// Simulations cover every action, unique species, resource constraints and final accounting.
const totals=[];const coverage=new Set();
for(let n=1;n<=200;n++){
 run(`start('balanced');state.seed=${n};state.market=[];fillMarket()`);
 while(!run('state.ended')){
  run(`{
  const offers=state.market.map(species).filter(a=>state.homes[a.home].animals.length<state.homes[a.home].cap&&a.cost<=state.care);
  offers.sort((a,b)=>(b.points+(b.trait==='forage'?8:0))-(a.points+(a.trait==='forage'?8:0)));
  const blocked=state.market.map(species).find(a=>state.homes[a.home].animals.length>=state.homes[a.home].cap&&state.homes[a.home].cap<4);
  if(offers.length&&state.turn<16)welcome(offers[0].id);
  else if(blocked&&state.turn<14&&state.care>=(state.homes[blocked.home].cap===2?4:6))restore(blocked.home);
  else if(state.turn<14&&state.care<5)$('gather').onclick();
  else if(residents().length)$('survey').onclick();else $('gather').onclick();
  if(state.seasonNotice&&!state.ended)$('seasonDialog').close();
  }`);
  assert(run('state.care>=0'));assert(run('state.homes.every(h=>h.animals.length<=h.cap&&h.cap<=4)'));assert(run('new Set(residents()).size===residents().length'));assert(run('state.market.every(id=>!residents().includes(id))'));assert(run('new Set(state.market).size===state.market.length'));assert(run('validState(state)'));
 }
 assert.equal(run('state.turn'),24);assert.equal(run('state.points'),run('Object.values(state.summary).reduce((a,b)=>a+b,0)'));assert.equal(run('state.summary.sleep'),run("traitCount('sleep')*3"));totals.push(run('state.points'));
 const final=run('state.points');run("$('gather').onclick()");assert.equal(run('state.points'),final);assert(run('records.bests.balanced>=state.points'));
}
// Save restoration and malformed saves recover to a playable game.
const restored=harness(h.storage);assert.equal(restored.run('state.points'),run('state.points'));assert.equal(restored.run('state.ended'),true);
for(const mutation of ["state.homes[0].animals=['unknown']","state.homes[0].animals=['otter']","state.care=-1","state.level='bad'","state.market=['mouse','mouse']","state.turn=25"]){run("start('balanced')");run(mutation);assert.equal(run('validState(state)'),false);run('save()');const recovered=harness(h.storage);assert.equal(recovered.run('state.turn'),0);assert(recovered.run('validState(state)'));}
// Starts are on first action, preview is silent and undo cannot duplicate completion events.
assert.equal(h.pings.length,0);
const live=harness({},'games.emote.ltd'),lr=live.run;
assert.equal(live.pings.length,0);lr("$('gather').onclick();$('undo').onclick();$('gather').onclick()");assert.equal(live.pings.filter(x=>x.includes('event=start')).length,1);
lr("for(let i=0;i<23;i++){if(state.seasonNotice)$('seasonDialog').close();$('gather').onclick()}");assert.equal(live.pings.filter(x=>x.includes('event=complete')).length,1);
lr("$('undo').onclick();$('gather').onclick()");assert.equal(live.pings.filter(x=>x.includes('event=complete')).length,1);assert(live.pings.every(x=>!x.includes('runId')&&!x.includes('score')));
console.log(`Wildhaven: 200 complete games (${Math.min(...totals)}–${Math.max(...totals)} points), legal actions, seasonal awards, coaching/undo, saves, guide and start/completion tracking passed.`);
const hub=fs.readFileSync(path.resolve(__dirname,'../../games.html'),'utf8');
const games=vm.runInNewContext(hub.match(/const GAMES = (\[[\s\S]*?\n\]);/)[1]);
const wildhaven=games.filter(g=>g.href==='Wildhaven.html');assert.equal(wildhaven.length,1);assert.equal(wildhaven[0].title,'Wildhaven');
console.log('Games Hub has one working relative Wildhaven entry.');
