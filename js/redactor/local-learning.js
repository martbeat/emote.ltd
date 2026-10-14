export const LEARNING_KEY='emote.rbc.redaction-learning.v1';
const TYPES=['Email','Telephone','UK postcode','National Insurance number','Person name','Street address','Organisation','Date','Supplied term','Manual area'];
const PRESETS=['personal','contact','sensitive','confidential','privileged','scope','retain'];
const categories=values=>[...new Set(values.flatMap(x=>x.split(' + ')).filter(x=>TYPES.includes(x)))];
export function createLocalLearning(storage){
 let available=!!storage,enabled=true,stats={},ledger=new Map();
 try{
  const raw=storage?.getItem(LEARNING_KEY);
  if(raw&&raw.length<30000){
   let value;try{value=JSON.parse(raw);}catch{storage.removeItem(LEARNING_KEY);value=null;}
   if(value?.schema===1&&typeof value.enabled==='boolean'&&value.stats&&typeof value.stats==='object'){
    enabled=value.enabled;
    for(const type of TYPES){const row=value.stats[type];if(!row)continue;
     const clean={redact:0,keep:0,reasons:{redact:{},keep:{}}};
     for(const action of ['redact','keep']){
      if(Number.isInteger(row[action])&&row[action]>=0&&row[action]<=100000)clean[action]=row[action];
      for(const key of PRESETS){const count=row.reasons?.[action]?.[key];if(Number.isInteger(count)&&count>0&&count<=clean[action])clean.reasons[action][key]=count;}
     }stats[type]=clean;
    }
   }
  }
 }catch{available=false;enabled=false;}
 function write(){
  if(!available)return;
  try{storage.setItem(LEARNING_KEY,JSON.stringify({schema:1,enabled,stats}));}
  catch{available=false;enabled=false;}
 }
 function apply(entry,delta){
  for(const type of entry.types){
   const row=stats[type]??={redact:0,keep:0,reasons:{redact:{},keep:{}}};
   row[entry.action]=Math.max(0,Math.min(100000,row[entry.action]+delta));
   if(entry.preset){const values=row.reasons[entry.action];values[entry.preset]=Math.max(0,Math.min(row[entry.action],(values[entry.preset]||0)+delta));}
  }
 }
 return {
  get enabled(){return enabled&&available;},get available(){return available;},
  setEnabled(value){enabled=!!value;write();},
  clearSession(){ledger.clear();},
  observe(id,values,action,preset){
   if(!enabled||!available)return;
   const entry=['redact','keep'].includes(action)?{types:categories(values),action,preset:PRESETS.includes(preset)?preset:null}:null;
   const old=ledger.get(id);
   if(JSON.stringify(old||null)===JSON.stringify(entry))return;
   if(old)apply(old,-1);
   if(entry&&entry.types.length){apply(entry,1);ledger.set(id,entry);}else ledger.delete(id);
   write();
  },
  prediction(values){
   if(!enabled||!available)return null;
   let redact=0,keep=0;
   for(const type of categories(values)){const row=stats[type];if(!row)continue;redact+=row.redact;keep+=row.keep;}
   if(!redact&&!keep)return null;
   const action=redact===keep?'mixed':redact>keep?'redact':'keep';
   const preferred=categories(values).map(type=>{const ranked=Object.entries(stats[type]?.reasons.redact||{}).filter(([,count])=>count>0).sort((a,b)=>b[1]-a[1]);return ranked.length&&ranked[0][1]>(ranked[1]?.[1]||0)?ranked[0][0]:null;});
   const reasonKey=action==='redact'&&preferred.length&&preferred.every(key=>key&&key===preferred[0])?preferred[0]:null;
   // Case-specific legal/sensitivity judgements are shown in history, never inferred into a new field.
   return {action,redact,keep,reasonKey:['personal','contact','scope'].includes(reasonKey)?reasonKey:null};
  },
  summary(){return TYPES.filter(type=>stats[type]&&(stats[type].redact||stats[type].keep)).map(type=>({type,redact:stats[type].redact,keep:stats[type].keep,reasons:JSON.parse(JSON.stringify(stats[type].reasons))}));},
  forget(){stats={};ledger.clear();try{storage?.removeItem(LEARNING_KEY);if(!enabled)write();}catch{available=false;enabled=false;}},
 };
}
