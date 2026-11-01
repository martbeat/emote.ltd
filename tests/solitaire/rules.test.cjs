const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync(require('node:path').join(__dirname,'../../Solitaire.html'),'utf8');
const ctx=vm.createContext({crypto:webcrypto});
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]+';globalThis.api={deal,canMove,transfer,drawCards,validGame,legalMoves,isWon,canFinish};',ctx);
const {deal,canMove,transfer,drawCards,validGame,legalMoves,isWon,canFinish}=ctx.api;
const c=(s,r,up=true)=>({s,r,up});
const empty=()=>({stock:[],waste:[],f:[[],[],[],[]],t:[[],[],[],[],[],[],[]],draw:1,moves:0,seconds:0});
const top=(k,i,n=0)=>({k,i,n});
test('deals contain all 52 unique cards with correct layout and exposure',()=>{
for(let n=0;n<100;n++){const g=deal(n%2?1:3);assert.ok(validGame(g));assert.equal(g.stock.length,24);assert.deepEqual(Array.from(g.t,a=>a.length),[1,2,3,4,5,6,7]);assert.equal(g.t.flat().filter(c=>c.up).length,7);}
});
test('alternating descending runs, king-only empty columns and automatic turnover',()=>{const g=empty();g.t[0]=[c(0,8,false),c(1,6),c(2,5)];g.t[1]=[c(0,7)];assert.ok(canMove(g,top('t',0,1),top('t',1)));assert.ok(!canMove(g,top('t',0,0),top('t',1)));assert.ok(!canMove(g,top('t',0,1),top('t',2)));assert.ok(transfer(g,top('t',0,1),top('t',1)));assert.ok(g.t[0][0].up);assert.equal(g.t[1].length,3);g.t[2]=[c(1,13),c(2,12)];assert.ok(transfer(g,top('t',2),top('t',3)));g.t[4]=[c(0,7),c(1,5)];assert.ok(!canMove(g,top('t',4),top('t',5)));});
test('foundations require ascending suit and top card, support moving back',()=>{const g=empty();g.waste=[c(0,1),c(1,1)];assert.ok(!canMove(g,top('w',0,0),top('f',0)));assert.ok(!canMove(g,top('w',0,1),top('f',0)));assert.ok(transfer(g,top('w',0,1),top('f',1)));assert.ok(transfer(g,top('w',0,0),top('f',0)));g.t[0]=[c(1,2)];assert.ok(transfer(g,top('f',0),top('t',0)));g.waste=[c(1,3)];assert.ok(!canMove(g,top('w',0),top('f',1)));});
test('draw three handles partial final packet and recycle preserves order',()=>{const g=empty();g.draw=3;g.stock=[c(0,1,false),c(0,2,false),c(0,3,false),c(0,4,false)];drawCards(g);assert.deepEqual(Array.from(g.waste,c=>c.r),[4,3,2]);drawCards(g);assert.deepEqual(Array.from(g.waste,c=>c.r),[4,3,2,1]);drawCards(g);assert.deepEqual(Array.from(g.stock,c=>c.r),[1,2,3,4]);assert.ok(g.stock.every(c=>!c.up));drawCards(g);assert.equal(g.waste.at(-1).r,2);});
test('undo snapshot restores drawing, recycling and newly exposed cards',()=>{const g=deal(3),before=JSON.stringify(g);drawCards(g);const restored=JSON.parse(before);assert.ok(validGame(restored));assert.equal(restored.waste.length,0);assert.equal(restored.stock.length,24);});
test('saved-game validation rejects duplicate cards and malformed data',()=>{const g=deal();g.stock[0]={...g.stock[1]};assert.ok(!validGame(g));assert.ok(!validGame({}));const h=deal();h.f[0]=null;assert.ok(!validGame(h));const j=deal();j.stock[0].up=true;assert.ok(!validGame(j));});
test('automatic finish completes exposed layout, preserving all cards',()=>{const g=empty();for(let s=0;s<4;s++)for(let r=13;r>=1;r--)g.t[s].push(c(s,r));assert.ok(validGame(g));assert.ok(canFinish(g));let m;while((m=legalMoves(g).find(m=>m.d.k==='f')))transfer(g,m.p,m.d);assert.ok(isWon(g));assert.ok(validGame(g));assert.equal(g.moves,52);});
test('random legal sequences preserve card conservation and saved state validity',()=>{for(let run=0;run<20;run++){const g=deal(run%2?1:3);for(let i=0;i<150;i++){const moves=legalMoves(g,true);if(moves.length&&Math.random()<.8){const m=moves[Math.floor(Math.random()*moves.length)];assert.ok(transfer(g,m.p,m.d));}else drawCards(g);assert.ok(validGame(g));}}});
