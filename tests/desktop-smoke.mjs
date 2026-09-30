// Synthetic-only acceptance run. No participant files are read.
import {_electron as electron, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {session, medication, use} from './research-fixtures.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = path.join(root,'test-results'); await fs.mkdir(output,{recursive:true});
const packaged = process.env.TLFB_TEST_EXECUTABLE;
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
// A unique profile keeps this synthetic run separate from an open researcher window.
const profile = await fs.mkdtemp(path.join(output,'synthetic-profile-'));
const profileArg = '--user-data-dir=' + profile;
const app = await electron.launch({...(packaged ? {executablePath:packaged,args:[profileArg]} : {args:[root,profileArg]}), env, timeout:30000});
const report = {packaged:!!packaged,checks:[],runtimeNetworkRequests:[],pageErrors:[]};
const page = await app.firstWindow();
page.on('pageerror',e=>report.pageErrors.push(e.message));
page.on('request',r=>{if (/^(https?|wss?):/.test(r.url())) report.runtimeNetworkRequests.push(r.url());});
async function ok(label, fn) {await fn(); report.checks.push(label); console.log('PASS '+label);}
async function dialogs({savePath,openPath,cancel=false,confirm=1}={}) {
  await app.evaluate(({dialog},options)=>{
    dialog.showSaveDialog = async()=> options.cancel ? {canceled:true} : {canceled:false,filePath:options.savePath};
    dialog.showOpenDialog = async()=> options.cancel ? {canceled:true,filePaths:[]} : {canceled:false,filePaths:[options.openPath]};
    dialog.showMessageBox = async()=>({response:options.confirm});
  },{savePath,openPath,cancel,confirm});
}
async function openFixture(s) {
  const file=path.join(output,'synthetic-input.json'); await fs.writeFile(file,JSON.stringify(s));
  await dialogs({openPath:file}); await page.getByRole('button',{name:'Open session',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Session opened');
}
try {
  await ok('bundled app starts with sandboxed renderer and narrow bridge', async()=>{
    assert.equal(path.resolve(await app.evaluate(({app})=>app.getPath('userData'))),path.resolve(profile));
    await expect(page.getByRole('heading',{name:'Assessment details'})).toBeVisible();
    assert.equal(page.url(),'tlfb://app/index.html');
    const prefs = await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(prefs.sandbox,true); assert.equal(prefs.contextIsolation,true); assert.equal(prefs.nodeIntegration,false);
    assert.deepEqual(await page.evaluate(()=>Object.keys(window.tlfbDesktop).sort()),['autosave','bundle','confirm','open','print','save','selectAutosave','setDirty','stopAutosave']);
    assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  });
  await ok('renderer loads and interviews work while networking is disabled',async()=>{
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.session.enableNetworkEmulation({offline:true}));
    await page.reload(); await expect(page.getByRole('heading',{name:'Assessment details'})).toBeVisible();
    await page.locator('.more-options > summary').click(); await page.getByRole('button',{name:'Try synthetic demo'}).click(); await page.locator('.more-options > summary').click();
    await page.getByRole('button',{name:'Summary & exports'}).click();
    await expect(page.getByTestId('total-mme')).toHaveText('67.5');
    await expect(page.getByTestId('average-all')).toHaveText('9.64');
    await expect(page.getByTestId('maximum-mme')).toHaveText('15');
    await page.screenshot({path:path.join(output,'summary.png'),fullPage:true});
  });
  await ok('weekday/weekend bulk entry produces expected totals',async()=>{
    await page.getByRole('button',{name:'Calendar',exact:true}).click();
    await page.getByRole('button',{name:'Select multiple days'}).click();
    await page.getByRole('button',{name:'Weekdays',exact:true}).click();
    await page.getByLabel('Response for Oxycodone').selectOption('use');
    await page.getByLabel('Quantity (tablets)',{exact:true}).fill('1'); await dialogs();
    await page.getByRole('button',{name:'Apply to selected days'}).click();
    await expect(page.getByRole('status')).toContainText('Updated 5 days');
    await page.getByRole('button',{name:'Weekends',exact:true}).click();
    await page.getByLabel('Quantity (tablets)',{exact:true}).fill('2');
    await page.getByRole('button',{name:'Apply to selected days'}).click();
    await expect(page.getByRole('status')).toContainText('Updated 2 days');
    await page.getByRole('button',{name:'Exit multi-select'}).click();
  });
  await ok('day edits block stale exports and preserve per-day dose changes',async()=>{
    await page.locator('[data-date="2026-09-21"]').click();
    await page.getByLabel('Strength on this day (mg/unit)').fill('10');
    await page.getByRole('button',{name:'Save session',exact:false}).click();
    await expect(page.getByRole('alert')).toContainText('Save or discard');
    await page.locator('[data-date="2026-09-22"]').click();
    await expect(page.getByLabel('Strength on this day (mg/unit)')).toHaveValue('10');
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await page.locator('[data-date="2026-09-22"]').click(); await page.locator('[data-date="2026-09-21"]').click();
    await page.getByLabel('Memorable event / notes').fill('Synthetic note-only edit');
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await expect(page.getByLabel('Strength on this day (mg/unit)')).toHaveValue('10');
    await page.locator('.editor').evaluate(e=>e.scrollTop=0);
    await page.screenshot({path:path.join(output,'calendar.png'),fullPage:true});
  });
  const savedFile=path.join(output,'synthetic-saved.json');
  await ok('canceled/failed saves retain dirty state; successful save roundtrips',async()=>{
    await dialogs({cancel:true}); await page.getByRole('button',{name:/Save session/}).click();
    await expect(page.getByRole('button',{name:'Save session •',exact:true})).toBeVisible();
    await dialogs({savePath:path.join(output,'missing-folder','session.json')}); await page.getByRole('button',{name:/Save session/}).click();
    await expect(page.getByRole('alert')).toContainText('Unable to save');
    await dialogs({savePath:savedFile}); await page.getByRole('button',{name:/Save session/}).click();
    await expect(page.getByRole('status')).toContainText('Session saved');
    const stored=JSON.parse(await fs.readFile(savedFile,'utf8'));
    assert.equal(stored.medicationResponses['2026-09-21|oxy-5'].strengthOverride,10);
    await dialogs({openPath:savedFile}); await page.getByRole('button',{name:'Open session',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Session opened');
    await page.getByRole('button',{name:'Summary & exports'}).click();
    await expect(page.getByTestId('total-mme')).toHaveText('75');
  });
  await ok('CSV export contains the appointment and calculated totals',async()=>{
    const file=path.join(output,'synthetic-summary.csv'); await dialogs({savePath:file});
    if (!await page.getByText('Individual CSV files',{exact:true}).evaluate(e=>e.parentElement.open)) await page.getByText('Individual CSV files',{exact:true}).click();
    await page.getByRole('button',{name:'MME summary CSV',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('CSV saved');
    const csv=await fs.readFile(file,'utf8'); assert.match(csv,/appointment_label/); assert.match(csv,/"Baseline"/); assert.match(csv,/"75"/);
  });
  await ok('combined downloads contain MME and other substances in the same files',async()=>{
    const dailyFile=path.join(output,'synthetic-combined-daily.csv'); await dialogs({savePath:dailyFile});
    if (!await page.getByText('Individual CSV files',{exact:true}).evaluate(e=>e.parentElement.open)) await page.getByText('Individual CSV files',{exact:true}).click();
    await page.getByRole('button',{name:'Combined daily CSV',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('CSV saved');
    const daily=await fs.readFile(dailyFile,'utf8');
    assert.match(daily,/"daily_mme"/); assert.match(daily,/"substance_1_value"/); assert.match(daily,/"Alcohol"/); assert.match(daily,/"Nicotine"/);
    const summaryFile=path.join(output,'synthetic-combined-summary.csv'); await dialogs({savePath:summaryFile});
    if (!await page.getByText('Individual CSV files',{exact:true}).evaluate(e=>e.parentElement.open)) await page.getByText('Individual CSV files',{exact:true}).click();
    await page.getByRole('button',{name:'Combined summary CSV',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('CSV saved');
    const summary=await fs.readFile(summaryFile,'utf8');
    assert.match(summary,/"mme_full_period_total_mme"/); assert.match(summary,/"substance_1_use_days"/); assert.match(summary,/"75"/);
  });
  await ok('live previews explain the entered dose and preserve unknown values before Save day',async()=>{
    await openFixture(session({recallDays:1,medications:[medication({genericName:'methadone',name:'Methadone',indication:'oud',formulation:'liquid',strength:2,strengthUnit:'mg/mL',quantityUnit:'mL'})]}));
    await page.locator('[data-date="2026-09-27"]').click();
    await page.getByLabel('Response for Methadone').selectOption('use');
    await expect(page.getByTestId('calculation-preview')).toContainText('Quantity unknown');
    await page.getByLabel('Quantity (mL)',{exact:true}).fill('5');
    await expect(page.getByTestId('calculation-preview')).toContainText('47 research MME');
    await expect(page.getByTestId('save-status')).toContainText('Edits not applied');
    await page.screenshot({path:path.join(output,'calculation-preview.png'),fullPage:true});
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await page.getByRole('button',{name:'Summary & exports'}).click();
    await expect(page.getByTestId('total-mme')).toHaveText('47');
  });
  await ok('undo restores day edits, bulk clearing and removed medication settings without losing notes',async()=>{
    const s=session({recallDays:3,substances:[{id:'alcohol',name:'Alcohol',unit:'drinks',kind:'quantity'}],notes:{'2026-09-25':'Synthetic event'},medicationResponses:{'2026-09-25|oxy-5':use(1,{strengthOverride:10}),'2026-09-26|oxy-5':use(2),'2026-09-27|oxy-5':{status:'no_use'}}});
    await openFixture(s); await expect(page.getByRole('button',{name:'Undo last change',exact:true})).toBeDisabled();
    await page.locator('[data-date="2026-09-25"]').click();
    await page.getByLabel('Quantity (tablets)',{exact:true}).fill('3');
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await page.getByRole('button',{name:'Undo last change',exact:true}).click();
    await expect(page.getByLabel('Quantity (tablets)',{exact:true})).toHaveValue('1');
    await expect(page.getByLabel('Strength on this day (mg/unit)')).toHaveValue('10');
    await expect(page.getByLabel('Memorable event / notes')).toHaveValue('Synthetic event');
    await page.getByRole('button',{name:'Select multiple days'}).click();
    await page.getByRole('button',{name:'All',exact:true}).click(); await dialogs();
    await page.getByRole('button',{name:'Clear selected responses',exact:true}).click();
    await expect(page.locator('[data-date="2026-09-25"]')).toContainText('Unanswered');
    await page.getByRole('button',{name:'Undo last change',exact:true}).click();
    await expect(page.locator('[data-date="2026-09-25"]')).toContainText('MME 15');
    await page.getByRole('button',{name:'Interview settings',exact:true}).click();
    await page.getByRole('button',{name:'Remove medication 1',exact:true}).click();
    await page.getByRole('button',{name:'Apply settings',exact:true}).click();
    await expect(page.locator('[data-date="2026-09-25"]')).toContainText('MME N/A');
    await page.getByRole('button',{name:'Undo last change',exact:true}).click();
    const file=path.join(output,'synthetic-undo.json'); await dialogs({savePath:file});
    await page.getByRole('button',{name:/Save session/}).click(); await expect(page.getByRole('status')).toContainText('Session saved');
    assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),s);
    await expect(page.getByTestId('last-saved')).toContainText('Last saved at');
    const before=await page.getByTestId('last-saved').textContent();
    await page.getByRole('button',{name:'Summary & exports'}).click(); await dialogs({savePath:path.join(output,'synthetic-undo-summary.csv')});
    if (!await page.getByText('Individual CSV files',{exact:true}).evaluate(e=>e.parentElement.open)) await page.getByText('Individual CSV files',{exact:true}).click();
    await page.getByRole('button',{name:'MME summary CSV',exact:true}).click(); await expect(page.getByRole('status')).toContainText('CSV saved');
    await expect(page.getByTestId('last-saved')).toHaveText(before);
  });
  const autoFile=path.join(output,'synthetic-autosave.json');
  await ok('optional autosave handles cancellation, saves only applied edits and writes undo results',async()=>{
    await openFixture(session({recallDays:1,medicationResponses:{'2026-09-27|oxy-5':use(2)}}));
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave off');
    await dialogs({cancel:true}); await page.getByRole('button',{name:'Enable local autosave',exact:true}).click();
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave off');
    await dialogs({savePath:path.join(output,'missing-autosave-folder','session.json')});
    await page.getByRole('button',{name:'Enable local autosave',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Unable to start autosave');
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave off');
    await dialogs({savePath:autoFile}); await page.getByRole('button',{name:'Enable local autosave',exact:true}).click();
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave on: synthetic-autosave.json');
    await expect(page.getByTestId('last-saved')).toContainText('Last saved at');
    const original=await fs.readFile(autoFile,'utf8');
    await page.locator('[data-date="2026-09-27"]').click();
    await page.getByLabel('Quantity (tablets)',{exact:true}).fill('4');
    await page.waitForTimeout(1600); assert.equal(await fs.readFile(autoFile,'utf8'),original);
    await expect(page.getByTestId('save-status')).toContainText('Edits not applied');
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await expect.poll(async()=>JSON.parse(await fs.readFile(autoFile,'utf8')).medicationResponses['2026-09-27|oxy-5'].quantity).toBe(4);
    await expect(page.getByTestId('save-status')).toContainText('Current interview saved');
    await page.getByRole('button',{name:'Undo last change',exact:true}).click();
    await expect.poll(async()=>JSON.parse(await fs.readFile(autoFile,'utf8')).medicationResponses['2026-09-27|oxy-5'].quantity).toBe(2);
    await expect(page.getByTestId('save-status')).toContainText('Current interview saved');
    await page.screenshot({path:path.join(output,'saving-and-undo.png'),fullPage:true});
  });
  await ok('failed autosave stays unsaved and can recover through a manual save',async()=>{
    const prior=await page.getByTestId('last-saved').textContent();
    const preserved=path.join(output,'synthetic-autosave-preserved.json');
    await fs.copyFile(autoFile,preserved); await fs.unlink(autoFile); await fs.mkdir(autoFile);
    await page.getByLabel('Quantity (tablets)',{exact:true}).fill('3');
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave paused');
    await expect(page.getByTestId('save-status')).toContainText('Changes not saved');
    await expect(page.getByTestId('last-saved')).toHaveText(prior);
    const recovery=path.join(output,'synthetic-autosave-recovered.json'); await dialogs({savePath:recovery});
    await page.getByRole('button',{name:/Save session/}).click(); await expect(page.getByRole('status')).toContainText('Session saved');
    assert.equal(JSON.parse(await fs.readFile(recovery,'utf8')).medicationResponses['2026-09-27|oxy-5'].quantity,3);
    await page.getByRole('button',{name:'Turn off autosave',exact:true}).click();
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave off');
    await fs.rmdir(autoFile); await fs.copyFile(preserved,autoFile);
  });
  await ok('opening another interview turns autosave off and clears undo without overwriting the previous file',async()=>{
    await dialogs({savePath:autoFile}); await page.getByRole('button',{name:'Enable local autosave',exact:true}).click();
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave on');
    const previous=await fs.readFile(autoFile,'utf8');
    await dialogs({cancel:true}); await page.getByRole('button',{name:'Open session',exact:true}).click();
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave on');
    await openFixture(session({participantId:'SYNTHETIC-OTHER',recallDays:1,medicationResponses:{'2026-09-27|oxy-5':use(1)}}));
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave off');
    await expect(page.getByRole('button',{name:'Undo last change',exact:true})).toBeDisabled();
    await page.locator('[data-date="2026-09-27"]').click(); await page.getByLabel('Quantity (tablets)',{exact:true}).fill('5');
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await page.waitForTimeout(1600); assert.equal(await fs.readFile(autoFile,'utf8'),previous);
    await dialogs({openPath:autoFile}); await page.getByRole('button',{name:'Open session',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Session opened');
    await page.getByRole('button',{name:'Summary & exports'}).click(); await expect(page.getByTestId('total-mme')).toHaveText('22.5');
  });
  await ok('older OUD methadone sessions recalculate with a notice, export and save under the new policy',async()=>{
    const s=session({assessmentDate:'2026-10-03',recallDays:3,medications:[medication({genericName:'methadone',name:'Methadone',indication:'oud',formulation:'liquid',strength:2,strengthUnit:'mg/mL',quantityUnit:'mL'})],medicationResponses:{'2026-09-30|oxy-5':use(5),'2026-10-01|oxy-5':{status:'no_use'},'2026-10-02|oxy-5':use(10)}});
    s.reference.policyId='tlfb-mme-policy-1';
    await openFixture(s);
    await expect(page.getByRole('status')).toContainText('totals may change');
    await expect(page.getByRole('button',{name:'Save session \u2022',exact:true})).toBeVisible();
    await expect(page.locator('[data-date="2026-09-30"]')).toContainText('MME 47');
    await page.getByRole('button',{name:'Summary & exports'}).click();
    await expect(page.getByTestId('total-mme')).toHaveText('141');
    await expect(page.getByTestId('average-all')).toHaveText('47');
    await expect(page.getByTestId('maximum-mme')).toHaveText('94');
    const file=path.join(output,'synthetic-oud-daily.csv'); await dialogs({savePath:file});
    if (!await page.getByText('Individual CSV files',{exact:true}).evaluate(e=>e.parentElement.open)) await page.getByText('Individual CSV files',{exact:true}).click();
    await page.getByRole('button',{name:'Combined daily CSV',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('CSV saved');
    const csv=await fs.readFile(file,'utf8'); assert.match(csv,/"oud"/); assert.match(csv,/"47"/); assert.match(csv,/"tlfb-mme-policy-2"/);
    const save=path.join(output,'synthetic-oud-session.json'); await dialogs({savePath:save});
    await page.getByRole('button',{name:/Save session/}).click(); await expect(page.getByRole('status')).toContainText('Session saved');
    const stored=JSON.parse(await fs.readFile(save,'utf8')); assert.equal(stored.reference.policyId,'tlfb-mme-policy-2'); assert.equal(stored.medications[0].indication,'oud');
    await dialogs({openPath:save}); await page.getByRole('button',{name:'Open session',exact:true}).click();
    await expect(page.getByRole('status')).toHaveText('Session opened.');
    await page.getByRole('button',{name:'Interview settings',exact:true}).click();
    await page.getByLabel('Indication').selectOption('pain');
    await page.getByRole('button',{name:'Apply settings',exact:true}).click();
    await page.getByRole('button',{name:'Summary & exports'}).click();
    await expect(page.getByTestId('total-mme')).toHaveText('141');
  });
  await ok('Sublocade setup accepts 300 mg per injection and records one administration without MME',async()=>{
    await dialogs(); await page.getByRole('button',{name:'New interview',exact:true}).click();
    await page.getByLabel('Participant code').fill('SYNTHETIC-SUBLOCADE');
    await page.getByLabel('Assessment date',{exact:true}).fill('2026-09-28');
    await page.getByLabel('Recall window (days)').fill('30');
    await page.getByRole('button',{name:'+ Add opioid',exact:true}).click();
    await page.getByLabel('Generic ingredient').selectOption('buprenorphine');
    await page.getByLabel('Display name',{exact:true}).fill('Sublocade');
    await page.getByLabel('Route').selectOption('injection');
    await expect(page.getByLabel('Dose per injection (mg)',{exact:true})).toBeEnabled();
    await page.getByLabel('Dose per injection (mg)',{exact:true}).fill('300');
    await page.getByLabel('Indication').selectOption('oud');
    await page.screenshot({path:path.join(output,'injection-setup.png'),fullPage:true});
    await page.getByRole('button',{name:'Create interview',exact:true}).click();
    await page.locator('[data-date="2026-09-15"]').click();
    await page.getByLabel('Response for Sublocade').selectOption('use');
    await page.getByLabel('Number of injections',{exact:true}).fill('1');
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await page.screenshot({path:path.join(output,'injection-entry.png'),fullPage:true});
    await page.getByRole('button',{name:'Summary & exports'}).click();
    await expect(page.getByTestId('total-mme')).toHaveText('\u2014');
    const row=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Sublocade injection'})});
    await expect(row).toContainText('300');
    await page.screenshot({path:path.join(output,'injection-summary.png'),fullPage:true});
    const file=path.join(output,'synthetic-sublocade.csv'); await dialogs({savePath:file});
    if (!await page.getByText('Individual CSV files',{exact:true}).evaluate(e=>e.parentElement.open)) await page.getByText('Individual CSV files',{exact:true}).click();
    await page.getByRole('button',{name:'Buprenorphine CSV',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('CSV saved');
    const csv=await fs.readFile(file,'utf8'); assert.match(csv,/"total_reported_dose_mg"/); assert.match(csv,/"300"/); assert.match(csv,/"administered_on_recorded_dates"/);
    const save=path.join(output,'synthetic-injection-session.json'); await dialogs({savePath:save});
    await page.getByRole('button',{name:/Save session/}).click(); await expect(page.getByRole('status')).toContainText('Session saved');
    await dialogs({openPath:save}); await page.getByRole('button',{name:'Open session',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Session opened');
    await page.locator('[data-date="2026-09-15"]').click();
    await expect(page.getByLabel('Number of injections',{exact:true})).toHaveValue('1');
  });
  await ok('pump entry accepts daily delivered mg and exports it separately from MME',async()=>{
    await openFixture(session({recallDays:1,medications:[medication({name:'Pump buprenorphine',genericName:'buprenorphine',route:'pump',strength:null,strengthUnit:'mg',quantityUnit:'mg',formulation:'other'})]}));
    await page.locator('[data-date="2026-09-27"]').click();
    await page.getByLabel('Response for Pump buprenorphine').selectOption('use');
    await page.getByLabel('Amount delivered that day (mg)',{exact:true}).fill('2');
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await page.getByRole('button',{name:'Summary & exports'}).click();
    await expect(page.getByTestId('total-mme')).toHaveText('\u2014');
    const file=path.join(output,'synthetic-pump.csv'); await dialogs({savePath:file});
    if (!await page.getByText('Individual CSV files',{exact:true}).evaluate(e=>e.parentElement.open)) await page.getByText('Individual CSV files',{exact:true}).click();
    await page.getByRole('button',{name:'Buprenorphine CSV',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('CSV saved');
    const csv=await fs.readFile(file,'utf8'); assert.match(csv,/"2"/); assert.match(csv,/"delivered_on_recorded_dates"/);
  });
  await ok('missing quantities and patch hours remain incomplete until entered',async()=>{
    const s=session({medications:[medication({genericName:'fentanyl',name:'Fentanyl',route:'transdermal',formulation:'patch',strength:25,strengthUnit:'mcg/hr',quantityUnit:'patches'})],recallDays:1,medicationResponses:{'2026-09-27|oxy-5':use(1)}});
    await openFixture(s); await page.locator('[data-date="2026-09-27"]').click();
    await expect(page.getByLabel('Confirmed hours of concurrent wear')).toHaveValue('');
    await page.getByLabel('Memorable event / notes').fill('Synthetic patch review'); await page.getByRole('button',{name:'Save day',exact:true}).click();
    await page.getByRole('button',{name:'Summary & exports'}).click(); await expect(page.getByTestId('total-mme')).toHaveText('—');
    await page.getByRole('button',{name:'Calendar',exact:true}).click();
    await page.getByLabel('Confirmed hours of concurrent wear').fill('24'); await page.getByRole('button',{name:'Save day',exact:true}).click();
    await page.getByRole('button',{name:'Summary & exports'}).click(); await expect(page.getByTestId('total-mme')).toHaveText('60');
  });
  await ok('BUP and non-opioid use never display as confirmed no use',async()=>{
    await openFixture(session({recallDays:1,medications:[medication({genericName:'buprenorphine',name:'Buprenorphine'})],medicationResponses:{'2026-09-27|oxy-5':use(null)}}));
    await expect(page.locator('[data-date="2026-09-27"]')).toContainText('Use reported');
    await expect(page.locator('[data-date="2026-09-27"]')).toContainText('MME N/A');
    await page.getByRole('button',{name:'Summary & exports'}).click(); await expect(page.getByTestId('total-mme')).toHaveText('—');
  });
  await ok('settings support custom visits and liquid units without assuming strength',async()=>{
    await dialogs(); await page.getByRole('button',{name:'New interview',exact:true}).click();
    await page.getByLabel('Participant code').fill('SYNTHETIC-LIQUID');
    await page.locator('.visit-grid select').selectOption('custom'); await page.getByLabel('Appointment name').fill('12-month follow-up');
    await page.getByRole('button',{name:'+ Add opioid',exact:true}).click();
    await page.getByLabel('Form / entry method').selectOption('liquid'); await expect(page.getByLabel('Strength (mg/mL)',{exact:true})).toHaveValue('');
    await page.getByLabel('Strength (mg/mL)',{exact:true}).fill('2');
    await page.screenshot({path:path.join(output,'setup.png'),fullPage:true});
    await page.getByRole('button',{name:'Create interview',exact:true}).click(); await expect(page.getByText('12-month follow-up',{exact:true})).toBeVisible();
  });
  await ok('unsaved-close prompt keeps the window open on cancel',async()=>{
    const count=await app.evaluate(({BrowserWindow,dialog})=>{
      let count=0; dialog.showMessageBoxSync=()=>{count++;return 0;}; BrowserWindow.getAllWindows()[0].close(); return count;
    }); assert.equal(count,1); assert.equal(page.isClosed(),false);
  });
  await ok('review opens the right day and optional BUP/pump amounts stay optional',async()=>{
    const s=session({recallDays:2,medications:[medication(),medication({id:'b',name:'Optional BUP',genericName:'buprenorphine'}),medication({id:'p',name:'Optional pump',route:'pump',formulation:'other',quantityUnit:'mg',strengthUnit:'mg',strength:null})]});
    for (const d of ['2026-09-26','2026-09-27']) {s.medicationResponses[d+'|b']=use(null);s.medicationResponses[d+'|p']=use(null);}
    s.medicationResponses['2026-09-27|oxy-5']=use(null);
    await openFixture(s); await page.getByRole('button',{name:'Review interview',exact:true}).click();
    await expect(page.getByTestId('review-counts')).toHaveText('1 unanswered response · 1 MME entry to review');
    await page.screenshot({path:path.join(output,'review-interview.png'),fullPage:true});
    await page.getByRole('button',{name:'Review 2026-09-27'}).click();
    await expect(page.getByLabel('Response for Oxycodone 5 mg')).toHaveValue('use');
    await page.getByLabel('Quantity (tablets)',{exact:true}).first().fill('2');
    await page.getByRole('button',{name:'Save day',exact:true}).click();
    await page.getByRole('button',{name:'Review interview',exact:true}).click();
    await expect(page.getByTestId('review-counts')).toHaveText('1 unanswered response · 0 MME entries to review');
  });
  await ok('date range preview applies both endpoints, preserves notes and supports undo',async()=>{
    await openFixture(session({notes:{'2026-09-23':'Synthetic preserved note'}}));
    await page.getByRole('button',{name:'Select multiple days'}).click();
    await page.getByText('Select a date range',{exact:true}).click();
    await page.getByLabel('From date').fill('2026-09-22'); await page.getByLabel('Through date').fill('2026-09-24');
    await page.getByRole('button',{name:'Select this range'}).click();
    await expect(page.locator('.selection-preview')).toContainText('Sep 22, Sep 23, Sep 24');
    await page.getByLabel('Response for Oxycodone 5 mg').selectOption('use'); await page.getByLabel('Quantity (tablets)',{exact:true}).fill('2');
    await page.screenshot({path:path.join(output,'range-entry.png'),fullPage:true});
    await page.getByRole('button',{name:'Apply to selected days'}).click();
    await expect(page.getByRole('status')).toContainText('Updated 3 days');
    const f=path.join(output,'synthetic-range.json');await dialogs({savePath:f}); await page.getByRole('button',{name:/Save session/}).click();
    await expect(page.getByRole('status')).toContainText('Session saved'); const stored=JSON.parse(await fs.readFile(f,'utf8'));
    assert.equal(Object.keys(stored.medicationResponses).length,3);assert.equal(stored.notes['2026-09-23'],'Synthetic preserved note');
    await page.getByRole('button',{name:'Undo last change'}).click(); await expect(page.locator('[data-date="2026-09-23"]')).toContainText('Unanswered');
  });
  await ok('export folder saves a matching session and two CSVs; cancellation and failure keep edits',async()=>{
    await page.getByRole('button',{name:'Summary & exports'}).click(); await dialogs({cancel:true});
    await page.getByRole('button',{name:'Save export folder'}).click(); await expect(page.getByTestId('save-status')).toHaveText('Changes not saved to a file');
    await dialogs({openPath:path.join(output,'nonexistent-export-parent')}); await page.getByRole('button',{name:'Save export folder'}).click();
    await expect(page.getByRole('alert')).toContainText('Unable to export'); await expect(page.getByTestId('save-status')).toHaveText('Changes not saved to a file');
    const parent=await fs.mkdtemp(path.join(output,'synthetic-bundle-')); await dialogs({openPath:parent}); await page.getByRole('button',{name:'Save export folder'}).click();
    await expect(page.getByRole('status')).toContainText('Export folder saved'); await expect(page.getByTestId('save-status')).toHaveText('Current interview saved');
    const [folder]=await fs.readdir(parent), files=await fs.readdir(path.join(parent,folder)); assert.equal(files.length,3);
    const json=files.find(f=>f.endsWith('.json')), input=path.join(parent,folder,json);
    const stored=JSON.parse(await fs.readFile(input,'utf8'));assert.equal(Object.keys(stored.medicationResponses).length,0);
    assert.equal(stored.notes['2026-09-23'],'Synthetic preserved note');
    assert.match(await fs.readFile(path.join(parent,folder,files.find(f=>f.endsWith('-combined-summary.csv'))),'utf8'),/tlfb-combined-summary-3/);
    await dialogs({openPath:input});await page.getByRole('button',{name:'Open session',exact:true}).click(); await expect(page.getByRole('status')).toContainText('Session opened');
  });
  await ok('follow-up confirms copied setup and does not carry responses, notes, visit or autosave',async()=>{
    await openFixture(session({notes:{'2026-09-27':'Old interview note'},medicationResponses:{'2026-09-27|oxy-5':use(2)}}));
    await page.locator('.more-options > summary').click();await page.getByRole('button',{name:'Start follow-up'}).click();await page.locator('.more-options > summary').click();
    await expect(page.getByLabel('Participant code')).toHaveValue('SYNTHETIC-001');
    await expect(page.getByLabel('Assessor',{exact:true})).toHaveValue('');await expect(page.locator('.visit-grid select')).toHaveValue('unspecified');
    await page.getByLabel('Assessment date').fill('2026-10-28');await page.locator('.visit-grid select').selectOption('month_1');
    await page.getByRole('button',{name:'Create interview',exact:true}).click();await expect(page.getByRole('button',{name:'Undo last change'})).toBeDisabled();
    await expect(page.getByTestId('autosave-status')).toContainText('Autosave off');
    const f=path.join(output,'synthetic-followup.json');await dialogs({savePath:f});await page.getByRole('button',{name:/Save session/}).click();
    await expect(page.getByRole('status')).toContainText('Session saved');const stored=JSON.parse(await fs.readFile(f,'utf8'));
    assert.deepEqual(stored.notes,{});assert.deepEqual(stored.responses,{});assert.deepEqual(stored.medicationResponses,{});
    assert.equal(stored.assessmentDate,'2026-10-28');assert.equal(stored.appointment.code,'month_1');assert.equal(stored.medications[0].strength,5);
  });
  await ok('medication summary and print layout preserve separate OUD and BUP amounts',async()=>{
    const s=session({recallDays:2,medications:[medication({name:'OUD methadone',genericName:'methadone',indication:'oud'}),medication({id:'b',name:'Sublocade',genericName:'buprenorphine',route:'injection',formulation:'other',quantityUnit:'units',strength:300})],medicationResponses:{'2026-09-26|oxy-5':use(2),'2026-09-27|oxy-5':{status:'no_use'},'2026-09-26|b':use(1),'2026-09-27|b':{status:'no_use'}},notes:{'2026-09-26':'Synthetic print note <script>not executable</script>'}});
    await openFixture(s);await page.getByRole('button',{name:'Summary & exports'}).click();
    await expect(page.getByText('By medication',{exact:true})).toBeVisible();await page.getByText('By medication',{exact:true}).click();
    await expect(page.locator('.summary [data-testid="oud-subtotal"]')).toContainText('47 MME across the recall window');
    await expect(page.locator('.summary [data-testid="medication-summary"]')).toContainText('300 mg');
    await page.screenshot({path:path.join(output,'friendly-summary.png'),fullPage:true});
    const status=await page.getByTestId('last-saved').textContent();
    await app.evaluate(({BrowserWindow})=>{const c=BrowserWindow.getAllWindows()[0].webContents;c.print=(options,done)=>{if (options.silent !== false) throw new Error('Expected visible print dialog');done(false,'Print job canceled');};});
    await page.getByRole('button',{name:'Print summary',exact:true}).click();await expect(page.getByRole('button',{name:'Print summary',exact:true})).toBeEnabled();
    await expect(page.getByTestId('last-saved')).toHaveText(status);
    await page.emulateMedia({media:'print'});await expect(page.getByRole('heading',{name:'TLFB interview summary'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Open session',exact:true})).toBeHidden();
    await page.screenshot({path:path.join(output,'print-layout.png'),fullPage:true});
    const bytes=await app.evaluate(async({BrowserWindow})=>Array.from(await BrowserWindow.getAllWindows()[0].webContents.printToPDF({printBackground:false,pageSize:'A4',preferCSSPageSize:true})));
    await fs.writeFile(path.join(output,'synthetic-print-summary.pdf'),Buffer.from(bytes));assert.ok(bytes.length>1000);
    await page.emulateMedia({media:'screen'});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(900,800));
    await page.getByRole('button',{name:'Calendar',exact:true}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(output,'friendly-calendar-900.png'),fullPage:true});
  });
  await ok('no runtime remote requests or renderer errors during interview workflow',async()=>{
    assert.deepEqual(report.runtimeNetworkRequests,[]); assert.deepEqual(report.pageErrors,[]);
  });
  await ok('network, popups, navigation and file reads are denied by runtime policy',async()=>{
    // Remains blocked even after simulated connectivity is restored.
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.session.disableNetworkEmulation());
    const checks=await page.evaluate(async()=>{
      const denied=async u=>{try{await fetch(u);return false;}catch{return true;}};
      return {http:await denied('https://offline-test.invalid/'),file:await denied('file:///C:/Windows/win.ini'),socket:await new Promise(resolve=>{try{const s=new WebSocket('wss://offline-test.invalid/');s.onerror=()=>resolve(true);s.onopen=()=>resolve(false);}catch{resolve(true);}})};
    }); assert.deepEqual(checks,{http:true,file:true,socket:true});
    assert.equal(await app.evaluate(async({BrowserWindow})=>{try {await BrowserWindow.getAllWindows()[0].webContents.session.fetch('https://offline-test.invalid/');return false;}catch{return true;}}),true);
    await page.evaluate(()=>window.open('https://offline-test.invalid/')); assert.equal((await app.windows()).length,1);
    await page.evaluate(()=>{location.href='https://offline-test.invalid/';});
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getURL()),'tlfb://app/index.html');
    assert.equal(await page.evaluate(()=>location.href),'tlfb://app/index.html');
  });
  await fs.writeFile(path.join(output,packaged?'packaged-report.json':'desktop-report.json'),JSON.stringify(report,null,2));
  console.log(`Completed ${report.checks.length} desktop acceptance checks.`);
} catch (error) {
  await page.screenshot({path:path.join(output,'acceptance-failure.png'),fullPage:true}).catch(()=>{});
  throw error;
} finally {
  await app.evaluate(({dialog})=>{dialog.showMessageBoxSync=()=>1;}).catch(()=>{});
  await app.close();
}
