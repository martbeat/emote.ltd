/* Turn explanations, exact action previews and optional coaching for Flock & Field. */
let showTurnEffects=true,coachEnabled=false,isResolving=false,replayGeneration=0,replayContext=null,coachChoice=null,replayController=null,autoReplay=false;
try{autoReplay=localStorage.getItem('emote-flock-pace')==='auto'}catch(e){}
try{showTurnEffects=localStorage.getItem('emote-flock-effects')!=='off';coachEnabled=localStorage.getItem('emote-flock-coach')==='on'}catch(e){}
const ACTION_NAMES={forage:'Forage',eggs:'Lay eggs',scout:'Scout',attract:'Attract a bird',nest:'Build a nest',flock:'Gather a flock'};
function unavailable(p,a){
 if(state.done)return 'The year is complete.';
 const b=a.target&&p.birds[a.target[0]]?.[a.target[1]];
 switch(a.type){
 case'forage':return '';
 case'eggs':return !birds(p).length?'Attract a bird to give your eggs a home.':room(p)===0?'All nests are full. Select a sanctuary bird and build a nest.':'';
 case'scout':return p.hand.length>=8?'Your hand is full (8 cards). Attract a bird or discard one into a flock.':'';
 case'attract':{const c=SPECIES[p.hand[a.hand]];if(!c)return 'Select a bird card in your hand.';if(a.hab!==c.hab)return `${c.name} belongs in the ${HAB[c.hab].toLowerCase()}.`;if(p.birds[a.hab].length>=3)return `Your ${HAB[a.hab].toLowerCase()} already has 3 birds.`;return p.food<c.cost?`Needs ${c.cost-p.food} more food. Forage first.`:''}
 case'nest':return !b?'Select a bird already in your sanctuary.':b.nests>=3?'This bird already has its maximum of 3 nests.':p.food<1?'Needs 1 food. Forage first.':'';
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
 case'attract':{const id=p.hand.splice(a.hand,1)[0],c=SPECIES[id];p.food-=c.cost;p.birds[a.hab].push({id,nests:1,eggs:0,flock:0,used:false});title=`Attract ${c.name}`;headline=`attracted ${c.name}`;add(`${c.name} arrived in the ${HAB[a.hab].toLowerCase()}: −${c.cost} food, +${c.points} bird points, space for ${c.cap} eggs.`,a.hab,p.birds[a.hab].length-1,'arrival');break}
 case'nest':{const b=p.birds[a.target[0]][a.target[1]];p.food--;b.nests++;headline=`built a nest for ${SPECIES[b.id].name}`;add(`${SPECIES[b.id].name}: −1 food, +1 nest, +2 egg spaces.`,...a.target,'nest');break}
 case'flock':{const b=p.birds[a.target[0]][a.target[1]],id=p.hand.splice(a.hand,1)[0];b.flock+=2;headline=`gathered a flock at ${SPECIES[b.id].name}`;add(`Discarded ${SPECIES[id].name}: ${SPECIES[b.id].name} gained 2 flock points.`,...a.target,'flock');break}
 }
 if(habitat!==undefined)for(let i=0;i<p.birds[habitat].length;i++){
  const b=p.birds[habitat][i],c=SPECIES[b.id];if(b.used)continue;b.used=true;let text='';
  switch(c.power){
  case'food':p.food++;text='+1 food';break;
  case'food2':p.food+=2;text='+2 food';break;
  case'egg':if(b.eggs<capacity(b)){b.eggs++;text='+1 egg in its nest'}else text='no egg space; ability used';break;
  case'egg2':{const n=Math.min(2,capacity(b)-b.eggs);b.eggs+=n;text=n?'+'+n+' egg'+(n===1?'':'s')+' in its nest'+(n<2?' (only one space free)':''):'no egg space; ability used';break;}
  case'flock':b.flock++;text='+1 flock point';break;
  case'flock2':b.flock+=2;text='+2 flock points';break;
  case'card':text=giveCard()?'+1 card':'hand full; ability used';break;
  }
  add(`${c.name} ability: ${text}.`,habitat,i,'ability');
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
function nestDisplay(b){let left=b.eggs;const bowls=Array.from({length:b.nests},(_,i)=>{const size=i===0?SPECIES[b.id].cap:2,n=Math.min(size,left);left-=n;return `<span class="nest-bowl" aria-hidden="true">${Array.from({length:size},(_,j)=>`<i class="nest-egg ${j<n?'filled':''}"></i>`).join('')}</span>`}).join('');return `<span class="bird-nests" role="img" aria-label="${b.nests} nests, ${b.eggs} eggs out of ${capacity(b)} spaces">${bowls}</span><span class="tokens">${b.nests} nest${b.nests===1?'':'s'} · ${b.eggs}/${capacity(b)} eggs</span>`}
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
 el.innerHTML=reports.length?`<div class="recap-header"><b>Turn results</b><span class="small">Your sanctuary stays on screen.</span></div><div class="turn-recaps">${reports.map(r=>{const computer=state.mode==='ai'&&r.actor===1;return `<article class="${computer?'computer-recap':'player-recap'}"><div class="eyebrow">${state.mode==='ai'?(computer?'Computer turn · The ranger':'Your turn'):state.players[r.actor].name+'’s turn'}</div><p><b>${r.title}</b></p>${computer?`<p>The computer ${r.headline}.</p>`:''}<p><b>${gainText(r)}</b>${r.delta.points?` <span class="points-gained">+${r.delta.points} score</span>`:''}</p><details><summary>${computer?'Review computer move':'See how your move worked'}</summary><ol>${r.steps.map(s=>`<li>${s.text}</li>`).join('')}</ol>${r.goalDelta?`<p>${SEASONS[r.season]} bonus potential: +${r.goalDelta} points, awarded at the season’s end.</p>`:''}</details></article>`}).join('')}</div>`:'<p class="small">Your action will be explained beside your birds. The computer’s move will appear afterwards as a separate summary.</p>';
}
function coachSuggestion(p){
 const available=options(p);if(!available.length)return null;const early=state.season<2;
 const ranked=available.map(a=>{const r=previewAction(p,a);let value=r.delta.points+r.goalDelta*.8,why=`This gains ${r.delta.points} score now${r.goalDelta?` and increases the ${SEASONS[state.season]} bonus by ${r.goalDelta}`:''}.`;
  if(a.type==='attract'&&early){const c=SPECIES[p.hand[a.hand]];value+=7+(p.birds[c.hab].length===0?3:0);why=`${c.name} strengthens ${['future food gathering','future egg actions','future card draws'][c.hab]}, as well as adding ${c.points} bird points.`}
  if(a.type==='forage'&&p.food<2&&early){value+=9;why='Food will let you attract birds and build nests on later turns.'}
  if(a.type==='scout'&&p.hand.length<2&&early){value+=8;why='A small hand limits your choices. Scout gives you more birds to attract or gather into flocks.'}
  if(a.type==='nest'&&room(p)<2&&state.season<3){value+=6;why='Your nests are nearly full. Extra space will make future egg actions more productive.'}
  if(a.type==='eggs'&&r.limited)value-=r.limited*.5;
  if(a.type==='flock'&&early)value-=2;
  return {a,r,value,why};
 }).sort((a,b)=>b.value-a.value);
 return ranked[0];
}
function renderClarity(){
 const p=state.players[view];
 document.getElementById('new').disabled=isResolving;document.getElementById('mode').disabled=isResolving;
 document.getElementById('effects-toggle').textContent='Turn effects: '+(showTurnEffects?'on':'off');document.getElementById('effects-toggle').setAttribute('aria-pressed',String(showTurnEffects));
 document.getElementById('coach-toggle').textContent='Coach: '+(coachEnabled?'on':'off');document.getElementById('coach-toggle').setAttribute('aria-pressed',String(coachEnabled));
 document.getElementById('actions').innerHTML=[['forage','♣ Forage'],['eggs','Lay eggs'],['scout','Scout'],['attract',selected===null?'Attract a bird':`Attract ${SPECIES[p.hand[selected]]?.name||'a bird'}`],['nest','Build a nest'],['flock','Gather a flock']].map(([type,title])=>actionButton(p,type,title)).join('');
 document.getElementById('target').innerHTML=target&&p.birds[target[0]][target[1]]?`<p class="selection-note"><b>${SPECIES[p.birds[target[0]][target[1]].id].name}</b> is your selected sanctuary bird. Build a nest here, or select a hand card and gather a flock.</p>`:'';
 document.querySelectorAll('[data-attract]').forEach(el=>{const a={type:'attract',hand:selected,hab:+el.dataset.attract};el.disabled=isResolving||view!==state.current||!legal(p,a);el.title=unavailable(p,a)||exactPreview(p,a)});
 renderFeedback();
 const box=document.getElementById('coach');coachChoice=coachEnabled&&!isResolving&&view===state.current&&!state.done?coachSuggestion(p):null;
 box.hidden=!coachEnabled;box.innerHTML=coachChoice?`<div><b>Coach suggests: ${coachChoice.r.title}</b><p>${coachChoice.why}</p><span class="small">A suggestion based on your sanctuary and this season. You choose the move.</span></div><button id="show-coach">Show this option</button>`:state.done?'The year is complete. Try a different approach next game.':isResolving?'Watch how each action changes the sanctuary.':'View the current player’s sanctuary for a suggestion.';
 if(isResolving&&replayContext){const s=replayContext.step;if(s.hab!==null){document.querySelectorAll('.habitat')[s.hab]?.classList.add('effect-habitat');if(s.index!==null)document.querySelector(`[data-bird="${s.hab},${s.index}"]`)?.classList.add('effect-bird')}document.getElementById('status').textContent=`${state.players[replayContext.report.actor].name}: ${s.text}`}
 renderLocalEffect();
}
function revealChoices(){if(!isResolving)document.getElementById('actions').scrollIntoView({block:'nearest',behavior:'instant'})}
function cancelReplay(){replayGeneration++;if(replayController)clearTimeout(replayController.timer);replayController=null;isResolving=false;replayContext=null}
function finishTurnPresentation(previousSeason){resetSelection();render();document.getElementById('turn-feedback').scrollIntoView({block:'nearest',behavior:'instant'});if(state.done)showEnd();else if(state.season!==previousSeason)showSeasonChange();else if(state.mode==='local')openDialog(`<h2>Pass to ${state.players[state.current].name}</h2><p>The next sanctuary is ready. Close this when you have the screen.</p>`,'Ready to play')}
function prefersQuietMotion(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}
function stepGain(previous,current,step){
 const a=totals(previous),b=totals(current);
 if(step.kind==='arrival')return `+${score(current)-score(previous)} bird points`;
 const changes=[['nests',b.nests-a.nests],['eggs',b.eggs-a.eggs],['flock points',b.flock-a.flock],['food',current.food-previous.food],['cards',current.hand.length-previous.hand.length]];
 const positive=changes.filter(([,n])=>n>0);
 if(positive.length)return positive.map(([label,n])=>`+${n} ${n===1?({nests:'nest',eggs:'egg',cards:'card','flock points':'flock point'}[label]||label):label}`).join(' · ');
 return step.text.includes('no egg space')?'No egg space':step.text.includes('hand full')?'Hand full':step.kind==='limit'?'At capacity':'Effect applied';
}
function effectCalloutHTML(){
 const c=replayController,r=replayContext;if(!c||!r)return '';
 const final=c.cursor===c.frames.length-1,player=state.players[r.report.actor].name,turnLabel=state.mode==='ai'?'Your turn':player+'’s turn';
 return `<section class="effect-callout ${r.report.actor===1?'ranger-effect':''}" aria-label="Current turn effect"><div class="effect-callout-top"><b>${turnLabel} · ${r.report.title}</b><span>Effect ${c.cursor+1} of ${c.frames.length}</span></div><div class="effect-gain">${r.step.gain}</div><p class="effect-explanation">${r.step.text}</p><div class="effect-controls"><button data-replay="back" ${c.cursor===0?'disabled':''}>Back</button><button data-replay="play" aria-pressed="${c.autoplay}">${c.autoplay?'Pause':'Play slowly'}</button><button data-replay="next" class="primary">${final?(c.hasComputer?'See computer move':'Finish turn'):'Next effect →'}</button><button id="skip-effects">Skip turn</button></div><p class="effect-pacing">${c.autoplay?'Moves on after 4 seconds. Pause to read or use Back to revisit.':'Waiting for you. Use the green button to continue, Play slowly for automatic steps or Skip turn.'}</p></section>`;
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
 if(isResolving||view!==state.current||state.done||!legal(state.players[state.current],a))return;
 history=clone(state);const previousSeason=state.season,first=apply(state.players[state.current],a);next();const reports=[first];if(state.mode==='ai'&&!state.done)reports.push(ai());
 state.lastTurns=reports.map(({frames,...rest})=>rest);save();
 if(!showTurnEffects){finishTurnPresentation(previousSeason);return}
 const generation=++replayGeneration,display=clone(history),frames=[];display.lastTurns=[];
 const explainedReports=state.mode==='ai'?reports.filter(r=>r.actor===history.current):reports;
 for(const report of explainedReports)for(let i=0;i<report.frames.length;i++){
  const source=report.frames[i],step={...source,gain:stepGain(display.players[report.actor],source.p,source)};
  display.players[report.actor]=clone(source.p);display.current=report.actor;
  frames.push({display:clone(display),report,step,position:i+1});
 }
 isResolving=true;replayController={frames,cursor:0,generation,previousSeason,hasComputer:state.mode==='ai'&&reports.some(r=>r.actor===1),autoplay:autoReplay&&!prefersQuietMotion(),timer:null};showReplayStep(0);
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.id==='effects-toggle'){showTurnEffects=!showTurnEffects;try{localStorage.setItem('emote-flock-effects',showTurnEffects?'on':'off')}catch(e){}if(isResolving&&!showTurnEffects)finishReplay();else if(!isResolving)render()}
 if(b.id==='coach-toggle'){coachEnabled=!coachEnabled;try{localStorage.setItem('emote-flock-coach',coachEnabled?'on':'off')}catch(e){}if(!isResolving)render()}
 if(b.id==='skip-effects'&&isResolving)finishReplay();
 if(b.dataset.replay&&replayController){const c=replayController;if(b.dataset.replay==='next')advanceReplay();else if(b.dataset.replay==='back'){c.autoplay=false;showReplayStep(c.cursor-1)}else if(b.dataset.replay==='play'){c.autoplay=!c.autoplay;autoReplay=c.autoplay;try{localStorage.setItem('emote-flock-pace',autoReplay?'auto':'guided')}catch(e){}showReplayStep(c.cursor)}if(replayController)document.querySelector(`[data-replay="${b.dataset.replay==='back'&&replayController.cursor===0?'next':b.dataset.replay}"]`)?.focus({preventScroll:true})}
 if(b.id==='show-coach'&&coachChoice){const a=coachChoice.a;selected=a.hand??null;target=a.target??null;marketIndex=a.market??0;render();document.querySelector(`[data-do="${a.type}"]`)?.focus()}
 if(b.dataset.do&&!isResolving)act(currentAction(b.dataset.do));
});



