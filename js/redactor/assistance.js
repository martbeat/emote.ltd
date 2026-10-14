import {detect} from './core.js';

export const DEFAULT_ASSIST = Object.freeze({identifiers:true, addresses:true, names:'balanced', companies:false, dates:false, terms:'', exclusions:''});
const STOP = new Set('reading borough council legal information governance customer relations joint team department service services university college road street avenue lane close drive court north south east west united kingdom meeting minutes personal data witness statement contact details national insurance reference number date birth'.split(' '));
const TOKEN = "[\\p{Lu}][\\p{L}'’\\-]{1,}";
const NAME = `${TOKEN}(?:[ \\t\\n]+(?:de|del|da|van|von|al|la))?[ \\t\\n]+${TOKEN}(?:[ \\t]+${TOKEN})?`;
// Balanced accepts plausible surnames outside the lexicon, but excludes form/role vocabulary.
const BALANCED_STOP = new Set([...STOP,...'approval approve approvals form resource commission project programme program sponsor pmo change delivery management strategic lead manager internal use record please click enter yes no team board committee director officer senior executive chief assistant finance budget policy report summary appendix section document council trust partnership limited ltd llp plc inc corporation company organisation organization association foundation hospital school auditor assurance definition recommendation recommendations opinion background objectives regulation traffic'.split(' ')]);
const PARTICLES = new Set('de del da van von al la der den'.split(' '));
const BALANCED_NAME = `${TOKEN}(?:[ \t\n]+(?:${TOKEN}|[\\p{Lu}]\\.?|de|del|da|van|von|al|la|der|den)){1,4}`;
function balancedPhrase(phrase,lexicon,context=false){
 const tokens=[...phrase.matchAll(/\S+/gu)],words=tokens.map(x=>folded(x[0]));
 if(tokens.length<2||(!context&&!lexicon?.given.has(words[0])))return '';
 let last=1;
 if(/^[\p{Lu}]\.?$/u.test(tokens[1][0]))last=2;
 else if(PARTICLES.has(words[1])){while(PARTICLES.has(words[last]))last++;}
 else if(words.length>2&&((lexicon?.given.has(words[1])&&!lexicon?.surname.has(words[1]))||lexicon?.surname.has(words[2])))last=2;
 if(!tokens[last])return '';
 const chosen=words.slice(0,last+1);
 if(chosen.some(w=>BALANCED_STOP.has(w)))return '';
 // Initials are allowed in the middle, not as a surname or an organisation acronym.
 if(!/^[\p{Lu}][\p{L}'’\-]+$/u.test(tokens[last][0])||/^[\p{Lu}]{2,}$/u.test(tokens[last][0]))return '';
 return phrase.slice(0,tokens[last].index+tokens[last][0].length);
}
const PERSONAL_FIELD = /^(?:report\s+author|author|prepared\s+by|written\s+by|reviewed\s+by|approved\s+by|report\s+owner|contact\s+officer|officer\s+name|name|claimant|defendant|witness|applicant)\s*:?$/iu;
const ROLE_TAIL = /^[ \t]*[,–—-][ \t]*(?:(?:senior|principal|lead|assistant|chief|deputy)[ \t]+)*(?:auditor|solicitor|lawyer|manager|officer|director|consultant|engineer|analyst|accountant|executive|head\s+of)\b/iu;
export function fragmentSeparator(previous,current){
 if(!previous)return '';
 const a=previous.rect,b=current.rect;
 if(!a||!b)return '\u0000';
 const height=Math.max(a.height,b.height),gap=b.x-(a.x+a.width);
 const sameLine=Math.abs((a.y+a.height/2)-(b.y+b.height/2))<=height*.5;
 if(sameLine&&gap>=-height*2&&gap<=height*3)return ' ';
 // A personal-field label provides stronger evidence than ordinary neighbouring columns.
 if(PERSONAL_FIELD.test(previous.text.trim())&&sameLine&&gap>=0&&gap<=300)return ' ';
 const nextLine=b.y>a.y&&b.y-a.y<=height*2&&Math.abs(b.x-a.x)<=height*2;
 return nextLine?'\n':'\u0000';
}
const organisationTail=/^[ \t]+(?:Trust|Council|Limited|Ltd|LLP|PLC|Inc|Corporation|Company|Partnership|University|College|Foundation|Association)\b/u;
const folded=s=>s.normalize('NFC').toLocaleLowerCase('en-GB');
export function makeLexicon(json){
 if(!Array.isArray(json?.givenNames)||!Array.isArray(json?.surnames)||json.givenNames.length>100000||json.surnames.length>100000)throw new Error('Invalid local name lexicon.');
 return {given:new Set(json.givenNames.filter(x=>typeof x==='string').map(folded)),surname:new Set(json.surnames.filter(x=>typeof x==='string').map(folded))};
}
export function parseTerms(value){
 if(typeof value!=='string'||value.length>20000)throw new Error('Term lists must be no larger than 20,000 characters.');
 const terms=[...new Set(value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
 if(terms.length>200||terms.some(x=>x.length>300))throw new Error('Use at most 200 terms, each no longer than 300 characters.');
 return terms;
}
function phraseMatches(text,term){
 const words=term.split(/\s+/).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const re=new RegExp('(?<![\\p{L}\\p{N}])'+words.join('\\s+')+'(?![\\p{L}\\p{N}])','giu');
 return [...text.matchAll(re)].map(m=>({start:m.index,end:m.index+m[0].length}));
}
export function assistText(text,options={},lexicon=null){
 const o={...DEFAULT_ASSIST,...options}, found=[];
 const add=(type,start,end)=>{if(found.length>=4000)throw new Error('Too many suggestions. Narrow the settings or split the document.');found.push({type,start,end,status:'pending',reason:''});};
 const run=(type,re)=>{for(const m of text.matchAll(re))add(type,m.index,m.index+m[0].length);};
 if(o.identifiers)found.push(...detect(text));
 if(o.addresses)run('Street address',/\b\d{1,4}[ \t]+(?:[\p{L}\d'’.-]+[ \t]+){1,6}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Close|Way|Drive|Dr|Court|Ct)\b/giu);
 if(o.companies)run('Organisation',new RegExp(`${TOKEN}(?:[ \\t]+${TOKEN}){0,4}[ \\t]+(?:Ltd|Limited|LLP|PLC|Inc|Corporation)\\b`,'gu'));
 if(o.dates)run('Date',/\b(?:\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi);
 if(o.names!=='off'){
  // Context and titles are hints, not a determination that the phrase is a person.
  const namePattern=o.names==='balanced'?BALANCED_NAME:NAME;
  const contextual=new RegExp(`\\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Name:|Claimant:|Defendant:|Witness:|Applicant:|From:|To:|Signed:)[ \\t]+(${namePattern})`,'gu');
  for(const m of text.matchAll(contextual)){
   const phrase=o.names==='balanced'?balancedPhrase(m[1],lexicon,true):m[1],words=phrase.split(/\s+/).map(folded);
   if(!phrase)continue;
   if(words.some(x=>STOP.has(x)))continue;
   const start=m.index+m[0].length-m[1].length;
   if(o.names==='balanced'&&organisationTail.test(text.slice(start+phrase.length)))continue;
   add('Person name',start,start+phrase.length);
  }
  // Match field labels separately so case-insensitive labels do not weaken name casing.
  const fields=/\b(?:report[ \t]+author|author|prepared[ \t]+by|written[ \t]+by|reviewed[ \t]+by|approved[ \t]+by|report[ \t]+owner|contact[ \t]+officer|officer[ \t]+name)[ \t]*:?[ \t\n]+/giu;
  for(const field of text.matchAll(fields)){
   const start=field.index+field[0].length;
   const candidate=new RegExp(`^(${namePattern})(?![\\p{L}\\p{N}])`,'u').exec(text.slice(start));
   if(!candidate)continue;
   const phrase=o.names==='balanced'?balancedPhrase(candidate[1],lexicon,true):candidate[1];
   if(!phrase||phrase.split(/\s+/).some(word=>STOP.has(folded(word))))continue;
   if(organisationTail.test(text.slice(start+phrase.length)))continue;
   add('Person name',start,start+phrase.length);
  }
  const names=new RegExp(`(?=(?<![\\p{L}\\p{N}])(${namePattern})(?![\\p{L}\\p{N}]))`,'gu');
  for(const m of text.matchAll(names)){
   let phrase=m[1],words=phrase.split(/\s+/).map(folded);
   if(o.names==='balanced'){
    if(found.some(x=>x.type==='Person name'&&x.start<m.index&&m.index<x.end))continue;
    phrase=balancedPhrase(phrase,lexicon,ROLE_TAIL.test(text.slice(m.index+phrase.length)));
    if(!phrase)continue;
    const tail=text.slice(m.index+phrase.length);
    if(organisationTail.test(tail))continue;
    add('Person name',m.index,m.index+phrase.length);continue;
   }
   if(lexicon?.given.has(words[0])&&lexicon?.surname.has(words[1])){phrase=phrase.match(/\S+\s+\S+/u)[0];words=words.slice(0,2);}
   if(words.some(x=>STOP.has(x)))continue;
   const supported=lexicon?.given.has(words[0])&&lexicon?.surname.has(words.at(-1));
   if(supported||o.names==='broad')add('Person name',m.index,m.index+phrase.length);
  }
 }
 for(const term of parseTerms(o.terms))for(const m of phraseMatches(text,term))add('Supplied term',m.start,m.end);
 const excluded=parseTerms(o.exclusions).flatMap(term=>phraseMatches(text,term));
 const candidates=found.filter(m=>!excluded.some(x=>x.start<=m.start&&x.end>=m.end));
 candidates.sort((a,b)=>a.start-b.start||b.end-a.end||a.type.localeCompare(b.type));
 const seen=new Set();const unique=candidates.filter(m=>{const key=`${m.start}:${m.end}:${m.type}`;if(seen.has(key))return false;seen.add(key);return true;});
 if(unique.length>2000)throw new Error('More than 2,000 suggestions. Narrow the settings or split the document.');
 return {matches:unique,excluded};
}
export function assistPdf(pages,options={},lexicon=null){
 const areas=[],unlocatable=[],excludedFragments=[];
 for(let page=0;page<pages.length;page++){
  let text='',previous=null;const fragments=pages[page].fragments.map((f,index)=>{
   text+=fragmentSeparator(previous,f);const start=text.length;text+=f.text;previous=f;return {...f,index,start,end:start+f.text.length};
  });
  const {matches,excluded}=assistText(text,options,lexicon);
  const touched=new Map();
  for(const match of matches){
   const hit=fragments.filter(f=>f.start<match.end&&match.start<f.end);
   // A whole-fragment box would also remove an excluded term. Leave it for manual review.
   if(hit.some(f=>excluded.some(x=>x.start<f.end&&f.start<x.end))){excludedFragments.push({page,type:match.type});continue;}
   for(const f of hit){
    if(!f.rect){unlocatable.push({page,type:match.type});continue;}
    let item=touched.get(f.index);
    if(!item){item={page,rect:{...f.rect},types:new Set(),examples:new Set()};touched.set(f.index,item);}
    item.types.add(match.type);item.examples.add(text.slice(match.start,match.end).replace(/\s+/g,' '));
   }
  }
  for(const item of touched.values())areas.push({...item,assistantType:[...item.types].sort().join(' + '),hint:[...item.examples].join('; ')});
  if(areas.length>2000)throw new Error('More than 2,000 suggested areas. Narrow the settings or split the document.');
 }
 return {areas,unlocatable:unlocatable.length,excludedFragments:excludedFragments.length};
}
export const areaKey=m=>`${m.page}:${m.rect.x}:${m.rect.y}:${m.rect.width}:${m.rect.height}`;
export function mergeAssist(existing,proposals,nextId){
 // Rescans replace only untouched automatic proposals. Every decision and manual area survives.
 const retained=existing.filter(m=>!(m.assistantType&&m.status==='pending'));
 const protectedRegions=retained.slice();
 const keys=new Set(retained.map(areaKey));let id=nextId,skipped=0;
 for(const p of proposals){
  const key=areaKey(p);if(keys.has(key)||protectedRegions.some(m=>m.page===p.page&&m.rect.x<p.rect.x+p.rect.width&&p.rect.x<m.rect.x+m.rect.width&&m.rect.y<p.rect.y+p.rect.height&&p.rect.y<m.rect.y+m.rect.height)){skipped++;continue;}
  retained.push({id:`P${id++}`,page:p.page,rect:p.rect,status:'pending',reason:'',assistantType:p.assistantType,hint:`${p.assistantType}: ${p.hint}`});keys.add(key);
 }
 if(retained.length>2000)throw new Error('Too many total areas. Narrow the settings or split the document.');
 return {marks:retained,nextId:id,skipped};
}
export function batchAssist(marks,{types,page=null,reason,action}){
 if(!['redact','keep'].includes(action))throw new Error('Choose redact or keep.');
 if(typeof reason!=='string'||!reason.trim()||reason.length>600)throw new Error('Record a shared reason of up to 600 characters.');
 let changed=0;
 const result=marks.map(m=>{
  if(m.status!=='pending'||!m.assistantType||!types.includes(m.assistantType)||(page!==null&&m.page!==page))return m;
  changed++;return {...m,status:action,reason:reason.trim()};
 });
 return {marks:result,changed};
}
