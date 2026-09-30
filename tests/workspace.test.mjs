import test from 'node:test';
import assert from 'node:assert/strict';
import {followupDraft, rangeDates, interviewReview, medicationSummaries, oudMethadoneSummary} from '../lib/interview-tools.ts';
import {session, medication, use, noUse} from './research-fixtures.mjs';
import {blankResponse, responseDraft, commitResponse, calendarStatus, selectionDates, revisedSetup, newMedication, measurement} from '../lib/workspace.ts';
import {calculateMme} from '../lib/mme.ts';
import {calculationPreview} from '../lib/calculation-preview.ts';

test('calendar completeness includes other substances, BUP, unknown quantities and excluded routes', () => {
  const s = session({medications: [medication({genericName: 'buprenorphine'})], substances: [{id:'alcohol',name:'Alcohol',unit:'drinks',kind:'quantity'}]});
  assert.equal(calendarStatus(s,'2026-09-21').state, 'unanswered');
  s.medicationResponses['2026-09-21|oxy-5'] = use(null);
  assert.equal(calendarStatus(s,'2026-09-21').state, 'partial');
  s.responses['2026-09-21|alcohol'] = 0;
  assert.equal(calendarStatus(s,'2026-09-21').state, 'use');
  s.medicationResponses['2026-09-21|oxy-5'] = noUse(); s.responses['2026-09-21|alcohol'] = 2;
  assert.equal(calendarStatus(s,'2026-09-21').state, 'use');
  s.responses['2026-09-21|alcohol'] = 0;
  assert.equal(calendarStatus(s,'2026-09-21').state, 'zero');
  assert.equal(calendarStatus(s,'2026-09-28').state, 'outside');
});
test('patch hours are never invented and overrides survive note-only editing', () => {
  const m = medication({genericName:'fentanyl',route:'transdermal',formulation:'patch',strength:25,strengthUnit:'mcg/hr',quantityUnit:'patches'});
  const r = commitResponse(m,{...blankResponse(),status:'use',quantity:'1'});
  assert.equal(r.patchHours,undefined);
  const s = session({medications:[m],medicationResponses:{'2026-09-21|oxy-5':r}});
  assert.equal(calculateMme(s).daily[0].mme,null);
  const original = use(1,{patchHours:12,strengthOverride:50});
  assert.deepEqual(commitResponse(m,responseDraft(original)),original);
  assert.deepEqual(commitResponse(m,{...blankResponse(),status:'no_use'}),noUse());
});
test('weekday/weekend selection uses actual recall dates', () => {
  assert.deepEqual(selectionDates(session(),'weekends'),['2026-09-26','2026-09-27']);
  assert.equal(selectionDates(session(),'weekdays').length,5);
  assert.equal(selectionDates(session(),'all').length,7);
});
test('settings preserve overlaps and disclose lost or redefined data', () => {
  const old = session({medicationResponses:{'2026-09-21|oxy-5':use(1),'2026-09-22|oxy-5':use(2)}});
  const metadata = revisedSetup(old,{...old,appointment:{code:'month_3',label:'3-month follow-up'}});
  assert.equal(metadata.removed,0); assert.deepEqual(metadata.session.medicationResponses,old.medicationResponses);
  const strength = revisedSetup(old,{...old,medications:[medication({strength:10})]});
  assert.equal(strength.removed,2); assert.deepEqual(strength.session.medicationResponses,{});
  const window = revisedSetup(old,{...old,recallDays:6});
  assert.equal(window.removed,1); assert.equal(Object.keys(window.session.medicationResponses).length,1);
});
test('new medications do not assume a strength or indication', () => {
  assert.equal(newMedication('new').strength,null);
  assert.equal(newMedication('new').indication,'unknown');
});

