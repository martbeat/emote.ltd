/* Wildlife recordings retain their individual licences. See assets/audio/wildhaven/CREDITS.md. */
const WILD_SOUNDS={
 fox:{file:'fox-barks.mp3',label:'Fox barks',credit:'British Library',source:'https://commons.wikimedia.org/wiki/File:Red_Fox_(Vulpes_vulpes)_(W1CDR0001529_BD12).ogg',licence:'CC BY-SA 4.0',url:'https://creativecommons.org/licenses/by-sa/4.0/',detail:'A red fox barking in Gloucestershire. A short excerpt from a genuine field recording.'},
 hedgehog:{file:'hedgehog-sleeping.mp3',label:'Hedgehog sleeping sounds',credit:'Fiver, der Hellseher',source:'https://commons.wikimedia.org/wiki/File:Sleeping_Hegehog.ogg',licence:'CC BY-SA 4.0',url:'https://creativecommons.org/licenses/by-sa/4.0/',detail:'Quiet sleeping sounds from a European hedgehog. This is a breathing recording, rather than a call.'},
 bat:{file:'soprano-pipistrelle-detector.mp3',label:'Soprano pipistrelle detector',credit:'Keoka',source:'https://commons.wikimedia.org/wiki/File:Keoka020524Pip55Stereo.ogg',licence:'CC BY 3.0',url:'https://creativecommons.org/licenses/by/3.0/',detail:'A real heterodyne detector recording from Devon. The detector converts ultrasound into audible clicks; this is not how unaided ears hear the bat.'}
};
const TRACK_SOURCES={trust:'https://www.wildlifetrusts.org/how-identify/identify-tracks',woodland:'https://www.woodlandtrust.org.uk/blog/animal-tracks-snow-print-identification/'};
const WILD_SIGNS={
 fox:{title:'A narrow four-toed print',clue:'Four toes sit above a compact pad, with the toes close together. Fox prints tend to look narrower than dog prints, but a single print can be misleading.',source:TRACK_SOURCES.woodland},
 badger:{title:'Five toes and long claws',clue:'A broad pad sits behind five toes. Long front-claw impressions are a useful clue, especially in soft mud.',source:TRACK_SOURCES.trust},
 otter:{title:'A splayed print by the water',clue:'Look for five toes and a broad pad near the bank. Webbing may show in soft mud, though sometimes only four toes leave a mark.',source:TRACK_SOURCES.trust},
 hedgehog:{title:'Tiny, starry footprints',clue:'A narrow print with three toes pointing forwards and two out to the sides. Some impressions show only four toes.',source:TRACK_SOURCES.trust},
 hare:{title:'Long hind feet in a bounding trail',clue:'Look for long hind-foot impressions with smaller fore-foot marks. Rabbit trails can look similar; size, spacing and habitat help you interpret the pattern.',source:TRACK_SOURCES.woodland},
 watervole:{title:'Little stars at the water’s edge',clue:'The hind print has five splayed toes, with the outer toes sticking sideways. Rat prints are similar, so use several clues together.',source:TRACK_SOURCES.trust}
};
let wildSoundEnabled=true,wildAudio=null,wildPlaying=null,wildSoundTimer=null,wildAudioGeneration=0;
try{wildSoundEnabled=localStorage.getItem('emote-wildhaven-sound')!=='off';}catch(e){}
function wildSoundStatus(text){const el=document.getElementById('soundStatus');if(el)el.textContent=text;const guide=document.getElementById('guideSoundStatus');if(guide)guide.textContent=text;}
function updateWildSoundUI(){
 const toggle=document.getElementById('soundToggle');if(toggle){toggle.textContent=wildSoundEnabled?'Sound: on':'Sound: muted';toggle.setAttribute('aria-pressed',String(wildSoundEnabled));}
 document.querySelectorAll('[data-listen]').forEach(b=>{const id=b.dataset.listen,playing=wildPlaying===id;b.textContent=playing?'■ Stop '+WILD_SOUNDS[id].label:(id==='bat'?'◉ Bat detector':'▶ '+WILD_SOUNDS[id].label);b.setAttribute('aria-pressed',String(playing));});
 const lamp=document.getElementById('detectorLamp');if(lamp){lamp.classList.toggle('detecting',wildPlaying==='bat');lamp.textContent=wildPlaying==='bat'?'Listening · 55 kHz detector recording':'Detector ready · soprano pipistrelle';}
}
function stopWildSound(message){
 wildAudioGeneration++;if(wildSoundTimer!==null){clearTimeout(wildSoundTimer);wildSoundTimer=null;}
 if(wildAudio){wildAudio.pause();wildAudio.currentTime=0;wildAudio=null;}wildPlaying=null;updateWildSoundUI();if(message)wildSoundStatus(message);
}
function toggleWildSound(){wildSoundEnabled=!wildSoundEnabled;if(!wildSoundEnabled)stopWildSound();try{localStorage.setItem('emote-wildhaven-sound',wildSoundEnabled?'on':'off');}catch(e){}updateWildSoundUI();wildSoundStatus(wildSoundEnabled?'Sound is on. Choose a recording to listen.':'Sound muted. You can still explore all the tracks and signs.');}
function playWildSound(id){
 const entry=WILD_SOUNDS[id];if(!entry)return;
 if(!wildSoundEnabled){wildSoundStatus('Sound is muted. Use “Sound: muted” at the top to enable it.');return;}
 if(wildPlaying===id){stopWildSound('Recording stopped.');return;}
 stopWildSound();const generation=wildAudioGeneration,player=new Audio('assets/audio/wildhaven/'+entry.file);wildAudio=player;wildPlaying=id;player.volume=.65;player.preload='none';updateWildSoundUI();wildSoundStatus('Loading '+entry.label.toLowerCase()+'…');
 player.onended=()=>{if(generation===wildAudioGeneration)stopWildSound('Recording finished.');};
 player.onerror=()=>{if(generation===wildAudioGeneration)stopWildSound('That recording could not load. Please try again.');};
 try{const promise=player.play();Promise.resolve(promise).then(()=>{if(generation!==wildAudioGeneration){player.pause();return;}wildSoundStatus(entry.detail);wildSoundTimer=setTimeout(()=>{if(generation===wildAudioGeneration)stopWildSound('Recording finished.');},6500);}).catch(()=>{if(generation===wildAudioGeneration)stopWildSound('Playback did not start. Tap the recording again to retry.');});}catch(e){stopWildSound('Playback is unavailable in this browser.');}
}
function wildSoundButton(id){return WILD_SOUNDS[id]?'<button class="listen-button" data-listen="'+id+'" aria-pressed="false">'+(id==='bat'?'◉ Bat detector':'▶ '+WILD_SOUNDS[id].label)+'</button>':'';}
function trackArt(id){
 if(!WILD_SIGNS[id])return '';
 let parts='';const toe=(x,y,rx=7,ry=10)=>'<ellipse data-toe="true" cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'"/>';
 if(id==='hare'){parts='<ellipse cx="37" cy="30" rx="9" ry="23"/><ellipse cx="73" cy="26" rx="9" ry="23"/><ellipse cx="49" cy="79" rx="6" ry="10"/><ellipse cx="65" cy="96" rx="6" ry="10"/>';}
 else if(id==='fox'){parts='<path d="M38 80Q26 65 39 58Q53 67 68 58Q83 65 72 80Q55 88 38 80Z"/>'+toe(34,43)+toe(48,28)+toe(66,28)+toe(80,43)+'<path d="M31 26l3-6 3 7M45 11l3-6 3 6M63 11l3-6 3 6M77 26l3-6 3 7"/>';}
 else if(id==='badger'){parts='<path d="M27 81Q17 62 34 60H80Q95 64 85 82Q57 97 27 81Z"/>'+[25,41,57,73,89].map((x,i)=>toe(x,43-Math.sin(i/4*Math.PI)*5,6,9)+'<path d="M'+(x-2)+' '+(25-Math.sin(i/4*Math.PI)*5)+'l2-15 2 15Z"/>').join('');}
 else if(id==='otter'){parts='<path d="M24 48L38 29L57 23L77 29L94 48L79 73L36 73Z" opacity=".25"/><ellipse cx="57" cy="77" rx="24" ry="18"/>'+toe(21,48)+toe(37,29)+toe(57,23)+toe(77,29)+toe(94,48);}
 else {parts='<ellipse cx="57" cy="78" rx="'+(id==='hedgehog'?14:19)+'" ry="22"/>'+toe(18,58,6,8)+toe(37,32,6,10)+toe(57,24,6,10)+toe(77,32,6,10)+toe(96,58,6,8);}
 return '<svg class="track-art" viewBox="0 0 115 115" role="img" aria-label="Simplified '+species(id).name+' track pattern, not to scale"><g fill="#6e624d">'+parts+'</g></svg>';
}
function signEntry(id){const sign=WILD_SIGNS[id];if(!sign)return '';return '<div class="sign-entry">'+trackArt(id)+'<div><h4>'+sign.title+'</h4><p>'+sign.clue+'</p><small>Schematic, not to scale · <a href="'+sign.source+'" target="_blank" rel="noopener">Identification source</a></small></div></div>';}
function discoverWildSign(){
 state.signs??=[];const id=residents().find(id=>WILD_SIGNS[id]&&!state.signs.includes(id));if(!id)return;
 state.signs.push(id);state.lastSign=id;const line='Field sign found: '+species(id).name+' · '+WILD_SIGNS[id].title.toLowerCase()+'.';state.message+=' '+line;log(line);
}
function renderWildNature(){
 const notes=state.signs||[];const count=document.getElementById('signCount');if(count)count.textContent=notes.length+' / '+Object.keys(WILD_SIGNS).length+' field signs recorded';
 const recent=document.getElementById('recentSign');if(recent){recent.hidden=!state.lastSign;recent.innerHTML=state.lastSign?'<b>Your latest field sign</b><p>'+species(state.lastSign).name+'</p>'+signEntry(state.lastSign):'';}
 updateWildSoundUI();
}
function showWildSigns(){
 const notes=state.signs||[];
 document.getElementById('signsList').innerHTML=Object.keys(WILD_SIGNS).map(id=>'<article class="notebook-entry"><div class="eyebrow">'+(notes.includes(id)?'✓ Recorded in your haven':'Field guide · not yet recorded')+'</div><h3>'+species(id).name+'</h3>'+signEntry(id)+'</article>').join('');
 document.getElementById('signsDialog').showModal();
}
function natureGuideExtras(id){return wildSoundButton(id)+(WILD_SOUNDS[id]?'<p class="recording-note">'+WILD_SOUNDS[id].detail+'</p>':'')+signEntry(id);}
function renderWildCredits(){
 const target=document.getElementById('wildCredits');if(!target)return;
 target.innerHTML=Object.values(WILD_SOUNDS).map(s=>'<p><b>'+s.label+'</b> · '+s.credit+' · <a href="'+s.source+'" target="_blank" rel="noopener">Original recording</a> · <a href="'+s.url+'" target="_blank" rel="noopener">'+s.licence+'</a>. Short excerpt, converted to mono MP3 with gentle fades. '+s.detail+'</p>').join('');
}
function initialiseWildNature(){
 document.getElementById('soundToggle').onclick=toggleWildSound;
 document.getElementById('signsBtn').onclick=showWildSigns;
 document.addEventListener('click',e=>{const b=e.target.closest('button[data-listen]');if(b&&!b.disabled)playWildSound(b.dataset.listen);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopWildSound('Recording stopped while the game is in the background.');});
 document.getElementById('guide').addEventListener('close',()=>stopWildSound());
 window.addEventListener('pagehide',()=>stopWildSound());
 renderWildCredits();renderWildNature();
}
