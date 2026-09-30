import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import policy from '../desktop/policy.cjs';
import {createAutosaveStore} from '../desktop/autosave.cjs';

test('desktop permits only packaged assets; rejects remote URLs and file paths', () => {
  const root = path.resolve('desktop-dist');
  assert.equal(policy.allowedRequest('tlfb://app/index.html',root),true);
  assert.equal(policy.allowedRequest('tlfb://app/assets/main.js',root),true);
  for (const url of ['https://example.com','http://127.0.0.1/','file:///C:/Users/kober/test.json','tlfb://evil/index.html','tlfb://app/session.json','tlfb://app/%2e%2e%2fsecret.js','tlfb://app/assets/..%5c..%5csecret.js','tlfb://app/index.html?secret=data']) assert.equal(policy.allowedRequest(url,root),false,url);
});
test('file bridge bounds payloads and refuses path-bearing names', () => {
  assert.equal(policy.validateSave({kind:'session',name:'example.json',text:'{}'}),'.json');
  for (const payload of [{kind:'other',name:'x.json',text:'{}'},{kind:'session',name:'../x.json',text:'{}'},{kind:'csv',name:'x.exe',text:'hi'},{kind:'session',name:'x.json',text:'x'.repeat(2_000_001)},{kind:'session',name:'x.json',text:'{}',path:'secret'}]) assert.throws(()=>policy.validateSave(payload));
});
test('atomic saving replaces only the chosen file and leaves no temporary file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'tlfb-synthetic-'));
  const target = path.join(dir,'session.json');
  try {
    await policy.atomicWrite(target,'old synthetic'); await policy.atomicWrite(target,'new synthetic');
    assert.equal(await fs.readFile(target,'utf8'),'new synthetic'); assert.deepEqual(await fs.readdir(dir),['session.json']);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});

test('autosave writes only to the selected file and expires its token when stopped or replaced', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tlfb-autosave-synthetic-'));
  const a=path.join(dir,'a.json'), b=path.join(dir,'b.json'), store=createAutosaveStore();
  try {
    await assert.rejects(store.write({token:'anything',text:'{}'}));
    const chosen=await store.select(a,'{"synthetic":1}');
    assert.equal(chosen.name,'a.json'); assert.ok(chosen.savedAt);
    await store.write({token:chosen.token,text:'{"synthetic":2}'});
    assert.equal(await fs.readFile(a,'utf8'),'{"synthetic":2}');
    await assert.rejects(store.write({token:chosen.token,text:'{}',path:b}));
    await assert.rejects(store.write({token:chosen.token,text:'x'.repeat(2_000_001)}));
    assert.equal(await fs.readFile(a,'utf8'),'{"synthetic":2}');
    store.stop(); await assert.rejects(store.write({token:chosen.token,text:'{}'}));
    const next=await store.select(b,'{"synthetic":3}');
    assert.notEqual(next.token,chosen.token);
    await assert.rejects(store.write({token:chosen.token,text:'{}'}));
    assert.equal(await fs.readFile(a,'utf8'),'{"synthetic":2}');
    assert.deepEqual((await fs.readdir(dir)).sort(),['a.json','b.json']);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));
    await fs.rm(dir,{recursive:true,force:true});
  }
});

test('autosave failures preserve the last file and never permit arbitrary path payloads', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tlfb-autosave-synthetic-'));
  const file=path.join(dir,'session.json'), store=createAutosaveStore();
  try {
    const chosen=await store.select(file,'{"synthetic":"saved"}');
    await assert.rejects(store.select(path.join(dir,'missing','session.json'),'{}'));
    assert.equal(await fs.readFile(file,'utf8'),'{"synthetic":"saved"}');
    await assert.rejects(store.select(path.join(dir,'not-json.exe'),'{}'));
    await assert.rejects(store.write({token:chosen.token,text:null}));
    await fs.rm(file); await fs.mkdir(file);
    await assert.rejects(store.write({token:chosen.token,text:'{}'}));
    assert.deepEqual(await fs.readdir(dir),['session.json']);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));
    await fs.rm(dir,{recursive:true,force:true});
  }
});

const {validateBundle,writeBundle}=await import('../desktop/bundle.cjs');
const syntheticBundle={name:'tlfb-synthetic',files:[{kind:'session',name:'tlfb-synthetic.json',text:'{}'},{kind:'csv',name:'tlfb-synthetic-combined-daily.csv',text:'synthetic daily'},{kind:'csv',name:'tlfb-synthetic-combined-summary.csv',text:'synthetic summary'}]};
test('bundle creates fresh complete folders without replacing earlier exports',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tlfb-bundle-synthetic-'));
  try {
    const a=await writeBundle(dir,syntheticBundle), b=await writeBundle(dir,syntheticBundle); assert.notEqual(a.name,b.name);
    for (const result of [a,b]) {const target=path.join(dir,result.name); assert.equal((await fs.readdir(target)).length,3); for (const f of syntheticBundle.files) assert.equal(await fs.readFile(path.join(target,f.name),'utf8'),f.text);}
    await assert.rejects(writeBundle(path.join(dir,'missing'),syntheticBundle)); assert.equal((await fs.readdir(dir)).length,2);
    const rename=fs.rename;
    try {
      fs.rename=async (from,to)=>{if (path.basename(from).startsWith('.tlfb-export-')) throw new Error('Synthetic finalization failure'); return rename(from,to);};
      await assert.rejects(writeBundle(dir,syntheticBundle));
    } finally {fs.rename=rename;}
    assert.equal((await fs.readdir(dir)).length,2);
  } finally {assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep)); await fs.rm(dir,{recursive:true,force:true});}
});
test('bundle rejects paths, unexpected names, extra files and oversized payloads',()=>{
  for (const payload of [{...syntheticBundle,path:'elsewhere'},{...syntheticBundle,name:'../escape'},{...syntheticBundle,files:[]},{...syntheticBundle,files:[...syntheticBundle.files,{kind:'session',name:'extra.json',text:'{}'}]},{...syntheticBundle,files:[{...syntheticBundle.files[0],name:'other.json'},...syntheticBundle.files.slice(1)]},{...syntheticBundle,files:[{...syntheticBundle.files[0],text:'a'.repeat(2_000_001)},...syntheticBundle.files.slice(1)]}]) assert.throws(()=>validateBundle(payload));
});