test('correcting indication preserves reported doses and recalculates methadone for OUD', () => {
  const old = session({medications:[medication({genericName:'methadone',indication:'unknown'})],medicationResponses:{'2026-09-21|oxy-5':use(2)}});
  const draft = structuredClone(old); draft.medications[0].indication='oud';
  const revised = revisedSetup(old,draft);
  assert.equal(revised.removed,0);
  assert.deepEqual(revised.session.medicationResponses,old.medicationResponses);
  assert.equal(calculateMme(revised.session).daily[0].mme,47);
});

test('injection setup accepts a dose per injection and preserves a 300 mg administration', () => {
  const m = {...measurement({...newMedication('sublocade'),genericName:'buprenorphine',route:'injection'},'injection'),strength:300};
  const response = commitResponse(m,{...blankResponse(),status:'use',quantity:'1'});
  const s = session({recallDays:1,medications:[m],medicationResponses:{'2026-09-27|sublocade':response}});
  assert.equal(calculateMme(s).buprenorphine[0].totalReportedDoseMg,300);
  assert.deepEqual(commitResponse(m,responseDraft(response)),response);
});

test('preview agrees with recorded liquid, direct-mg, tablet override and patch calculations', () => {
  const cases = [
    [medication({genericName:'methadone',indication:'oud',formulation:'liquid',strength:2,strengthUnit:'mg/mL',quantityUnit:'mL'}),{quantity:'5'},'5 mL × 2 mg/mL = 10 mg/day. 10 × 4.7 = 47 research MME.'],
    [medication({strength:null,strengthUnit:'mg',quantityUnit:'mg'}),{quantity:'10'},'10 mg/day. 10 × 1.5 = 15 research MME.'],
    [medication(),{quantity:'2',strength:'10'},'2 tablets × 10 mg/unit = 20 mg/day. 20 × 1.5 = 30 research MME.'],
    [medication({genericName:'fentanyl',route:'transdermal',formulation:'patch',strength:25,strengthUnit:'mcg/hr',quantityUnit:'patches'}),{quantity:'2',hours:'24'},'2 patches × 25 mcg/hr = 50 mcg/hr. Confirmed 24-hour wear. 50 × 2.4 = 120 research MME.'],
  ];
  for(const [m,fields,expected] of cases) {
    const draft={...blankResponse(),status:'use',...fields};
    assert.deepEqual(calculationPreview(m,draft),{text:expected,invalid:false});
    const s=session({recallDays:1,medications:[m],medicationResponses:{'2026-09-27|oxy-5':commitResponse(m,draft)}});
    const calculated=calculateMme(s).daily[0].mme;
    assert.ok(expected.includes(`${calculated} research MME`));
  }
});

test('preview distinguishes missing, unknown, zero and invalid values without inventing MME', () => {
  assert.match(calculationPreview(medication(),blankResponse()).text,/Nothing is counted as zero/);
  assert.match(calculationPreview(medication(),{...blankResponse(),status:'no_use'}).text,/0 MME/);
  assert.match(calculationPreview(medication(),{...blankResponse(),status:'use'}).text,/Quantity unknown/);
  assert.match(calculationPreview(medication({strength:null}),{...blankResponse(),status:'use',quantity:'1'}).text,/Strength unknown/);
  for(const quantity of ['-1','0','Infinity','not a number']) assert.equal(calculationPreview(medication(),{...blankResponse(),status:'use',quantity}).invalid,true);
});

test('injection and pump previews show the recorded dose without an MME conversion', () => {
  const m=medication({genericName:'buprenorphine',route:'injection',formulation:'other',strength:300,quantityUnit:'units'});
  const r=calculationPreview(m,{...blankResponse(),status:'use',quantity:'1'});
  assert.equal(r.text,'1 injection(s) × 300 mg/injection = 300 mg. Buprenorphine recorded separately; no MME conversion.');
  assert.match(calculationPreview({...m,route:'pump',quantityUnit:'mg',strengthUnit:'mg',strength:null},{...blankResponse(),status:'use',quantity:'2'}).text,/2 mg\/day/);
  assert.match(calculationPreview(m,{...blankResponse(),status:'use'}).text,/dose is unknown/);
});

