import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
test('RBC module graph uses server-supported .js paths, including PDF worker',async()=>{
 const visited=new Set();
 async function visit(url){
  if(visited.has(url.href))return;
  visited.add(url.href);
  assert.equal(url.pathname.endsWith('.js'),true,url.pathname);
  const code=await readFile(url,'utf8');
  if(url.pathname.includes('/vendor/'))return;
  for(const m of code.matchAll(/(?:from\s*|import\s*|new URL\(\s*)["'](\.\.?\/[^"']+\.m?js)["']/g))await visit(new URL(m[1],url));
 }
 for(const name of ['redactor-rbc.html','redactor-rbc-text.html']){
  const html=await readFile(new URL(name,root),'utf8');
  const scripts=[...html.matchAll(/<script\s+type="module"\s+src="([^"]+)"/g)];
  assert.equal(scripts.length,1);
  for(const m of scripts)await visit(new URL(m[1],root));
 }
 assert.ok([...visited].some(x=>x.endsWith('/pdf.worker.js')));
});
test('renamed vendor files retain pinned checksums',async()=>{
 const vendor=new URL('js/redactor/vendor/',root);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',vendor),'utf8'));
 for(const [name,expected] of Object.entries(manifest.files)){
  const bytes=await readFile(new URL(name,vendor));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,name);
 }
});
