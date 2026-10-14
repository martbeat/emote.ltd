export const REASONS = Object.freeze({
 personal:['Personal information','Personal information outside the intended disclosure scope.'],
 contact:['Contact details','Contact details outside the intended disclosure scope.'],
 sensitive:['Sensitive information','Sensitive personal information withheld following review.'],
 confidential:['Confidential information','Confidential information withheld following review.'],
 privileged:['Privileged material','Material identified by the reviewer as legally privileged.'],
 scope:['Outside scope','Information outside the agreed scope of this copy.'],
 retain:['Retain after review','Information retained following review of the intended disclosure.'],
});
export function suggestReason(types){
 const parts=types.flatMap(x=>x.split(' + '));
 if(!parts.length)return null;
 if(parts.every(x=>['Email','Telephone','Street address','UK postcode'].includes(x)))return 'contact';
 if(parts.every(x=>['Person name','Email','Telephone','Street address','UK postcode','National Insurance number'].includes(x)))return 'personal';
 return null;
}
export function attachReasonPresets(input){
 const doc=input.ownerDocument,box=doc.createElement('fieldset');box.className='reason-presets';
 const legend=doc.createElement('legend');legend.textContent='Quick reason';box.append(legend);
 const radios=new Map();let currentTypes=[];
 for(const [key,label] of [...Object.entries(REASONS).map(([key,[label]])=>[key,label]),['custom','Custom / edit']]){
  const wrap=doc.createElement('label'),radio=doc.createElement('input');radio.type='radio';radio.name=input.id+'Preset';radio.value=key;
  radio.onchange=()=>{
   if(!radio.checked)return;
   if(key==='custom'){input.focus();return;}
   input.value=REASONS[key][1];input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
  };
  wrap.append(radio,doc.createTextNode(label));box.append(wrap);radios.set(key,radio);
 }
 const label=doc.createElement('label'),auto=doc.createElement('input');auto.type='checkbox';auto.id=input.id+'AutoReason';auto.checked=true;
 label.className='auto-reason';label.append(auto,doc.createTextNode('Auto-fill a suggested reason when this field is empty'));box.append(label);
 input.insertAdjacentElement('beforebegin',box);
 function sync(){
  const key=Object.entries(REASONS).find(([,v])=>v[1]===input.value)?.[0]||'custom';
  radios.get(key).checked=true;
 }
 function suggest(types=currentTypes){
  currentTypes=types;const key=suggestReason(types);
  if(auto.checked&&!input.value.trim()&&key)input.value=REASONS[key][1];
  sync();
 }
 input.addEventListener('input',sync);auto.onchange=()=>suggest();sync();
 return {sync,suggest,lock(value){for(const radio of radios.values())radio.disabled=value;auto.disabled=value;input.disabled=value;},reset(){input.value='';auto.checked=true;currentTypes=[];sync();}};
}
