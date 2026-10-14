import {detect} from './core.js';

export const DEFAULT_ASSIST = Object.freeze({identifiers:true, addresses:true, names:'conservative', companies:false, dates:false, terms:'', exclusions:''});
const STOP = new Set('reading borough council legal information governance customer relations joint team department service services university college road street avenue lane close drive court north south east west united kingdom meeting minutes personal data witness statement contact details national insurance reference number date birth'.split(' '));
const TOKEN = "[\\p{Lu}][\\p{L}'’\\-]{1,}";
const NAME = `${TOKEN}(?:[ \\t\\n]+(?:de|del|da|van|von|al|la))?[ \\t\\n]+${TOKEN}(?:[ \\t]+${TOKEN})?`;
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
  const contextual=new RegExp(`\\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Name:|Claimant:|Defendant:|Witness:|Applicant:|From:|To:|Signed:)[ \\t]+(${NAME})`,'gu');
  for(const m of text.matchAll(contextual)){
   const phrase=m[1],words=phrase.split(/\s+/).map(folded);
   if(words.some(x=>STOP.has(x)))continue;
   add('Person name',m.index+m[0].length-phrase.length,m.index+m[0].length);
  }
  const names=new RegExp(`(?=(?<![\\p{L}\\p{N}])(${NAME})(?![\\p{L}\\p{N}]))`,'gu');
  for(const m of text.matchAll(names)){
   let phrase=m[1],words=phrase.split(/\s+/).map(folded);
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
  let text='';const fragments=pages[page].fragments.map((f,index)=>{
   const start=text.length;text+=f.text+'\n';return {...f,index,start,end:start+f.text.length};
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