test('follow-up carries only confirmed setup and starts with no daily data or old visit', () => {
  const source=session({medicationResponses:{'2026-09-27|oxy-5':use(2)},notes:{'2026-09-27':'old visit'},substances:[{id:'a',name:'Alcohol',unit:'drinks',kind:'quantity'}],responses:{'2026-09-27|a':3}});
  const before=structuredClone(source), next=followupDraft(source,'2026-10-28');
  assert.equal(next.participantId,source.participantId); assert.equal(next.assessmentDate,'2026-10-28');
  assert.equal(next.appointment.code,'unspecified'); assert.equal(next.assessor,'');
  for (const field of ['notes','responses','medicationResponses']) assert.deepEqual(next[field],{});
  assert.deepEqual(next.medications,source.medications); assert.deepEqual(next.substances,source.substances);
  next.medications[0].strength=99; next.substances[0].name='Changed'; assert.deepEqual(source,before);
});

test('date ranges include both endpoints and cannot silently cross the recall window', () => {
  const s=session(); assert.deepEqual(rangeDates(s,'2026-09-22','2026-09-24'),['2026-09-22','2026-09-23','2026-09-24']);
  assert.deepEqual(rangeDates(s,'2026-09-27','2026-09-27'),['2026-09-27']);
  for (const [a,b] of [['2026-09-20','2026-09-22'],['2026-09-22','2026-09-28'],['2026-09-25','2026-09-23'],['','']]) assert.deepEqual(rangeDates(s,a,b),[]);
});

test('review distinguishes unanswered items and MME review from optional BUP and pump doses', () => {
  const s=session({recallDays:2,medications:[medication(),medication({id:'b',genericName:'buprenorphine'}),medication({id:'p',route:'pump',formulation:'other',quantityUnit:'mg',strengthUnit:'mg',strength:null})],substances:[{id:'a',name:'Alcohol',unit:'drinks',kind:'quantity'}]});
  for (const d of ['2026-09-26','2026-09-27']) {s.medicationResponses[d+'|b']=use(null); s.medicationResponses[d+'|p']=use(null);}
  s.medicationResponses['2026-09-27|oxy-5']=use(null); s.responses['2026-09-27|a']=0;
  const days=interviewReview(s); assert.equal(days.length,2); assert.equal(days[0].unanswered.length,2);
  assert.equal(days[0].needsReview.length,0); assert.deepEqual(days[1].unanswered,[]);
  assert.deepEqual(days[1].needsReview,[{name:'Oxycodone 5 mg',reason:'quantity_unknown'}]);
});

test('medication contributions retain missingness, dose changes and a nonduplicating OUD subtotal', () => {
  const s=session({recallDays:3,medications:[medication({genericName:'methadone',indication:'oud'}),medication({id:'b',genericName:'buprenorphine',route:'injection',formulation:'other',quantityUnit:'units',strength:300})],medicationResponses:{'2026-09-25|oxy-5':use(1),'2026-09-26|oxy-5':use(2,{strengthOverride:10}),'2026-09-25|b':use(1),'2026-09-26|b':use(null)}});
  const [m,b]=medicationSummaries(s); assert.equal(m.totalMme,null); assert.equal(m.recordedMme,117.5);
  assert.equal(m.minimumDose,5); assert.equal(m.maximumDose,20); assert.equal(m.missingDays,1);
  assert.equal(b.minimumDose,300); assert.equal(b.doseUnit,'mg'); assert.equal(b.recordedMme,null); assert.equal(b.unknownQuantityDays,1);
  assert.deepEqual(oudMethadoneSummary(s),{complete:false,subtotal:117.5,total:null});
  s.medicationResponses['2026-09-27|oxy-5']=noUse(); assert.equal(oudMethadoneSummary(s).total,117.5);
  const missing=medicationSummaries(session())[0]; assert.equal(missing.recordedQuantity,null); assert.equal(missing.recordedMme,null);
});
