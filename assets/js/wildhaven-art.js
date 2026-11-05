/* Original vector illustrations for Wildhaven. The diagrams are stylised, not identification keys. */
let wildArtSequence=0;
function wildlifeArt(a){
 const key='wh-art-'+(++wildArtSequence),dark='#443e34',cream='#eaddbf';
 const p=(d,f,s=dark,w=1.1)=>'<path d="'+d+'" fill="'+f+'" stroke="'+s+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
 const e=(x,y,rx,ry,f,s='none',w=1)=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+f+'" stroke="'+s+'" stroke-width="'+w+'"/>';
 const c=(x,y,r,f)=>e(x,y,r,r,f);
 const l=(d,col=dark,w=1.3)=>p(d,'none',col,w);
 const eye=(x,y,r=2.6)=>c(x,y,r,'#252b23')+c(x+.7,y-.8,r*.3,'#fff8df');
 const whiskers=(x,y,col='#a59b82')=>l('M'+x+' '+y+'l18-5m-18 9 20 2m-21 3 17 8',col,.7);
 const fur='url(#'+key+'-fur)',light='url(#'+key+'-light)';
 const paw=(x,y,w=12,col=a.colour)=>p('M'+x+' '+y+'l-2 16q5 5 '+w+' 1l-1-4-6-1 2-12Z',col)+l('M'+(x+2)+' '+(y+16)+'v3m4-3v3',dark,.6);
 let shapes='';
 const group=(body)=>'<g>'+body+'</g>';
 // Each family has individual proportions, markings and poses.
 if(['mouse','harvest','dormouse','yellowmouse','bankvole','fieldvole','watervole','rat','shrew','watershrew'].includes(a.id)){
  if(a.id==='dormouse'){
   shapes=p('M42 130Q94 122 192 130l17 7H35Z','#8c7755','#756346')+l('M54 128l28 5m55-4 32 5','#bca77c',1.2);
   shapes=p('M141 114Q68 139 62 87Q53 45 107 47Q153 45 167 89L145 112Q113 67 86 81Q75 99 103 109Z',fur)+e(127,94,38,27,fur,dark)+e(154,98,25,22,light,dark)+c(142,78,12,fur)+c(143,78,7,'#c78f7c')+e(173,105,6,5,cream)+c(180,105,2,'#413c31')+l('M155 97q5 5 10-1',dark,1.5)+l('M161 105l17-4m-17 8 15 5','#aa9d7e',.8)+l('M108 63q15 4 25 16m-52 9q3 12 13 16','#e1b967',1);
  }else if(a.id==='harvest'){
   shapes=l('M68 145Q95 79 83 15M161 145Q145 90 167 29M110 142Q115 80 131 29','#83966b',3)+l('M82 27l-12-8m13 20 12-8m70 8 10-9m-44 8 8-10','#a8af78',3);
   shapes+=p('M110 103Q143 148 155 110Q162 88 145 87Q129 85 139 103', 'none','#ac7f55',4)+e(113,85,24,31,fur,dark)+e(129,63,20,17,fur,dark)+c(118,48,11,fur)+c(118,48,6,'#cfa58c')+p('M117 85q13 3 14 18l-10 4-14-17Z',cream,'none')+l('M131 82l15-1m-26 23 12 7','#a87e56',5)+eye(137,61)+c(150,68,2.2,'#594139')+whiskers(146,71);
  }else{
   const vole=['bankvole','fieldvole','watervole'].includes(a.id),shrew=a.id.includes('shrew'),rat=a.id==='rat',yellow=a.id==='yellowmouse';
   const water=a.id==='watervole'||a.id==='watershrew';
   if(water)shapes+=l('M28 138q20-5 38 0m79 0q30-5 53 0M64 145q45-4 78 0','#94b3aa',1.5);
   const tail=shrew?'M74 119Q43 132 27 112':vole?(a.id==='watervole'?'M78 121Q37 130 24 104':'M75 122Q55 137 38 124'):rat?'M74 119Q22 147 19 119Q16 93 36 99':'M79 118Q21 147 20 115Q22 96 40 101';
   shapes+=l(tail,rat?'#b49b8b':a.colour,rat?5:3);
   shapes+=paw(92,113,14)+paw(150,116,11)+e(115,101,vole?47:43,vole?32:29,fur,dark);
   shapes+=p('M82 110Q105 127 143 117L158 110l-3 15q-32 14-67-1Z',water&&a.id==='watershrew'?'#f1e8d8':cream,'none');
   if(shrew){shapes+=p('M139 82Q162 72 179 92L204 107l-27 7-29-4Z',fur)+e(151,80,5,5,a.colour)+eye(174,94,1.7)+c(202,107,2.2,'#473a37')+whiskers(193,110);}
   else{const er=vole?8:rat?11:15;shapes+=e(157,97,25,23,fur,dark)+c(145,76,er,fur)+c(146,76,er*.58,vole?'#a48c76':'#d2aa96')+e(176,108,10,7,light)+eye(169,94,vole?2.2:3.1)+c(185,108,2.5,'#695048')+whiskers(178,111);}
   if(yellow)shapes+=p('M143 111q8 3 17-2l-2 10-15 3-5-8Z','#d6a442','none');
   shapes+=l('M91 83l5 4m5-8 5 4m12-6 6 4m-26 15 5 3m12-1 6 3','#e1c6a1',.8);
   if(a.id==='fieldvole')shapes+=l('M76 87l4-6 4 4 2-7 6 3m-12 20 5-3 2 5','#aaa28b',1.6);
  }
 }else if(a.id==='squirrel'){
  shapes=p('M96 120Q40 145 33 87Q17 40 49 26Q72 13 86 37Q93 62 66 70Q52 81 81 93L102 108Z',fur)+l('M50 33q-19 18-5 46m13-44q-11 15-4 28m-12 32q5 20 25 21','#da9b66',1.5);
  shapes+=e(115,103,29,34,fur,dark)+p('M120 81q23 16 13 43l-18 5q-8-26 5-48Z',cream,'none')+e(137,72,22,19,fur,dark)+p('M121 61l-2-28 17 23m8 0 11-22 2 31Z',fur)+l('M126 49l-5-16m27 13 5-13','#7f422d',2)+eye(146,69)+e(157,80,8,5,light)+c(165,79,2.3,'#473a30')+paw(101,119,20)+l('M133 95l13 5m-18 9 14-5','#974c31',6)+e(146,101,6,9,'#9b7646',dark)+whiskers(157,83);
 }else if(a.id==='hedgehog'){
  shapes=p('M39 117Q32 85 54 62Q81 40 117 58Q147 68 155 113L140 129H52Z','#715e48');
  for(let row=0;row<5;row++)for(let i=0;i<10-row;i++){const x=44+i*10+row*5,y=111-row*10;shapes+=l('M'+x+' '+y+'l3-9 3 8',i%2?'#c2aa79':'#a18b63',1.7);}
  shapes+=paw(61,118,12,'#8d7860')+paw(134,120,12,'#8d7860')+p('M137 92Q157 80 177 105l24 14-35 8-26-8Z',light)+c(150,93,9,'#ae9674')+c(151,93,5,'#c8b292')+eye(173,107,2.2)+c(200,118,4,'#433d33')+whiskers(185,121);
 }else if(['hare','rabbit'].includes(a.id)){
  const hare=a.id==='hare',base=hare?'#aa8f66':'#a38d76';
  shapes=c(65,116,12,'#ede2ca')+e(hare?111:106,hare?96:101,hare?43:43,hare?29:33,fur,dark)+e(97,112,24,23,fur,dark)+p('M78 121q10 14 42 7l9 6H79q-10-5-1-13Z',light)+paw(145,107,18,base);
  shapes+=p(hare?'M139 71Q115 14 127 12Q145 14 151 69M152 68Q151 4 164 8Q175 21 165 75Z':'M139 76Q128 30 139 30Q151 32 153 75M153 76Q158 29 170 34Q178 44 166 81Z',fur)+l(hare?'M129 23l15 42m18-45-3 45':'M140 42l7 26m20-24-8 26','#c8a59a',4)+p(hare?'M123 13q0 9 7 15m34-20q4 9 3 16':'M137 31l5 10m27-7-2 11','#514b3b','#514b3b',3);
  shapes+=e(154,86,25,22,fur,dark)+e(174,98,11,8,light)+eye(166,82,hare?3.4:3.1)+c(184,98,2.4,'#806256')+whiskers(176,103)+l('M87 82l5 5m6-10 4 4m13-1 6 5','#d6c09b',1);
 }else if(a.id==='fox'){
  shapes=p('M90 103Q45 79 24 103Q12 125 47 133Q74 140 112 117Z',fur)+p('M22 111q-4 20 27 20l-5-25q-10-7-22 5Z','#eee2c7');
  shapes+=paw(93,113,13,'#5a4634')+paw(151,112,13,'#5a4634')+p('M69 100Q85 65 132 75Q155 77 168 99l-17 20H89Z',fur)+p('M144 83q16 11 6 34l-20 4q7-16 14-38Z',cream,'none');
  shapes+=p('M149 78l-4-35 24 20 22-24-2 40 24 15-35 22-32-19Z',fur)+p('M151 51l14 20-11 2Zm31 19 6-22-16 19Z','#704f43')+p('M151 85l27 26 27-16-25 1Z','#f0dfc1','none')+eye(176,80)+p('M208 92l9 3-8 5Z','#3c342b')+l('M156 75l7-4m-63 17 8-4m5 5 9-3','#e3ab6d',1.1)+whiskers(196,103);
 }else if(a.id==='badger'){
  shapes=p('M69 105Q41 117 24 113l13 14 41-5Z','#696b61')+paw(81,109,17,'#4a4c42')+paw(145,110,17,'#4a4c42')+p('M53 103Q59 62 111 62Q158 62 166 106l-14 21H77Z',fur)+p('M146 83Q162 65 180 81l33 28-28 15-39-16Z','#e7e2ce');
  shapes+=e(159,77,9,9,'#464b42')+e(159,77,5,5,'#eee3ca')+p('M162 76l17 8 21 26-15 8-19-25-13-9Z','#3f433b','none')+p('M180 83l5-4 22 24-7 6Z','#53554a','none')+eye(180,95,2.1)+e(212,109,5,3,'#383b33')+l('M69 82l7-9m3 10 8-11m4 9 10-11m7 9 10-10m4 9 10-7','#bac0ac',1.1)+whiskers(203,115,'#a4a395');
 }else if(['marten','stoat','weasel','polecat'].includes(a.id)){
  const marten=a.id==='marten',polecat=a.id==='polecat',stoat=a.id==='stoat',weasel=a.id==='weasel';
  const tail=marten?'M78 113Q37 145 22 107Q26 94 41 109l43-14':stoat?'M76 114Q34 140 19 115Q15 105 26 109l54-8':weasel?'M78 115Q44 133 32 122l8-9 40-12':'M78 114Q26 140 21 111l16-3 46-8';
  shapes=p(tail,fur)+((stoat)?p('M20 110q-7 5 3 14l13 2-5-15Z','#302e29','none'):'');
  shapes+=paw(90,110,12)+paw(149,109,12)+p('M65 112Q70 84 118 86Q150 87 160 103l-7 18-75 2Z',fur)+p('M92 115q38 9 65-10l-1 16-62 4Z',weasel||stoat?'#f0e5c8':'#c4ad85','none')+p('M148 100Q149 72 169 72Q189 71 196 90l-5 17-27 6Z',fur)+c(157,75,marten?10:7,fur)+c(157,75,marten?6:4,'#c0a087');
  if(marten)shapes+=p('M158 91q11 8 26 6l-4 14-15 10-13-12Z','#e6c47e','none');
  if(polecat)shapes+=p('M163 82q13-6 24 4l7 12-10 11-25-2-6-13Z','#dfd2b2','none')+p('M161 88l13 2 7-5 9 8-7 10-18-5Z','#4c3d32','none');
  shapes+=e(190,102,10,6,cream)+eye(181,88,2.3)+c(200,102,2.5,'#493b31')+whiskers(191,106)+l('M83 96l7-2m4-2 7-1m9 0h7',marten?'#ad8b62':'#c49a6c',.9);
 }else if(a.id==='otter'){
  shapes=l('M23 141q43-4 71 0m27 0q48-4 83 0','#7ea9a0',1.4)+p('M90 110Q54 126 24 118Q42 142 99 123Z',fur)+p('M75 113Q74 83 117 82Q154 80 173 100l-6 24-73 8Z',fur)+p('M110 118q36 9 58-13l-3 18-54 7Z','#b09a7c','none')+p('M88 118l-7 12 20 2 5-10m44-3 7 12 20-1-11-15',a.colour)+e(174,92,27,22,fur,dark)+c(157,77,7,fur)+c(157,77,3,'#a3907c')+e(193,101,15,10,'#cdb995')+eye(185,87)+e(206,99,4,3,'#343b31')+whiskers(197,108,'#ddd3b5')+l('M162 129l3-6m4 6 1-6m-77 6 3-6','#67523f',.8);
 }else if(a.id==='beaver'){
  shapes=l('M20 144q28-5 57 0m76 0q31-5 63 0','#7ea9a0',1.4)+p('M88 113Q43 97 20 119Q19 140 54 143l45-19Z','#655844');
  for(let i=0;i<5;i++)shapes+=l('M'+(27+i*10)+' 121l15 17m'+(-14+i*3)+'-18-13 18','#948269',.8);
  shapes+=e(115,102,46,34,fur,dark)+paw(94,117,17,'#6c5844')+paw(154,116,18,'#6c5844')+e(163,86,29,27,fur,dark)+c(149,65,8,fur)+c(149,65,4,'#aa8e74')+e(185,100,15,11,light)+eye(176,80,2.8)+c(200,97,3,'#42392d')+p('M189 107l9 1-2 12-6-1Z','#d7a25d')+l('M194 108l-1 10','#83613a',.8)+whiskers(188,105)+l('M85 88l7-4m1 11 9-3m8-12 8-2','#bc9a6f',1);
 }else if(a.id==='roedeer'){
  shapes=p('M65 90l-1 43h8l7-38m60-1 7 40h8l-4-49','#9b7650')+p('M80 88l-1 46h9l8-42m54-9 14 49h9l-9-45',fur)+l('M79 133h9m59 0h8m11-1h8','#463c30',3);
  shapes+=e(113,80,48,25,fur,dark)+e(69,82,10,17,'#e9ddbc')+p('M143 83Q146 67 152 53l10-17 15 16-7 43-19 8Z',fur)+p('M162 45Q138 26 143 20Q161 19 171 39M171 40Q184 15 192 22Q195 34 178 48Z',fur)+l('M149 25l14 12m23-10-9 13','#bba78c',3)+p('M163 42q16-5 24 10l10 17-13 9-21-11Z',fur)+e(192,67,8,6,'#d4bd96')+c(199,67,3,'#494334')+eye(180,49,2.7)+l('M161 32l-6-15 3-9m-3 12-9-4m27 16 6-17-2-8m2 12 8-6','#796446',3)+l('M88 68l8-3m5 1 8-2m10 1 7 2','#d8b685',1);
 }else if(a.id==='wildcat'){
  shapes=p('M76 111Q36 131 28 108Q18 86 30 82Q43 85 45 105l38-8Z','#8a8671')+c(30,85,5,'#3d4439')+l('M28 87l10 3m-12 7 16 2m-10 10 14-1','#3d4439',5)+paw(90,108,16,'#8a8671')+paw(148,108,15,'#8a8671')+e(117,94,44,28,fur,dark)+p('M149 79l-4-25 19 9 22-12-1 28q15 24-8 32-34 0-28-32Z',fur)+p('M151 60l10 11-10 2m25-7 6-8v13Z','#c8ac9d','none')+e(177,96,18,11,cream)+eye(166,83,2.6)+eye(185,80,2.4)+p('M178 93l7-1-3 5Z','#aa8474')+whiskers(180,101)+l('M91 73l4 17m13-23 1 18m14-17-2 17m15-11-3 17m17 2 7 4m-1-23 10 3m5-16 2 12','#41473b',3.5);
 }else if(['bat','commonpip','daubenton'].includes(a.id)){
  const daub=a.id==='daubenton',common=a.id==='commonpip';
  shapes=p(daub?'M116 71Q71 31 18 53Q38 65 42 96Q68 77 85 113L116 127 143 112Q171 78 195 96Q202 62 225 48Q170 33 127 71Z':common?'M114 68Q61 17 14 37Q38 55 42 93Q67 70 83 109L117 128 149 108Q175 70 198 91Q204 53 229 32Q175 15 127 67Z':'M115 66Q65 22 17 44Q37 53 42 89Q66 71 83 109L118 128 148 108Q174 68 199 91Q201 56 226 39Q176 25 128 66Z','#66574f');
  shapes+=p('M119 75Q78 38 30 47Q58 53 65 76L91 111 119 121 148 109 176 72 210 44Q169 46 124 76Z','#8e7767','none')+l('M120 75L30 47m88 31L65 76m55 3-29 32m32-36 87-31m-87 35 53-7m-52 8 24 29','#c0a48a',1.2)+p('M110 72l-1-22 12 10 12-11-2 25Z',fur)+e(121,92,13,27,fur,dark)+e(121,98,9,17,daub?'#e4d8bf':common?'#9e896e':'#c1a078')+e(121,75,15,12,daub?'#ad8f85':'#5b4940',dark)+eye(115,73,1.7)+eye(127,73,1.7)+c(121,80,2,'#44342f')+l(daub?'M114 118l-11 11m5-7-7 2m11 1-3 6m18-13 12 11m-8-7 8 2m-12 1 3 6':'M115 117l-5 8m17-8 5 8','#645345',daub?2:1.3);
  if(daub)shapes+=l('M22 142q37-5 63 0m65 0q33-5 63 0','#87aca2',1);
 }
 if(!shapes)throw new Error('Missing Wildhaven illustration: '+a.id);
 const habitat=a.home===2?'#dcebe5':a.home===1?'#ece7ce':'#e3ead5';
 const plants=a.home===2?l('M34 139l-3-38m6 38 6-27m160 28 4-38','#98aa83',1.6)+p('M29 109l-1-15q4-5 7 0l1 15Z','#a48d68','none'):l('M26 139l-4-17m6 17 6-20m173 20 3-20m-7 20-5-10','#a3ad7d',1.6);
 return '<svg class="wildlife-illustration" viewBox="0 0 240 160" role="img" aria-label="Illustration of '+a.name+'"><defs><linearGradient id="'+key+'-fur" x1="0" y1="0" x2=".35" y2="1"><stop stop-color="'+a.colour+'"/><stop offset="1" stop-color="'+a.colour+'" stop-opacity=".83"/></linearGradient><linearGradient id="'+key+'-light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+cream+'"/><stop offset="1" stop-color="'+a.colour+'"/></linearGradient></defs><ellipse cx="123" cy="91" rx="102" ry="60" fill="'+habitat+'"/><ellipse cx="119" cy="137" rx="91" ry="6" fill="#4d53371c"/>'+plants+'<g stroke-linecap="round" stroke-linejoin="round">'+shapes+'</g></svg>';
}
const WILD_FIELD_NOTES={
 mouse:'Large ears, bright eyes and a long, fine tail.',
 squirrel:'Russet fur, a full bushy tail and pointed ear tufts.',
 dormouse:'Golden fur, a furry tail and a curled resting pose.',
 marten:'A long bushy tail, rounded ears and a pale cream throat bib.',
 badger:'A low, sturdy body and bold black-and-white facial stripes.',
 hedgehog:'A cloak of spines above a small, pointed face.',
 hare:'Long legs and very long ears with dark tips.',
 harvest:'A tiny climber, shown gripping stems with its slender tail.',
 fox:'A narrow muzzle, dark lower legs and a bushy, pale-tipped tail.',
 shrew:'A sharply pointed nose and small eyes and ears.',
 otter:'A streamlined body, broad whiskered muzzle and tapering tail.',
 watervole:'A rounded muzzle, small ears and a stocky body.',
 watershrew:'A pointed nose, dark upperparts and a pale underside.',
 bat:'A tiny pipistrelle in flight. The 55 kHz detector recording helps distinguish this species from the common pipistrelle.',
 bankvole:'Warm chestnut upperparts, a blunt nose and a relatively short tail.',
 roedeer:'Large ears, slender legs and a pale rump patch; shown here with a buck’s short branched antlers.',
 wildcat:'A broad head, striped coat and thick, dark-ringed tail with a blunt dark tip.',
 yellowmouse:'A yellow band across the neck helps distinguish it from the very similar wood mouse.',
 rabbit:'A rounded body, shorter ears than a hare and a pale fluffy tail.',
 stoat:'A long slender body and a black tail tip; shown in its brown summer coat.',
 weasel:'A small slender hunter with a short tail and no black tail tip.',
 polecat:'Dark fur with a contrasting pale face and dark eye mask.',
 fieldvole:'A shaggy grey-brown coat, blunt nose and small, partly hidden ears.',
 beaver:'A broad, flattened tail, rounded body and strong orange-toned incisors.',
 rat:'A pointed muzzle and a long, mostly bare tail; a familiar adaptable riverside mammal.',
 daubenton:'A pale underside and large feet, used when taking insects from the water surface.',
 commonpip:'A tiny brown bat. It looks very similar to the soprano pipistrelle; their detector calls are more useful than these stylised drawings.'
};
