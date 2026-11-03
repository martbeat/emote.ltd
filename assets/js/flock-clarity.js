/* Turn explanations, exact action previews and optional coaching for Flock & Field. */
let showTurnEffects=true,coachEnabled=false,isResolving=false,replayGeneration=0,replayContext=null,coachChoice=null,replayController=null,autoReplay=false;
try{autoReplay=localStorage.getItem('emote-flock-pace')==='auto'}catch(e){}
try{showTurnEffects=localStorage.getItem('emote-flock-effects')!=='off'}catch(e){}
const ACTION_NAMES={forage:'Forage',eggs:'Lay eggs',scout:'Scout',attract:'Attract a bird',nest:'Build a nest',flock:'Gather a flock'};
function unavailable(p,a){
 if(state.done)return 'The year is complete.';
 const b=a.target&&p.birds[a.target[0]]?.[a.target[1]];
 switch(a.type){
 case'forage':return '';
 case'eggs':return !birds(p).some(b=>SPECIES[b.id].cap>0)?'Attract a bird with its own nest to give your eggs a home.':room(p)===0?(birds(p).some(b=>SPECIES[b.id].power!=='cuckoo'&&b.nests<3)?'All nests are full. Select a sanctuary bird and build a nest.':'All nests are full and fully expanded. Flocks can keep scoring.'):'';
 case'scout':return p.hand.length>=8?(p.birds.every(row=>row.length===3)?'Your hand is full. Put a card towards a flock before drawing more.':'Your hand is full (8 cards). Attract a bird or discard one into a flock.'):'';
 case'attract':{const c=SPECIES[p.hand[a.hand]];if(p.birds.every(row=>row.length===3))return 'All habitats are full. Make the most of your existing birds, nests and flocks.';if(!c)return 'Select a bird card in your hand.';if(a.hab!==c.hab)return `${c.name} belongs in the ${HAB[c.hab].toLowerCase()}.`;if(p.birds[a.hab].length>=3)return `Your ${HAB[a.hab].toLowerCase()} already has 3 birds.`;return p.food<c.cost?`Needs ${c.cost-p.food} more food. Forage first.`:''}
 case'nest':return !b?'Select a bird already in your sanctuary.':SPECIES[b.id].power==='cuckoo'?'Cuckoos use other birds’ nests. Build a nest on another bird.':b.nests>=3?'This bird already has its maximum of 3 nests.':p.food<1?'Needs 1 food. Forage first.':'';
 case'flock':return !b?'Select a bird already in your sanctuary.':!Number.isInteger(a.hand)||p.hand[a.hand]===undefined?'Select a card in your hand to discard.':'';
 default:return 'Choose an action.';
 }
}
function resolveAction(p,a,preview=false){
 if(!legal(p,a))return null;
 const actor=state.players.indexOf(p),initial=totals(p),food=p.food,cards=p.hand.length,points=score(p),potential=goal(p);
 const steps=[],frames=[];
 const add=(text,hab=null,index=null,kind='base')=>{steps.push({text,hab,index,kind});if(!preview)frames.push({text,hab,index,kind,p:clone(p)})};
 const giveCard=()=>{if(p.hand.length>=8)return false;p.hand.push(preview?0:draw());return true};
 const habitat={forage:0,eggs:1,scout:2}[a.type];
 let title=ACTION_NAMES[a.type],headline='',limited=0;
 switch(a.type){
 case'forage':{const n=2+p.birds[0].length;p.food+=n;headline=`gained ${n} food`;add(`Forage: +${n} food (2 base + ${p.birds[0].length} woodland bird${p.birds[0].length===1?'':'s'}).`,0);break}
 case'eggs':{let remaining=2+p.birds[1].length,placed=0;const offered=remaining;for(let h=0;h<3;h++)for(let i=0;i<p.birds[h].length;i++){const b=p.birds[h][i],n=Math.min(remaining,capacity(b)-b.eggs);if(n){b.eggs+=n;remaining-=n;placed+=n;add(`${SPECIES[b.id].name}: placed ${n} egg${n===1?'':'s'} in its nests.`,h,i,'eggs')}}limited=offered-placed;headline=`laid ${placed} eggs`;if(limited)add(`${limited} of the ${offered} offered eggs could not fit. Build nests for more room.`,1,null,'limit');break}
 case'scout':{const id=state.market[a.market];p.hand.push(id);if(!preview)state.market[a.market]=draw();headline=`took ${SPECIES[id].name}`;add(`Scout: took ${SPECIES[id].name} from the clearing.`,2);const offered=Math.min(2,p.birds[2].length);let n=0;for(let i=0;i<offered;i++)if(giveCard())n++;if(n)add(`Wetland birds: drew ${n} extra card${n===1?'':'s'}.`,2);if(n<offered)add(`Hand limit: ${offered-n} extra card${offered-n===1?'':'s'} could not fit.`,2,null,'limit');break}
 case'attract':{const id=p.hand.splice(a.hand,1)[0],c=SPECIES[id];p.food-=c.cost;p.birds[a.hab].push({id,nests:1,eggs:0,flock:0,used:false});title=`Attract ${c.name}`;headline=`attracted ${c.name}`;add(`${c.name} arrived in the ${HAB[a.hab].toLowerCase()}: −${c.cost} food, +${c.points} bird points, ${c.power==='cuckoo'?'no nest of its own; Forage to lay in another bird’s nest':'space for '+c.cap+' eggs'}.`,a.hab,p.birds[a.hab].length-1,'arrival');break}
 case'nest':{const b=p.birds[a.target[0]][a.target[1]];p.food--;b.nests++;headline=`built a nest for ${SPECIES[b.id].name}`;add(`${SPECIES[b.id].name}: −1 food, +1 nest, +2 egg spaces.`,...a.target,'nest');break}
 case'flock':{const b=p.birds[a.target[0]][a.target[1]],id=p.hand.splice(a.hand,1)[0];b.flock+=2;headline=`gathered a flock at ${SPECIES[b.id].name}`;add(`Discarded ${SPECIES[id].name}: ${SPECIES[b.id].name} gained 2 flock points.`,...a.target,'flock');break}
 }
 if(habitat!==undefined)for(let i=0;i<p.birds[habitat].length;i++){
  const b=p.birds[habitat][i],c=SPECIES[b.id];if(b.used)continue;b.used=true;let text='',effectHab=habitat,effectIndex=i;
  switch(c.power){
  case'cuckoo':{const host=cuckooHost(p);if(host){host.b.eggs++;text='+1 egg in '+SPECIES[host.b.id].name+'’s nest (first available host in your sanctuary)';effectHab=host.hab;effectIndex=host.index}else text='no other nest space; ability used. Attract another bird or build a nest on a host';break;}
  case'food':p.food++;text='+1 food';break;
  case'food2':p.food+=2;text='+2 food';break;
  case'egg':if(b.eggs<capacity(b)){b.eggs++;text='+1 egg in its nest'}else text='no egg space; ability used';break;
  case'egg2':{const n=Math.min(2,capacity(b)-b.eggs);b.eggs+=n;text=n?'+'+n+' egg'+(n===1?'':'s')+' in its nest'+(n<2?' (only one space free)':''):'no egg space; ability used';break;}
  case'flock':b.flock++;text='+1 flock point';break;
  case'flock2':b.flock+=2;text='+2 flock points';break;
  case'card':text=giveCard()?'+1 card':'hand full; ability used';break;
  }
  add(`${c.name} ability: ${text}.`,effectHab,effectIndex,'ability');
 }
 const final=totals(p),delta={food:p.food-food,cards:p.hand.length-cards,eggs:final.eggs-initial.eggs,flock:final.flock-initial.flock,nests:final.nests-initial.nests,points:score(p)-points};
 return {actor,title,headline,steps,frames,delta,goalDelta:goal(p)-potential,season:state.season,limited};
}
function previewAction(p,a){return legal(p,a)?resolveAction(clone(p),a,true):null}
function gainText(r){const labels={food:'food',cards:'cards',eggs:'eggs',flock:'flock',nests:'nests'};const parts=Object.entries(labels).filter(([k])=>r.delta[k]).map(([k,label])=>`${r.delta[k]>0?'+':'−'}${Math.abs(r.delta[k])} ${Math.abs(r.delta[k])===1?({cards:'card',eggs:'egg',nests:'nest'}[label]||label):label}`);return parts.join(' · ')||'No resource change'}
function exactPreview(p,a){
 const r=previewAction(p,a);if(!r)return unavailable(p,a);
 const ability=r.steps.filter(x=>x.kind==='ability').map(x=>x.text.replace(' ability:',':')).join(' ');
 const base=r.steps.filter(x=>x.kind!=='ability').map(x=>x.text.replace(' arrived in the ',' → ').replace('placed ','add ').replace('Scout: took ','Scout: take ').replace('Wetland birds: drew ','Wetland birds: draw ').replace('Discarded ','Discard ').replace(' gained ',' gains ')).join(' ');
 return `${base}${ability?' Then '+ability:''}${r.goalDelta?` ${SEASONS[state.season]} bonus potential ${r.goalDelta>0?'+':''}${r.goalDelta} points.`:''}`;
}
function nestDisplay(b){if(SPECIES[b.id].power==='cuckoo')return '<span class="tokens">Uses other birds’ nests</span>';let left=b.eggs;const bowls=Array.from({length:b.nests},(_,i)=>{const size=i===0?SPECIES[b.id].cap:2,n=Math.min(size,left);left-=n;return `<span class="nest-bowl" aria-hidden="true">${Array.from({length:size},(_,j)=>`<i class="nest-egg ${j<n?'filled':''}"></i>`).join('')}</span>`}).join('');return `<span class="bird-nests" role="img" aria-label="${b.nests} nests, ${b.eggs} eggs out of ${capacity(b)} spaces">${bowls}</span><span class="tokens">${b.nests} nest${b.nests===1?'':'s'} · ${b.eggs}/${capacity(b)} eggs</span>`}
function flockDisplay(b){if(!b.flock)return '<span class="tokens">Flock: 0</span>';return `<span class="bird-flock" role="img" aria-label="${b.flock} flock points">${Array.from({length:Math.min(6,b.flock)},()=>'<svg viewBox="0 0 18 12" aria-hidden="true"><path d="M1 8q4-9 8-1 4-8 8 1" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>').join('')}<b>${b.flock}</b><span class="small">flock points</span></span>`}
function currentAction(type){return {type,market:marketIndex,hand:selected,hab:selected===null?0:SPECIES[state.players[view].hand[selected]]?.hab,target}}
function actionButton(p,type,title){
 const a=currentAction(type),r=previewAction(p,a),turn=view===state.current&&!state.done&&!isResolving;
 const reason=!turn?(isResolving?'Showing turn effects…':state.done?'The year is complete.':'View the current player’s sanctuary to act.'):unavailable(p,a);
 return `<div class="action-option"><button data-do="${type}" ${turn&&r?'':'disabled'} ${reason?`aria-describedby="why-${type}"`:''}><b>${title}</b><span class="action-gain">${r?gainText(r):'Unavailable'}</span></button><p id="why-${type}" class="action-explanation">${reason||exactPreview(p,a)}</p></div>`;
}
function renderFeedback(){
 const el=document.getElementById('turn-feedback');el.classList.toggle('replaying',!!replayContext);
 if(replayContext){el.classList.remove('replaying');el.innerHTML=`<p class="small"><b>Turn explanation is beside the highlighted habitat.</b> ${replayController?.autoplay?'Playing slowly. You can pause at any time.':'Take your time, then choose Next effect.'}</p>`;return}
 const reports=state.lastTurns||[];
 el.innerHTML=reports.length?`<div class="recap-header"><b>Turn results</b><span class="small">${state.done?'The year is complete.':state.mode==='expansion'?'Next person: '+state.players[state.current].name:'Your sanctuary stays on screen.'}</span></div><div class="turn-recaps">${reports.map(r=>{const computer=isComputer(r.actor);return `<article class="${computer?'computer-recap':'player-recap'}"><div class="eyebrow">${computer?'Computer turn · '+state.players[r.actor].name:state.mode==='ai'?'Your turn':state.players[r.actor].name+'’s turn'}</div><p><b>${r.title}</b></p>${computer?`<p>The computer ${r.headline}.</p>`:''}<p><b>${gainText(r)}</b>${r.delta.points?` <span class="points-gained">+${r.delta.points} score</span>`:''}</p><details><summary>${computer?'Review computer move':'See how your move worked'}</summary><ol>${r.steps.map(s=>`<li>${s.text}</li>`).join('')}</ol>${r.goalDelta?`<p>${SEASONS[r.season]} bonus potential: +${r.goalDelta} points, awarded at the season’s end.</p>`:''}</details></article>`}).join('')}</div>`:'<p class="small">Your action will be explained beside your birds. The computer’s move will appear afterwards as a separate summary.</p>';
}
const COACH_LIMIT=3;
function newCoaching(season=0){return {remaining:COACH_LIMIT,recharged:Array.from({length:season+1},(_,i)=>i),tips:{}}}
function upgradeCoaching(game){if(game?.players)for(const p of game.players)if(!p.coaching)p.coaching=newCoaching(game.season)}
function refillCoaching(){
 state.players.forEach((p,i)=>{if(!isComputer(i)&&!p.coaching.recharged.includes(state.season)){p.coaching.remaining=Math.min(COACH_LIMIT,p.coaching.remaining+1);p.coaching.recharged.push(state.season)}});
}
function coachTurnKey(){return state.season+':'+state.turn}
function coachPosition(p){return JSON.stringify([state.season,state.turn,p.food,p.hand,p.birds,p.bonus,state.market])}
function revealedCoach(p){const tip=p.coaching.tips[coachTurnKey()];return tip?.position===coachPosition(p)?tip.choice:null}
function requestCoaching(){
 if(isResolving||state.done||view!==state.current||isComputer(state.current))return false;
 const p=state.players[state.current],account=p.coaching,key=coachTurnKey(),previous=account.tips[key];
 if(!previous&&account.remaining===0)return false;
 if(!revealedCoach(p)){
  const choice=coachSuggestion(p);if(!choice)return false;
  account.tips[key]={position:coachPosition(p),choice:{a:clone(choice.a),r:{title:choice.r.title},why:choice.why,context:choice.context}};
  if(!previous)account.remaining--;
 }
 coachEnabled=true;save();render();return true;
}
function toggleCoaching(){const p=state.players[state.current];if(coachEnabled&&revealedCoach(p)){coachEnabled=false;render()}else requestCoaching()}
function coachExplanation(p,a,r){
 const left=(3-state.season)*6+5-state.turn,free=room(p),afterFood=p.food+r.delta.food;
 let why='';
 switch(a.type){
 case'attract':{
  const c=SPECIES[p.hand[a.hand]],h=p.birds[c.hab].length;
  if(!left){why='Welcoming '+c.name+' adds to your final score. There is no time left to use its ability, so this is about finishing well.';break}
  if(left===1){why='Welcoming '+c.name+' banks its bird points before the year ends. There is little time left to make use of its ability.';break}
  if(c.hab===0)why=c.name+' will make food easier to gather, helping you welcome more birds and build nests later.';
  if(c.hab===1)why=c.name+' will make your meadow better at laying eggs. Keep some room in your nests so those eggs have somewhere to go.';
  if(c.hab===2)why=h<2?c.name+' will give you more choice when scouting, helping you find birds that suit your sanctuary.':'Your wetland already brings in plenty of cards. '+c.name+' earns its place through its own ability and the points it brings.';
  const gifts={food:'It can also help keep your food supply topped up.',food2:'It can also bring in a useful supply of extra food.',egg:'Its ability can help fill its own nest.',egg2:'Its ability can help fill its own nest.',card:'Its ability can bring another bird into your hand.',flock:'Its ability helps a flock grow around it.',flock2:'Its ability helps a flock grow around it.',cuckoo:cuckooHost(p)?'It can slip an egg into another bird’s nest.':'It will need another bird with room in its nest before it can lay an egg.'};
  why+=' '+gifts[c.power];
  break;
 }
 case'forage':{
  const unlocked=p.hand.map(id=>SPECIES[id]).filter(c=>p.birds[c.hab].length<3&&c.cost>p.food&&c.cost<=afterFood).sort((a,b)=>a.cost-b.cost);
  if(!left)why=r.delta.points?'The food will not count at the end, but your woodland birds can still help your score.':'Food will not count once the year ends, so this move will not improve your final score.';
  else if(unlocked.length)why='You do not yet have enough food for '+unlocked[0].name+'. Foraging now puts that bird within reach for a later turn.';
  else if(left===1)why=r.delta.points?'Your ready woodland birds can still help your score while you gather food.':'This adds food, but there is little time left to use it.';
  else if(p.food<2&&!p.birds.every(row=>row.length===3))why='Food is limiting your options. Gathering some now gives you more freedom to welcome birds or build nests later.';
  else if(p.birds.every(row=>row.length===3)){
   const canBuild=birds(p).some(b=>SPECIES[b.id].power!=='cuckoo'&&b.nests<3);
   why=r.delta.points?'Your habitats are full. This move is about getting help from your ready woodland birds.':canBuild&&p.food<1?'Your habitats are full, but gathering food lets you build nests for the birds already here.':'Your habitats are full, so there is little reason to gather food for more birds.';
  }else why='This restocks your food for birds and nests you may want later.';
  break;
 }
 case'scout':{
  const c=SPECIES[state.market[a.market]];
  const fits=p.birds[c.hab].length<3,handFits=p.hand.some(id=>p.birds[SPECIES[id].hab].length<3);
  if(!left)why='Scout brings '+c.name+' into your hand, but there is no later turn to play it.'+(r.delta.points?' The useful part is activating your ready wetland birds.':'');
  else if(!fits)why='There is no room for '+c.name+' in its habitat.'+(r.delta.points?' The reason to Scout here is to activate your ready wetland birds.':p.hand.length<2&&birds(p).length?' It can still give you a card to put towards a flock.':' More cards will not help you settle birds there.');
  else if(!handFits&&p.hand.length>=2)why='The cards you have do not fit the spaces left in your sanctuary. Scout brings '+c.name+' into your hand, giving you a bird with somewhere to settle.';
  else if(p.hand.length>=5)why='You already have plenty of cards.'+(r.delta.points?' This Scout is about getting help from your ready wetland birds.':' Another card can wait while you use the birds already in your hand.');
  else why=(p.hand.length<2?'Your hand is running thin. ':'')+'Scout brings '+c.name+' into your hand, giving you a fresh choice for your sanctuary or a card to put towards a flock.';
  if(!left)why+=' Cards left in your hand will not count towards the final score.';
  break;
 }
 case'eggs':
  why='There is room in your nests, so laying eggs turns that space into points.';
  if(r.limited)why+=' You will fill the remaining spaces, but some eggs will not fit.'+(left?' More nest space would help you make the most of a later egg action.':'');
  break;
 case'nest':{
  const b=p.birds[a.target[0]][a.target[1]],name=SPECIES[b.id].name;
  why=(free<2?'Your nests are nearly full. ':'')+'Give '+name+' more room'+(left?' so you can keep laying eggs later.':' in its nest, though you will not have another turn to fill it.');
  break;
 }
 case'flock':{
  const b=p.birds[a.target[0]][a.target[1]],discard=SPECIES[p.hand[a.hand]];
  why=(p.birds[discard.hab].length>=3?'Your '+HAB[discard.hab].toLowerCase()+' is full, so '+discard.name+' cannot settle there. ':'')+'Put the '+discard.name+' card towards a flock around '+SPECIES[b.id].name+'. You can score straight away without needing more food or spare nest space.';
  if(p.hand.length>=5)why+=' It also frees some room in your crowded hand.';
  break;
 }
 }
 const abilities=r.steps.filter(s=>s.kind==='ability').map(s=>{
  const name=s.text.split(' ability:')[0];
  if(s.text.includes('no other nest space'))return name+' needs another bird with room in its nest.';
  if(s.text.includes('no egg space'))return name+' cannot add an egg because its nest is full.';
  if(s.text.includes('hand full'))return name+' cannot bring in another card because your hand is full.';
  if(name==='Cuckoo'){const host=s.text.match(/egg in (.+?)’s nest/);return host?'Cuckoo slips an egg into '+host[1]+'’s nest.':'Cuckoo uses another bird’s nest.'}
  if(s.text.includes('food'))return name+' helps by bringing in more food.';
  if(s.text.includes('flock'))return name+' helps its flock grow.';
  if(s.text.includes('card'))return name+' brings another bird into your hand.';
  return name+(s.text.includes('+1 egg')?' adds an egg to its nest.':' adds eggs to its nest.');
 });
 if(abilities.length)why+=' '+abilities.join(' ');
 if(r.goalDelta)why+=' '+['Extra nests also help you earn the Spring bonus.','Those eggs also help with the Summer bonus.','Filling a different habitat also helps with the Autumn bonus.','Growing your flocks also helps with the Winter bonus.'][state.season];
 const context=left===0?'This is your last move. Make it count.':left<=3?'The year is nearly over. Look for points you can secure now.':['Spring rewards extra nests, with time to build for later.','In Summer, make good use of the nest space you have built.','Autumn rewards a mix of habitats.','Winter is the time to turn what you have built into a strong finish.'][state.season];
 const full=p.birds.every(row=>row.length===3);
 const practicalContext=left===0?context:full?'Your habitats are full. Make the most of the birds already here.':p.hand.length===8?'Your hand is full. Welcome a bird or put a card towards a flock before scouting again.':context;
 return {why,context:practicalContext};
}
function coachSuggestion(p){
 const available=options(p);if(!available.length)return null;
 const left=(3-state.season)*6+5-state.turn,free=room(p),eggAction=2+p.birds[1].length;
 const open=p.birds.map(row=>3-row.length),canSettle=id=>open[SPECIES[id].hab]>0;
 const usefulHand=p.hand.filter(canSettle),buildable=birds(p).some(b=>SPECIES[b.id].power!=='cuckoo'&&b.nests<3);
 const cheapest=usefulHand.length?Math.min(...usefulHand.map(id=>SPECIES[id].cost)):Infinity;
 const ranked=available.map(a=>{
  const r=previewAction(p,a);
  // Resource gains only matter if there are later moves which can use them.
  // Exact preview totals already account for full nests and the hand limit.
  let value=r.delta.points+r.goalDelta;
  if(left>0)switch(a.type){
  case'attract':{
   const c=SPECIES[p.hand[a.hand]],row=p.birds[c.hab].length;
   value+=Math.min(left,8)*.55;
   if(row===0)value+=1;
   if(free===0&&c.cap>0&&left>1)value+=1;
   break;
  }
  case'forage':{
   if(cheapest>p.food&&cheapest<=p.food+r.delta.food)value+=5;
   else if(usefulHand.length&&p.food<cheapest&&left>1)value+=2;
   if(p.food===0&&buildable&&free<eggAction&&left>1)value+=2.5;
   break;
  }
  case'scout':{
   const id=state.market[a.market],c=SPECIES[id],fits=canSettle(id);
   if(fits&&usefulHand.length===0)value+=c.cost<=p.food?4: left>1?2:0;
   else if(fits&&p.hand.length<4&&usefulHand.length<2)value+=2;
   // On a full board, a small hand can supply later flock actions.
   if(birds(p).length&&p.hand.length<2)value+=Math.min(left,r.delta.cards)*1.2;
   break;
  }
  case'nest':
   if(free<eggAction&&left>0)value+=Math.min(2,eggAction-free)*.8;
   break;
  case'flock':{
   const c=SPECIES[p.hand[a.hand]];
   // Keep useful recruits when there is time to play them; blocked cards
   // can be put towards a flock without losing an available bird.
   if(canSettle(c.id)&&left>1)value-=Math.min(2.5,c.points*.35);
   break;
  }
  }
  return {a,r,value};
 }).sort((a,b)=>b.value-a.value);
 const choice=ranked[0];return {...choice,...coachExplanation(p,choice.a,choice.r)};
}
function renderClarity(){
 const p=state.players[view];
 document.getElementById('new').disabled=isResolving;document.getElementById('mode').disabled=isResolving;
 document.getElementById('effects-toggle').textContent='Turn effects: '+(showTurnEffects?'on':'off');document.getElementById('effects-toggle').setAttribute('aria-pressed',String(showTurnEffects));
 const active=state.players[state.current],revealed=revealedCoach(active),paidTip=active.coaching.tips[coachTurnKey()],coachingButton=document.getElementById('coach-toggle');
 coachingButton.textContent=(paidTip?(coachEnabled&&revealed?'Hide tip':'Review tip'):'Ask coach')+' · '+active.coaching.remaining+' left';
 coachingButton.disabled=isResolving||state.done||view!==state.current||isComputer(state.current)||(!active.coaching.tips[coachTurnKey()]&&active.coaching.remaining===0);
 coachingButton.setAttribute('aria-pressed',String(!!revealed&&coachEnabled));
 coachingButton.title=paidTip?'Review this turn’s advice without spending another use.':active.coaching.remaining?'Reveal a tip for this turn. Costs one coaching use; reviewing the same turn is free.':'No coaching uses left. One returns next season, up to three.';
 document.getElementById('coach-allowance').textContent=state.done?'Coaching complete.':'Start with 3 uses · +1 each new season · maximum 3';
 document.getElementById('actions').innerHTML=[['forage','♣ Forage'],['eggs','Lay eggs'],['scout','Scout'],['attract',selected===null?'Attract a bird':`Attract ${SPECIES[p.hand[selected]]?.name||'a bird'}`],['nest','Build a nest'],['flock','Gather a flock']].map(([type,title])=>actionButton(p,type,title)).join('');
 document.getElementById('target').innerHTML=target&&p.birds[target[0]][target[1]]?`<p class="selection-note"><b>${SPECIES[p.birds[target[0]][target[1]].id].name}</b> is your selected sanctuary bird. ${SPECIES[p.birds[target[0]][target[1]].id].power==='cuckoo'?'It uses another bird’s nest when you Forage. You can also select a hand card and gather a flock.':'Build a nest here, or select a hand card and gather a flock.'}</p>`:'';
 document.querySelectorAll('[data-attract]').forEach(el=>{const a={type:'attract',hand:selected,hab:+el.dataset.attract};el.disabled=isResolving||view!==state.current||!legal(p,a);el.title=unavailable(p,a)||exactPreview(p,a)});
 renderFeedback();
 const box=document.getElementById('coach');coachChoice=coachEnabled&&!isResolving&&view===state.current&&!state.done?revealedCoach(p):null;
 box.hidden=!coachChoice;box.innerHTML=coachChoice?`<div><b>Coach suggests: ${coachChoice.r.title}</b><p>${coachChoice.why}</p><span class="small">${coachChoice.context}</span><p class="small">Saved for this turn · ${p.coaching.remaining} coaching use${p.coaching.remaining===1?'':'s'} left</p></div><button id="show-coach">Show this option</button>`:state.done?'The year is complete. Try a different approach next game.':isResolving?'Watch how each action changes the sanctuary.':'View the current player’s sanctuary for a suggestion.';
 if(isResolving&&replayContext){const s=replayContext.step;if(s.hab!==null){document.querySelectorAll('.habitat')[s.hab]?.classList.add('effect-habitat');if(s.index!==null)document.querySelector(`[data-bird="${s.hab},${s.index}"]`)?.classList.add('effect-bird')}document.getElementById('status').textContent=`${state.players[replayContext.report.actor].name}: ${s.text}`}
 renderLocalEffect();
}
function revealChoices(){if(!isResolving)document.getElementById('actions').scrollIntoView({block:'nearest',behavior:'instant'})}
function cancelReplay(){replayGeneration++;if(replayController)clearTimeout(replayController.timer);replayController=null;isResolving=false;replayContext=null}
function finishTurnPresentation(previousSeason){resetSelection();render();document.getElementById('turn-feedback').scrollIntoView({block:'nearest',behavior:'instant'});if(state.done)showEnd();else if(state.season!==previousSeason)showSeasonChange();else if(sharedScreen())openDialog(`<h2>Pass to ${state.players[state.current].name}</h2><p>The next sanctuary is ready. Close this when you have the screen.</p>`,'Ready to play')}
function prefersQuietMotion(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}
function stepGain(previous,current,step){
 const a=totals(previous),b=totals(current);
 if(step.kind==='arrival')return `+${score(current)-score(previous)} bird points`;
 const changes=[['nests',b.nests-a.nests],['eggs',b.eggs-a.eggs],['flock points',b.flock-a.flock],['food',current.food-previous.food],['cards',current.hand.length-previous.hand.length]];
 const positive=changes.filter(([,n])=>n>0);
 if(positive.length)return positive.map(([label,n])=>`+${n} ${n===1?({nests:'nest',eggs:'egg',cards:'card','flock points':'flock point'}[label]||label):label}`).join(' · ');
 return step.text.includes('no egg space')||step.text.includes('no other nest space')?'No egg space':step.text.includes('hand full')?'Hand full':step.kind==='limit'?'At capacity':'Effect applied';
}
function effectCalloutHTML(){
 const c=replayController,r=replayContext;if(!c||!r)return '';
 const final=c.cursor===c.frames.length-1,player=state.players[r.report.actor].name,turnLabel=state.mode==='ai'?'Your turn':player+'’s turn';
 return `<section class="effect-callout ${r.report.actor===1?'ranger-effect':''}" aria-label="Current turn effect"><div class="effect-callout-top"><b>${turnLabel} · ${r.report.title}</b><span>Effect ${c.cursor+1} of ${c.frames.length}</span></div><div class="effect-gain">${r.step.gain}</div><p class="effect-explanation">${r.step.text}</p><div class="effect-controls"><button data-replay="back" ${c.cursor===0?'disabled':''}>Back</button><button data-replay="play" aria-pressed="${c.autoplay}">${c.autoplay?'Pause':'Play slowly'}</button><button data-replay="next" class="primary">${final?(c.hasComputer?'See computer results':'Finish turn'):'Next effect →'}</button><button id="skip-effects">Skip turn</button></div><p class="effect-pacing">${c.autoplay?'Moves on after 4 seconds. Pause to read or use Back to revisit.':'Waiting for you. Use the green button to continue, Play slowly for automatic steps or Skip turn.'}</p></section>`;
}
function renderLocalEffect(){
 if(!isResolving||!replayContext||!replayController)return;
 const h=replayContext.step.hab,host=h===null?null:document.querySelectorAll('.habitat')[h];
 if(host){host.querySelector('.hab-head').insertAdjacentHTML('afterend',effectCalloutHTML());}
 else document.getElementById('turn-feedback').innerHTML=effectCalloutHTML();
}
function renderReplayFrame(frame){
 const {display,report,step,position}=frame;
 replayContext={report,step,position,total:report.frames.length};view=report.actor;selected=null;target=null;
 const finalState=state;state=display;try{render()}finally{state=finalState}
 const h=step.hab,host=h===null?document.querySelector('.effect-callout'):document.querySelectorAll('.habitat')[h];
 if(host)host.scrollIntoView({block:'center',behavior:'instant'});
 document.getElementById('effect-live').textContent=`${display.players[report.actor].name}: ${step.gain}. ${step.text} ${replayController.autoplay?'':'Choose Next effect when ready.'}`;
}
function showReplayStep(index){
 const c=replayController;if(!c||c.generation!==replayGeneration)return;
 clearTimeout(c.timer);c.cursor=Math.max(0,Math.min(index,c.frames.length-1));renderReplayFrame(c.frames[c.cursor]);
 if(c.autoplay){const generation=c.generation,cursor=c.cursor;c.timer=setTimeout(()=>{if(!replayController||replayGeneration!==generation||replayController.cursor!==cursor)return;advanceReplay()},4000)}
}
function finishReplay(){const c=replayController;if(!c)return;const season=c.previousSeason;cancelReplay();finishTurnPresentation(season)}
function advanceReplay(){const c=replayController;if(!c)return;if(c.cursor===c.frames.length-1)finishReplay();else showReplayStep(c.cursor+1)}
function clarityAct(a){
 if(isResolving||view!==state.current||state.done||isComputer(state.current)||!legal(state.players[state.current],a))return;
 history=clone(state);const previousSeason=state.season,first=apply(state.players[state.current],a);next();const reports=[first];while(!state.done&&isComputer(state.current))reports.push(ai());
 state.lastTurns=reports.map(({frames,...rest})=>rest);save();
 if(!showTurnEffects){finishTurnPresentation(previousSeason);return}
 const generation=++replayGeneration,display=clone(history),frames=[];display.lastTurns=[];
 const explainedReports=reports.filter(r=>r.actor===history.current);
 for(const report of explainedReports)for(let i=0;i<report.frames.length;i++){
  const source=report.frames[i],step={...source,gain:stepGain(display.players[report.actor],source.p,source)};
  display.players[report.actor]=clone(source.p);display.current=report.actor;
  frames.push({display:clone(display),report,step,position:i+1});
 }
 isResolving=true;replayController={frames,cursor:0,generation,previousSeason,hasComputer:reports.some(r=>isComputer(r.actor)),autoplay:autoReplay&&!prefersQuietMotion(),timer:null};showReplayStep(0);
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.id==='effects-toggle'){showTurnEffects=!showTurnEffects;try{localStorage.setItem('emote-flock-effects',showTurnEffects?'on':'off')}catch(e){}if(isResolving&&!showTurnEffects)finishReplay();else if(!isResolving)render()}
 if(b.id==='coach-toggle')toggleCoaching();
 if(b.id==='skip-effects'&&isResolving)finishReplay();
 if(b.dataset.replay&&replayController){const c=replayController;if(b.dataset.replay==='next')advanceReplay();else if(b.dataset.replay==='back'){c.autoplay=false;showReplayStep(c.cursor-1)}else if(b.dataset.replay==='play'){c.autoplay=!c.autoplay;autoReplay=c.autoplay;try{localStorage.setItem('emote-flock-pace',autoReplay?'auto':'guided')}catch(e){}showReplayStep(c.cursor)}if(replayController)document.querySelector(`[data-replay="${b.dataset.replay==='back'&&replayController.cursor===0?'next':b.dataset.replay}"]`)?.focus({preventScroll:true})}
 if(b.id==='show-coach'&&coachChoice){const a=coachChoice.a;selected=a.hand??null;target=a.target??null;marketIndex=a.market??0;render();document.querySelector(`[data-do="${a.type}"]`)?.focus()}
 if(b.dataset.do&&!isResolving)act(currentAction(b.dataset.do));
});



