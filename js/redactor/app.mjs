import {VERSION,LIMITS,normaliseText,hash,importDocx,detect,findLiteral,overlap,applyDecisions,canRelease,buildDocx,verifyDocx} from './core.mjs';
const $=id=>document.getElementById(id), enc=new TextEncoder();
let state=empty(),generation=0,revision=0,page=0,nextId=1,dirty=false,prepared=null,urls=[];
function empty(){return {text:'',sourceHash:'',kind:'',warnings:[],decisions:[],started:null};}
function status(message,error=false){$('status').textContent=message;$('status').className=error?'error':'';}
function revoke(){for(const url of urls)URL.revokeObjectURL(url);urls=[];prepared=null;}
function invalidate(){revision++;revoke();for(const id of ['complete','checkedOutput','authorised'])$(id).checked=false;updateGate();}
function review(){return {caseRef:$('caseRef').value,reviewer:$('reviewer').value,checker:$('checker').value,complete:$('complete').checked,output:$('checkedOutput').checked,authorised:$('authorised').checked};}
function ready(){return state.kind!=='DOCX' && !dirty && canRelease(state.text,state.decisions,review());}
function updateGate(){
  const pending=state.decisions.filter(d=>d.status==='pending').length;
  const missing=state.decisions.filter(d=>d.status!=='pending'&&!d.reason.trim()).length;
  $('prepare').disabled=!ready();
  for(const id of ['downloadDocx','downloadTxt','downloadReport'])$(id).disabled=!prepared;
  $('releaseState').textContent=prepared?'Export prepared':ready()?'Ready to prepare':'Review required';
  $('gate').textContent=state.kind==='DOCX'&&!dirty?'Word-source export is blocked: this engine reconstructs text and cannot preserve the original layout. Review decisions are for evaluation only until a layout-preserving engine is implemented.':dirty?'Source input changed. Load it before continuing.':!state.text?'Load a source to start the review.':pending?`${pending} pending decision${pending===1?'':'s'} must be resolved.`:missing?`${missing} decision${missing===1?' needs':'s need'} a reason.`:!ready()?'Enter the case reference and two different reviewer names, then complete all three checks.':prepared?'Checked exports prepared. Download the copy and its separate decision record.':'All review fields are complete. You can prepare the export.';
  for(const id of ['mark','find'])$(id).disabled=!state.text||dirty;
  $('bulk').disabled=dirty||!visible().some(d=>d.status==='pending');
}
function visible(){return state.decisions.filter(d=>$('filter').value==='all'||d.status===$('filter').value).slice(page*20,(page+1)*20);}
function assign(item){return {...item,id:`R${String(nextId++).padStart(4,'0')}`};}
function render(){
  $('source').value=state.text;$('output').value=applyDecisions(state.text,state.decisions);
  const pending=state.decisions.filter(d=>d.status==='pending').length,redacted=state.decisions.filter(d=>d.status==='redact').length;
  $('counts').textContent=state.text?`${pending} pending · ${redacted} redact · ${state.decisions.filter(d=>d.status==='keep').length} keep`:'No source loaded';
  $('sourceInfo').hidden=!state.text;$('sourceLabel').textContent=state.text?`${state.kind} · ${state.text.length.toLocaleString()} characters · SHA-256 ${state.sourceHash.slice(0,16)}…`:'';
  $('warnings').replaceChildren(...state.warnings.map(w=>{const li=document.createElement('li');li.textContent=w;return li;}));
  renderDecisions();updateGate();
}
function renderDecisions(){
  const all=state.decisions.filter(d=>$('filter').value==='all'||d.status===$('filter').value),pages=Math.max(1,Math.ceil(all.length/20));page=Math.min(page,pages-1);
  const host=$('decisions');host.replaceChildren();
  if(!all.length){const p=document.createElement('p');p.className='empty';p.textContent=state.text?'No decisions in this view. Read the whole source and mark anything else that needs a decision.':'Load a source to begin.';host.append(p);}
  for(const d of visible()){
    const row=document.createElement('article');row.className='decision';row.dataset.status=d.status;
    const context=document.createElement('div'),meta=document.createElement('span'),snippet=document.createElement('span');
    meta.className='meta';meta.textContent=`${d.id} · ${d.type} · ${d.status.toUpperCase()}`;
    snippet.className='snippet';const start=Math.max(0,d.start-45),end=Math.min(state.text.length,d.end+45);
    snippet.append(document.createTextNode((start?'…':'')+state.text.slice(start,d.start)));
    const strong=document.createElement('strong');strong.textContent=state.text.slice(d.start,d.end);snippet.append(strong,document.createTextNode(state.text.slice(d.end,end)+(end<state.text.length?'…':'')));context.append(meta,snippet);
    const reasonWrap=document.createElement('div'),label=document.createElement('label'),reason=document.createElement('input');reason.type='text';reason.maxLength=600;reason.id=`reason-${d.id}`;reason.value=d.reason;reason.placeholder='Reason for withholding or keeping';label.htmlFor=reason.id;label.textContent=`Reason · ${d.id}`;reason.addEventListener('input',()=>{d.reason=reason.value;invalidate();});reasonWrap.append(label,reason);
    const buttons=document.createElement('div');buttons.className='buttons';
    function button(text,action,selected=false){const b=document.createElement('button');b.textContent=text;if(selected)b.className='selected';b.addEventListener('click',action);buttons.append(b);}
    for(const [value,text] of [['redact','Redact'],['keep','Keep'],['pending','Reset']])button(text,()=>{if(dirty)return status('Load the changed source before making decisions.',true);d.status=value;invalidate();render();},d.status===value);
    button('Locate',()=>{$('source').focus();$('source').setSelectionRange(d.start,d.end);});
    button('Remove',()=>{state.decisions=state.decisions.filter(x=>x!==d);restoreSuggestions();invalidate();render();status('Decision removed. Automatic identifiers are suggested again; use Keep with a reason if they should remain.');});
    row.append(context,reasonWrap,buttons);host.append(row);
  }
  $('page').textContent=all.length?`Page ${page+1} of ${pages} · ${all.length} decisions`:'';$('prev').disabled=page===0;$('next').disabled=page>=pages-1;
}
function abandon(){return !state.text || window.confirm('Replace this review? Unsaved decisions and prepared exports will be lost.');}
async function loadSource(kind,bytes,textValue){
  if(!abandon())return;
  const token=++generation;invalidate();state=empty();dirty=true;page=0;nextId=1;render();status('Reading and checking source…');
  try{
    const result=kind==='DOCX'?await importDocx(bytes):{text:normaliseText(textValue),warnings:['Pasted text only: compare with the original. Content omitted when copying cannot be checked here.']};
    const sourceHash=await hash(bytes);if(token!==generation)return;
    state={text:result.text,sourceHash,kind,warnings:result.warnings,decisions:detect(result.text).map(assign),started:new Date().toISOString()};dirty=false;render();status('Source loaded. Review suggestions and mark any other sensitive passages.');
  }catch(e){if(token!==generation)return;state=empty();dirty=false;render();status(e.message,true);}
}
$('load').addEventListener('click',()=>{const text=$('paste').value;loadSource('Pasted text',enc.encode(text),text);});
$('file').addEventListener('change',async()=>{const f=$('file').files[0];if(!f)return;const token=++generation;invalidate();dirty=true;updateGate();if(!/\.docx$/i.test(f.name)||f.size>LIMITS.file){status('Choose a DOCX file no larger than 12 MB.',true);return;}try{const bytes=new Uint8Array(await f.arrayBuffer());if(token===generation)await loadSource('DOCX',bytes);}catch(e){status(`Could not read file: ${e.message}`,true);}});
$('paste').addEventListener('input',()=>{generation++;if(state.text){dirty=true;invalidate();status('Text input changed. Choose “Use this text” to start a fresh review.');}});
$('example').addEventListener('click',()=>{const example='Witness statement\n\nMy name is Alex Morgan. Please contact me at alex.morgan@example.org or 07700 900123.\nMy correspondence address is 14 Example Road, Reading, RG1 1AA.\n\nI spoke with Sam Taylor on 12 September. The attached advice discusses our litigation strategy.\n\nThis is fictional test material. Names, the street address and the sensitive passage need manual review.';loadSource('Fictional example',enc.encode(example),example);});
$('clear').addEventListener('click',()=>{if(!abandon())return;generation++;state=empty();dirty=false;page=0;nextId=1;invalidate();for(const id of ['paste','file','term','bulkReason','caseRef','reviewer','checker'])$(id).value='';render();status('Session cleared. Downloaded files remain on your device.');});
function restoreSuggestions(){
  for(const candidate of detect(state.text))if(!state.decisions.some(d=>overlap(d,candidate)))state.decisions.push(assign(candidate));
  state.decisions.sort((a,b)=>a.start-b.start);
}
function addRanges(ranges,type){
  if(!state.text||dirty)return;
  let added=0,skipped=0;
  if(state.decisions.length+ranges.length>LIMITS.decisions)throw new Error('Too many decisions. Use a more specific search.');
  for(const r of ranges){const intersecting=state.decisions.filter(d=>overlap(d,r));if(intersecting.some(d=>d.start<r.start||d.end>r.end)){skipped++;continue;}state.decisions=state.decisions.filter(d=>!intersecting.includes(d));state.decisions.push(assign({...r,type,status:'pending',reason:''}));added++;}
  state.decisions.sort((a,b)=>a.start-b.start);invalidate();render();status(`${added} pending decision${added===1?'':'s'} added.${skipped?` ${skipped} overlapping occurrence${skipped===1?' was':'s were'} skipped. Select the whole existing match when marking a larger passage.`:''}`);
}
$('mark').addEventListener('click',()=>{const start=$('source').selectionStart,end=$('source').selectionEnd;if(start===end)return status('Select a passage in the source text first.',true);try{addRanges([{start,end}],'Selected passage');}catch(e){status(e.message,true);}});
$('find').addEventListener('click',()=>{try{addRanges(findLiteral(state.text,$('term').value,!$('matchCase').checked),'Exact text');}catch(e){status(e.message,true);}});
$('filter').addEventListener('change',()=>{page=0;renderDecisions();updateGate();});
$('prev').addEventListener('click',()=>{page--;renderDecisions();updateGate();});$('next').addEventListener('click',()=>{page++;renderDecisions();updateGate();});
$('bulk').addEventListener('click',()=>{if(dirty)return;const reason=$('bulkReason').value.trim();if(!reason)return status('Enter a reason before applying a group decision.',true);const group=visible().filter(d=>d.status==='pending');if(!group.length)return;if(!window.confirm(`Redact these ${group.length} pending items on this page with the same reason?`))return;for(const d of group){d.status='redact';d.reason=reason;}invalidate();render();status(`${group.length} decisions recorded. Review the full release text before exporting.`);});
for(const id of ['caseRef','reviewer','checker'])$(id).addEventListener('input',invalidate);
for(const id of ['complete','checkedOutput','authorised'])$(id).addEventListener('change',()=>{revision++;revoke();updateGate();});
$('prepare').addEventListener('click',async()=>{
  if(!ready())return;
  revoke();const token=revision,sourceToken=generation;$('prepare').disabled=true;status('Building a new Word package and checking its contents…');
  try{
    const text=applyDecisions(state.text,state.decisions),txt=enc.encode(text),docx=buildDocx(text);
    await verifyDocx(docx,text);
    const [textHash,docxHash,extractedHash]=await Promise.all([hash(txt),hash(docx),hash(enc.encode(state.text))]);
    if(token!==revision||sourceToken!==generation||!ready())return;
    const r=review();
    const report={schema:'emote-redaction-review/1',version:VERSION,purpose:'Evaluation pilot; not a certified disclosure or authenticated approval',startedAt:state.started,preparedAt:new Date().toISOString(),caseReference:r.caseRef,preparedBy:r.reviewer,checkedBy:r.checker,reviewerIdentity:'Self-declared, not authenticated',source:{kind:state.kind,sha256:state.sourceHash,extractedTextSha256:extractedHash,characters:state.text.length},outputs:{docx:{filename:'reviewed-redacted.docx',sha256:docxHash},text:{filename:'reviewed-redacted.txt',sha256:textHash}},verification:{freshPackage:true,wordTextMatchesPreview:true},acknowledgements:{sourceCompared:r.complete,outputReviewed:r.output,serviceAuthorised:r.authorised},warnings:state.warnings,decisions:state.decisions.map(({id,start,end,type,status,reason})=>({id,start,end,offsetUnit:'UTF-16 code units in extracted text',type,decision:status,reason}))};
    prepared={docx,txt,report:enc.encode(JSON.stringify(report,null,2))};updateGate();status('Export prepared from the checked text. Download the copy and the separate decision record, then inspect the actual Word file.');
  }catch(e){if(token===revision){revoke();updateGate();status(`Export failed: ${e.message}`,true);}}
});
function download(key,name,type){if(!prepared||!ready())return;const a=document.createElement('a');const url=URL.createObjectURL(new Blob([prepared[key]],{type}));urls.push(url);a.href=url;a.download=name;a.click();setTimeout(()=>{URL.revokeObjectURL(url);urls=urls.filter(x=>x!==url);},10000);}
$('downloadDocx').addEventListener('click',()=>download('docx','reviewed-redacted.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
$('downloadTxt').addEventListener('click',()=>download('txt','reviewed-redacted.txt','text/plain;charset=utf-8'));
$('downloadReport').addEventListener('click',()=>download('report','redaction-decision-record.json','application/json'));
window.addEventListener('beforeunload',e=>{if(state.text){e.preventDefault();e.returnValue='';}});
render();
