// Exploratory seeded strategy benchmark. Run from repository root. Optional HTML path compares an earlier ruleset.
// Policies are fixed heuristics, not optimal play or a substitute for human playtesting.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),storage=new Map();
function el(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',disabled:false,value:'all',dataset:{},style:{},classList:{toggle(){},add(){}},showModal(){this.open=true},close(){this.open=false},addEventListener(){},replaceChildren(){},append(){},setAttribute(){},remove(){}});return elements.get(id)}
const context={document:{getElementById:el,querySelectorAll(){return[]},addEventListener(){},createElement(){return el(Symbol())},body:el('body')},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},crypto:require('node:crypto').webcrypto,matchMedia:()=>({matches:true}),location:{hostname:'localhost'},navigator:{},URLSearchParams,console,Date,Math,setTimeout:()=>0,clearTimeout(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync(process.argv[2]||'Current.html','utf8').match(/<script id="engine">([\s\S]*?)<\/script>/)[1],context);
function run(s){return vm.runInContext(s,context)}

run(`
render=()=>{};save=()=>{};turnFeedback=()=>{};showEnd=()=>{};showSeason=()=>{};const musicSeason=GUILDS.voyager[2].includes('each season')?1:0;function legalActions(){let a=[{type:'tend'}];for(const id of state.market){const b=species(id),h=state.homes[b.home];if(state.care>=b.cost&&h.ids.length<h.cap)a.push({type:'welcome',id})}for(let i=0;i<3;i++){let h=state.homes[i];if(h.cap<4&&state.care>=(h.cap===2?4:6))a.push({type:'restore',i})}if(residents().length)a.push({type:'observe'});if(count('shoaler'))a.push({type:'bloom'});a.push({type:'explore'});return a}
function apply(a){state.notice=null;if(a.type==='welcome')welcome(a.id);else if(a.type==='restore')restore(a.i);else $(''+({tend:'tend',observe:'observe',bloom:'bloom',explore:'explore'}[a.type])).onclick();state.notice=null}
function choose(policy){let list=legalActions(),left=24-state.turn;const preferred={flowers:'shoaler',soil:'filterer',hunters:'hunter',music:'voyager'}[policy];function value(a){if(a.type==='welcome'){let b=species(a.id);return b.points+1+(b.guild==='voyager'?4+Math.ceil(left/6)*musicSeason:0)+(b.guild===preferred?left*.9:0)+(policy==='mixed'?(b.guild==='filterer'?left*.5:b.guild==='shoaler'?left*.4:left*.13):0)}if(a.type==='restore')return left>9?7:-10;if(a.type==='tend')return state.care<3?left*.8:state.care<6?left*.3:-10;if(a.type==='bloom')return bloomValue();if(a.type==='observe')return observeValue();return -9}return list.sort((a,b)=>value(b)-value(a))[0]}
`);
const policies=['mixed','flowers','soil','hunters','music'];
for(const policy of policies){const scores=[],nSpecies=[],counts={shoaler:0,filterer:0,hunter:0,voyager:0};let wins=0;
for(let seed=1;seed<=500;seed++){run(`start('balanced');state.seed=${seed};state.market=[];fill();for(let i=0;i<24;i++)apply(choose('${policy}'));`);const score=run('state.points');scores.push(score);nSpecies.push(run('residents().length'));for(const k of Object.keys(counts))counts[k]+=run(`count('${k}')`);wins+=score>=165;}
scores.sort((a,b)=>a-b);console.log(policy,JSON.stringify({avg:Math.round(scores.reduce((a,b)=>a+b,0)/500),median:scores[250],p10:scores[50],p90:scores[450],wins:wins/5,species:(nSpecies.reduce((a,b)=>a+b,0)/500).toFixed(1),guilds:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,(v/500).toFixed(1)]))}));}

// Paired opening comparison: same care cost, arrival points and habitat.
// The fixed opening isolates the choice; it is not a normal-game win-rate sample.
for(const first of ['11','9','6']){let sum=0;for(let seed=1;seed<=500;seed++){run(`start('balanced');state.seed=${seed};state.market=['${first}','13','25','2'];welcome('${first}');for(let i=1;i<24;i++)apply(choose('mixed'));`);sum+=run('state.points')}console.log('paired opening',run(`species('${first}').name`),'mean',+(sum/500).toFixed(1))}

