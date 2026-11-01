const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
// Minimal DOM adapter: run the shipped click handlers and renderer together.
class Element {
  constructor(){this.children=[];this.attrs={};this.style={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  append(child){this.children.push(child);}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this.attrs[name]=value;}
  querySelector(){return this.strong??=new Element();}
  addEventListener(){}
}
function ui(){const els=new Map();const get=id=>{if(!els.has(id))els.set(id,new Element());return els.get(id);};get('mode').value='ai';const ctx=vm.createContext({document:{getElementById:get,createElement:()=>new Element()},navigator:{sendBeacon(){}},URLSearchParams,console});const script=fs.readFileSync('Backgammon.html','utf8').split('<script>')[1].split('</script>')[0];vm.runInContext(script+`;this.bridge={initialState,apply,legalTurns,load:(state,roll,p=1)=>{s=copy(state);player=p;dice=roll.slice();rolled=roll.slice();opening=false;selected=null;history=[];render();},state:()=>copy(s),selected:()=>selected};`,ctx);return {get,bridge:ctx.bridge};}
function reportedPosition(bridge){let s=bridge.initialState();const turns=[
[1,[3,1],[[6,3,3],[6,5,1]]],[-1,[5,6],[[12,17,5],[12,18,6]]],
[1,[5,1],[[5,4,1],[8,3,5]]],[-1,[2,5],[[12,14,2],[14,19,5]]],
[1,[4,1],[[24,20,4],[4,3,1]]],[-1,[4,5],[[18,22,4],[19,24,5]]]];
for(const [p,dice,moves]of turns){let remaining=dice.slice();for(const [from,to,die]of moves){const m={from:from-1,to:to-1,die};assert(bridge.legalTurns(s,p,remaining).some(t=>t[0]&&t[0].from===m.from&&t[0].to===m.to&&t[0].die===m.die));s=bridge.apply(s,p,m);remaining.splice(remaining.indexOf(die),1);}}
return s;}
test('reported 3–4 roll: bar checker auto-selected and highlighted point re-enters it',()=>{const {get,bridge}=ui();const s=reportedPosition(bridge);assert.equal(s.bar[0],1);bridge.load(s,[3,4]);assert.equal(bridge.selected(),-1);const entry=get('board').children.find(e=>e.attrs['aria-label']?.startsWith('Point 22:'));assert(entry.className.includes('legal'));entry.onclick();assert.equal(bridge.state().bar[0],0);assert.equal(bridge.state().b[21],1);assert.equal(bridge.state().bar[1],1);assert.equal(get('undo').disabled,false);get('undo').onclick();assert.equal(bridge.state().bar[0],1);assert.equal(bridge.selected(),-1);});
test('clicking unrelated point does not strand a required bar entry',()=>{const {get,bridge}=ui();bridge.load(reportedPosition(bridge),[3,4]);get('board').children.find(e=>e.attrs['aria-label']?.startsWith('Point 6:')).onclick();assert.equal(bridge.selected(),-1);get('board').children.find(e=>e.attrs['aria-label']?.startsWith('Point 21:')).onclick();assert.equal(bridge.state().bar[0],0);assert.equal(bridge.state().b[20],1);});
test('blocked bar offers End turn instead of an impossible prompt',()=>{const {get,bridge}=ui();const s=bridge.initialState();s.b[23]--;s.bar[0]=1;s.b[21]=-2;s.b[20]=-2;bridge.load(s,[3,4]);assert.equal(get('end').hidden,false);assert.equal(get('end').disabled,false);assert.match(get('notice').textContent,/No more legal moves/);});
test('walnut bar re-entry also selects automatically in two-player mode',()=>{const {get,bridge}=ui();get('mode').value='local';get('new').onclick();const s=bridge.initialState();s.b[0]++;s.bar[1]=1;bridge.load(s,[3,4],-1);assert.equal(bridge.selected(),-1);get('board').children.find(e=>e.attrs['aria-label']?.startsWith('Point 3:')).onclick();assert.equal(bridge.state().bar[1],0);assert.equal(bridge.state().b[2],-1);});
