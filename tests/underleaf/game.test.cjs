const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),storage=new Map();
function el(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',disabled:false,value:'all',dataset:{},style:{},classList:{toggle(){},add(){}},showModal(){this.open=true},close(){this.open=false},addEventListener(){},replaceChildren(){},append(){},setAttribute(){},remove(){}});return elements.get(id)}
const context={document:{getElementById:el,querySelectorAll(){return[]},addEventListener(){},createElement(){return el(Symbol())},body:el('body')},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},crypto:require('node:crypto').webcrypto,matchMedia:()=>({matches:true}),location:{hostname:'localhost'},navigator:{},URLSearchParams,console,Date,Math,setTimeout:()=>0,clearTimeout(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync('Underleaf.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1],context);
function run(s){return vm.runInContext(s,context)}
run(`
if(SPECIES.length!==32)throw Error('species count');
for(const a of SPECIES)if(!art(a).includes('<svg'))throw Error('missing art');
start('balanced');state.market=['13','2','9','25'];welcome('13');welcome('2');
if(count('recycler')!==1||count('pollinator')!==1||bloomValue()!==4)throw Error('network powers');
let before=copy(state);$('bloom').onclick();if(state.points!==before.points+4||state.turn!==before.turn+1)throw Error('bloom');
$('undo').onclick();if(state.points!==before.points||state.turn!==before.turn)throw Error('undo');
let nudges=state.nudges;coach();$('tend').onclick();$('undo').onclick();if(state.nudges!==nudges-1)throw Error('hint farming');
state.homes[0]={cap:2,ids:['2','9']};state.market=['0','1','3','4'];state.care=20;let t=state.turn;welcome('0');if(state.turn!==t)throw Error('full habitat welcome');
coach();if(state.tip.startsWith('Welcome'))throw Error('blocked coaching');
`);
let scores=[];
for(let n=1;n<=100;n++){
run(`start('balanced');state.seed=${n};state.market=[];fill();`);
for(let t=0;t<24;t++){
run(`{
const available=state.market.map(species).filter(a=>state.care>=a.cost&&state.homes[a.home].ids.length<state.homes[a.home].cap);
if(available.length&&state.turn<16){available.sort((a,b)=>(b.guild==='recycler')-(a.guild==='recycler'));welcome(available[0].id)}
else if(state.turn<14&&state.homes.some(h=>h.cap<4&&h.ids.length===h.cap)&&state.care>=6)restore(state.homes.findIndex(h=>h.cap<4&&h.ids.length===h.cap));
else if(state.turn<15&&state.care<5)$('tend').onclick();
else if(bloomValue()>observeValue())$('bloom').onclick();else if(residents().length)$('observe').onclick();else $('tend').onclick();
if(!valid(state)||!valid(JSON.parse(JSON.stringify(state))))throw Error('invalid state at '+state.turn);
state.notice=null;
}`);
assert.equal(run('state.turn'),t+1);
}
assert.equal(run('state.ended'),true);scores.push(run('state.points'));
run(`{let total=state.points;$('undo').onclick();if(state.ended||state.turn!==23)throw Error('final undo');if(bloomValue()>observeValue())$('bloom').onclick();else $('observe').onclick();if(state.points!==total)throw Error('finish replay');}`);
}
console.log('PASS: 100 complete seeded years, legal moves, habitat capacity, ecology powers, state round trips, hint limits and final-turn undo.');
console.log('Example strategy scores: min',Math.min(...scores),'median',scores.sort((a,b)=>a-b)[50],'max',Math.max(...scores));
