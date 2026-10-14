import {VERSION,LIMITS,hash,validateDecisions,detect,overlap} from './core.mjs';
const enc=new TextEncoder();
export const WORKING_REVIEW_LIMIT=2*1024*1024;
const textField=(value,max)=>{if(typeof value!=='string'||value.length>max)throw new Error('Invalid working-review field.');return value;};
export async function saveWorkingReview(state,review){
  validateDecisions(state.text,state.decisions);
  return {schema:'emote-working-review/1',version:VERSION,savedAt:new Date().toISOString(),
    purpose:'Internal working review. Not a disclosure copy, authenticated approval or tamper-proof record.',
    source:{kind:state.kind,sha256:state.sourceHash,extractedTextSha256:await hash(enc.encode(state.text)),characters:state.text.length},
    caseReference:review.caseRef,reviewer:review.reviewer,checker:review.checker,
    decisions:state.decisions.map(({id,start,end,type,status,reason})=>({id,start,end,type,status,reason}))};
}
export async function restoreWorkingReview(plan,state){
  if(!plan||plan.schema!=='emote-working-review/1'||!plan.source||!Array.isArray(plan.decisions))throw new Error('This is not a supported working-review file.');
  if(plan.source.sha256!==state.sourceHash||plan.source.kind!==state.kind||plan.source.characters!==state.text.length||plan.source.extractedTextSha256!==await hash(enc.encode(state.text)))throw new Error('This working review does not match the loaded source. Load the unchanged original first.');
  if(plan.decisions.length>LIMITS.decisions)throw new Error('Too many saved decisions.');
  const ids=new Set();let nextId=1;
  const decisions=plan.decisions.map(item=>{
    if(!item||typeof item.id!=='string'||!/^R\d{4,6}$/.test(item.id)||ids.has(item.id))throw new Error('Invalid or duplicate saved decision reference.');
    ids.add(item.id);nextId=Math.max(nextId,Number(item.id.slice(1))+1);
    return {id:item.id,start:item.start,end:item.end,type:textField(item.type,80),status:item.status,reason:textField(item.reason,600)};
  });
  validateDecisions(state.text,decisions);
  // Restoring an incomplete/tampered plan must not suppress uncovered automatic suggestions.
  for(const candidate of detect(state.text))if(!decisions.some(d=>overlap(d,candidate))){
    if(decisions.length>=LIMITS.decisions)throw new Error('Too many saved and restored decisions.');
    decisions.push({...candidate,id:`R${String(nextId++).padStart(4,'0')}`});
  }
  return {decisions:validateDecisions(state.text,decisions),nextId,caseRef:textField(plan.caseReference,120),reviewer:textField(plan.reviewer,120),checker:textField(plan.checker,120)};
}
