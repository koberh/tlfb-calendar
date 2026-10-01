import test from 'node:test';
import assert from 'node:assert/strict';
import { datesFor, keyFor, demoInterview } from '../lib/tlfb.ts';
import { MME_REFERENCE } from '../lib/mme-reference.ts';
import { migrateInterview, readResearchSession, writeResearchSession, validateResearchSession } from '../lib/research-session.ts';
import { calculateMme } from '../lib/mme.ts';
import { combinedDailyCsv, combinedSummaryCsv, medicationCsv, dailyMmeCsv, mmeSummaryCsv, buprenorphineCsv, researchSubstanceCsv, researchSubstanceSummaryCsv } from '../lib/research-exports.ts';
import { session, medication, noUse, use } from './research-fixtures.mjs';

function fill(s, response = noUse()) {
  for (const d of datesFor(s.assessmentDate, s.recallDays)) {
    for (const m of s.medications) s.medicationResponses[keyFor(d, m.id)] = structuredClone(response);
  }
  return s;
}

function set(s, day, response, id = s.medications[0].id) {
  const date = datesFor(s.assessmentDate, s.recallDays)[day];
  s.medicationResponses[keyFor(date, id)] = response;
}

// Independent CSV reader for export assertions, including embedded newlines/quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if (c === '\r' && input[i + 1] === '\n' && !quoted) {
      row.push(field); rows.push(row); row = []; field = ''; i++;
    } else field += c;
  }
  const [head, ...data] = rows;
  assert.ok(data.every(r => r.length === head.length));
  return data.map(r => Object.fromEntries(head.map((h, n) => [h, r[n]])));
}

test('combined daily CSV aligns substances and medications by date and preserves missing/zero statuses', () => {
  const s = session({recallDays:3, substances:[{id:'alcohol',name:'Alcohol',kind:'quantity',unit:'drinks'}, {id:'cannabis',name:'Cannabis',kind:'binary',unit:'use / no use'}]});
  set(s,0,noUse()); set(s,1,use(2));
  const ds = datesFor(s.assessmentDate,s.recallDays);
  s.responses[keyFor(ds[0],'alcohol')] = 0; s.responses[keyFor(ds[0],'cannabis')] = 1;
  s.responses[keyFor(ds[1],'alcohol')] = 2;
  const rows = parseCsv(combinedDailyCsv(s));
  assert.equal(rows.length,3); assert.deepEqual(rows.map(r=>r.date),ds);
  assert.deepEqual(rows.map(r=>r.daily_mme),['0','15','']);
  assert.deepEqual(rows.map(r=>r.substance_1_value),['0','2','']);
  assert.deepEqual(rows.map(r=>r.substance_1_response_status),['no_use','use','unanswered']);
  assert.equal(rows[1].substance_2_value,''); assert.equal(rows[0].substance_2_value,'1');
  assert.equal(rows[0].appointment_label,'Baseline'); assert.equal(rows[0].substance_1_unit,'drinks');
  assert.equal(rows[1].medication_1_reported_quantity,'2'); assert.equal(rows[1].medication_1_mme,'15');
  assert.equal(rows[0].reference_id,MME_REFERENCE.id);
});

test('combined CSV keeps unknown quantities, BUP and excluded routes separate from MME', () => {
  const s = session({recallDays:1,medications:[medication(),medication({id:'bup',genericName:'buprenorphine'}),medication({id:'pump',route:'pump'})]});
  set(s,0,use(null)); set(s,0,use(2),'bup'); set(s,0,use(3),'pump');
  const [r] = parseCsv(combinedDailyCsv(s));
  assert.equal(r.daily_mme,''); assert.equal(r.mme_status,'incomplete');
  assert.equal(r.medication_1_reported_quantity,''); assert.equal(r.medication_1_reason,'quantity_unknown');
  assert.equal(r.medication_2_reported_quantity,'2'); assert.equal(r.medication_2_scope,'buprenorphine');
  assert.equal(r.medication_2_mme,''); assert.equal(r.medication_3_scope,'excluded'); assert.equal(r.medication_3_mme,'');
});

test('combined CSV quotes notes and duplicate display names without column collisions', () => {
  const s = session({recallDays:1,medications:[medication({name:'=unsafe'}),medication({id:'other',name:'=unsafe',strength:10})]});
  set(s,0,use(1,{strengthOverride:7.5})); set(s,0,use(2),'other');
  s.notes['2026-09-27'] = 'Fictional note, with "quotes"\nand a second line';
  const [r] = parseCsv(combinedDailyCsv(s));
  assert.equal(r.event_note,s.notes['2026-09-27']);
  assert.equal(r.medication_1_name,"'=unsafe"); assert.equal(r.medication_2_name,"'=unsafe");
  assert.equal(r.medication_1_id,'oxy-5'); assert.equal(r.medication_2_id,'other');
  assert.equal(r.medication_1_effective_strength,'7.5'); assert.equal(r.medication_2_effective_strength,'10');
  assert.equal(r.daily_mme,'41.25');
});

test('combined summary joins full-window and monthly MME with substance counts without duplicating interview rows', () => {
  const s = session({assessmentDate:'2026-10-03',recallDays:3,substances:[{id:'alcohol',name:'Alcohol',unit:'drinks',kind:'quantity'}]});
  set(s,0,use(1)); set(s,1,noUse()); set(s,2,use(2));
  s.responses['2026-09-30|alcohol']=2; s.responses['2026-10-01|alcohol']=0;
  const rows=parseCsv(combinedSummaryCsv(s)); assert.equal(rows.length,1);
  const [r]=rows;
  assert.equal(r.mme_full_period_total_mme,'22.5'); assert.equal(r.mme_average_all_days_mme_per_day,'7.5');
  assert.equal(r.mme_full_period_maximum_daily_mme,'15');
  assert.equal(r.month_1_period,'2026-09'); assert.equal(r.month_1_days_in_scope,'1'); assert.equal(r.month_1_full_period_total_mme,'7.5');
  assert.equal(r.month_2_period,'2026-10'); assert.equal(r.month_2_days_in_scope,'2'); assert.equal(r.month_2_full_period_total_mme,'15');
  assert.equal(r.substance_1_use_days,'1'); assert.equal(r.substance_1_no_use_days,'1'); assert.equal(r.substance_1_missing_days,'1');
  assert.equal(r.substance_1_total_reported_quantity,'2'); assert.equal(r.substance_1_mean_per_answered_day,'1');
});

test('combined summary preserves incomplete denominators and BUP quantities', () => {
  const s=session({recallDays:2,medications:[medication(),medication({id:'bup',genericName:'buprenorphine'})]});
  set(s,0,use(1)); set(s,0,use(2),'bup');
  const [r]=parseCsv(combinedSummaryCsv(s));
  assert.equal(r.mme_full_period_total_mme,''); assert.equal(r.mme_average_all_days_mme_per_day,'');
  assert.equal(r.mme_average_answered_days_mme_per_day,'7.5'); assert.equal(r.mme_calculable_days,'1');
  assert.equal(r.buprenorphine_1_total_reported_quantity,'2'); assert.equal(r.buprenorphine_1_missing_days,'1');
  assert.equal(r.buprenorphine_1_mme_status,'excluded_buprenorphine');
});

test('combined exports support substance-only assessments and retain CSV protections', () => {
  const s=session({recallDays:1,medications:[],substances:[{id:'other',name:'=FORMULA()',kind:'binary',unit:'use / no use'}]});
  s.responses['2026-09-27|other']=1;
  const [daily]=parseCsv(combinedDailyCsv(s)),[combined]=parseCsv(combinedSummaryCsv(s));
  assert.equal(daily.daily_mme,''); assert.equal(daily.mme_status,'not_applicable');
  assert.equal(combined.mme_full_period_total_mme,''); assert.equal(combined.substance_1_total_reported_quantity,'');
  assert.equal(combined.substance_1_name,"'=FORMULA()"); assert.equal(combined.substance_1_use_days,'1');
});

test('user example: 5 mg oxycodone, one weekday tablet and two weekend tablets', () => {
  const s = session();
  datesFor(s.assessmentDate, s.recallDays).forEach((d, n) => set(s, n, use([0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay()) ? 2 : 1)));
  const result = calculateMme(s);
  assert.deepEqual(result.daily.map(d => d.mme), [7.5, 7.5, 7.5, 7.5, 7.5, 15, 15]);
  assert.equal(result.window.totalMme, 67.5);
  assert.equal(result.window.averageAllDays, 67.5 / 7);
  assert.equal(result.window.averageAnsweredDays, 67.5 / 7);
  assert.equal(result.window.maximumDailyMme, 15);
  assert.equal(result.window.calculableDays, 7);
});

test('published CDC examples: hydrocodone 5 mg x4 and oxycodone 10 mg x2', () => {
  const s = session({ recallDays: 1, medications: [
    medication({ id: 'hydro', name: 'Hydrocodone/APAP 5/325', genericName: 'hydrocodone', strength: 5 }),
    medication({ id: 'oxy', strength: 10 }),
  ] });
  set(s, 0, use(4), 'hydro'); set(s, 0, use(2), 'oxy');
  const r = calculateMme(s);
  assert.deepEqual(r.medicationRows.map(x => x.mme), [20, 30]);
  assert.equal(r.daily[0].mme, 50);
});

test('fixed reference outcomes for each supported oral ingredient', () => {
  const cases = [['codeine', 1.5], ['hydrocodone', 10], ['hydromorphone', 50], ['methadone', 47],
    ['morphine', 10], ['oxycodone', 15], ['oxymorphone', 30], ['tapentadol', 4], ['tramadol', 2]];
  for (const [genericName, expected] of cases) {
    const s = fill(session({ recallDays: 1, medications: [medication({ genericName, strength: 10 })] }), use(1));
    assert.equal(calculateMme(s).window.totalMme, expected, genericName);
  }
});

test('missing response never becomes zero or a full-period total', () => {
  const s = session({ recallDays: 3 });
  set(s, 0, noUse()); set(s, 1, use(2));
  const r = calculateMme(s);
  assert.deepEqual(r.daily.map(d => d.mme), [0, 15, null]);
  assert.equal(r.window.totalMme, null);
  assert.equal(r.window.averageAllDays, null);
  assert.equal(r.window.averageAnsweredDays, 7.5);
  assert.equal(r.window.completeDayTotal, 15);
  assert.equal(r.window.observedMaximumDailyMme, 15);
  assert.equal(r.window.maximumDailyMme, null);
  assert.equal(r.window.confirmedZeroDays, 1);
  assert.equal(r.window.incompleteDays, 1);
});

test('partially answered multi-opioid day is excluded from the mean, while subtotal is retained', () => {
  const s = session({ recallDays: 2, medications: [medication(), medication({ id: 'morphine', genericName: 'morphine', strength: 10 })] });
  set(s, 0, use(1)); set(s, 0, use(1), 'morphine');
  set(s, 1, use(2));
  const r = calculateMme(s);
  assert.deepEqual(r.daily.map(d => d.mme), [17.5, null]);
  assert.equal(r.daily[1].recordedComponentSubtotal, 15);
  assert.equal(r.window.recordedComponentSubtotal, 32.5);
  assert.equal(r.window.completeDayTotal, 17.5);
  assert.equal(r.window.averageAnsweredDays, 17.5);
  assert.equal(r.window.allResponsesRecordedDays, 1);
});

test('entirely missing vs all-zero vs no included medications', () => {
  const missing = calculateMme(session()).window;
  for (const field of ['totalMme', 'recordedComponentSubtotal', 'completeDayTotal', 'averageAllDays', 'averageAnsweredDays', 'observedMaximumDailyMme', 'maximumDailyMme']) assert.equal(missing[field], null, field);
  const zeros = calculateMme(fill(session())).window;
  assert.equal(zeros.totalMme, 0); assert.equal(zeros.averageAllDays, 0); assert.equal(zeros.maximumDailyMme, 0);
  assert.equal(zeros.confirmedZeroDays, 7);
  const none = calculateMme(session({ medications: [], substances: [{ id: 'alcohol', name: 'Alcohol', unit: 'drinks', kind: 'quantity' }] })).window;
  assert.equal(none.status, 'not_applicable'); assert.equal(none.totalMme, null); assert.equal(none.calculableDays, 0);
});

test('known use with unknown quantity is answered but not calculable', () => {
  const s = session({ recallDays: 1 }); set(s, 0, use(null));
  const r = calculateMme(s);
  assert.equal(r.medicationRows[0].reason, 'quantity_unknown');
  assert.equal(r.window.allResponsesRecordedDays, 1);
  assert.equal(r.window.calculableDays, 0);
  assert.equal(r.window.reviewMedicationEntries, 1);
  assert.equal(r.window.averageAnsweredDays, null);
});

test('unknown strength, dated override, and raw preservation', () => {
  const s = session({ recallDays: 3, medications: [medication({ strength: null })] });
  set(s, 0, use(1)); set(s, 1, use(2, { strengthOverride: 10 })); set(s, 2, noUse());
  const before = JSON.stringify(s);
  const r = calculateMme(s);
  assert.equal(r.medicationRows[0].reason, 'strength_unknown');
  assert.deepEqual(r.daily.map(d => d.mme), [null, 30, 0]);
  assert.equal(r.medicationRows[1].strengthOverridden, true);
  assert.equal(JSON.stringify(s), before);
});

test('oral liquid and direct mg use explicit compatible units', () => {
  const liquid = session({ recallDays: 1, medications: [medication({ formulation: 'liquid', strength: 2, strengthUnit: 'mg/mL', quantityUnit: 'mL' })] });
  set(liquid, 0, use(3.5));
  assert.equal(calculateMme(liquid).window.totalMme, 10.5);
  const direct = session({ recallDays: 1, medications: [medication({ strength: null, strengthUnit: 'mg', quantityUnit: 'mg' })] });
  set(direct, 0, use(7)); assert.equal(calculateMme(direct).window.totalMme, 10.5);
  direct.medications[0].strength = 5; assert.throws(() => calculateMme(direct), /Direct-mg/);
});

test('two strengths of one ingredient remain separate records and sum correctly', () => {
  const s = session({ recallDays: 1, medications: [medication(), medication({ id: 'oxy-10', strength: 10, name: 'Oxycodone 10 mg' })] });
  set(s, 0, use(1)); set(s, 0, use(1), 'oxy-10');
  assert.equal(calculateMme(s).window.totalMme, 22.5);
});

test('methadone uses the same fixed factor for pain and OUD; other and unknown indications require review', () => {
  const s = fill(session({ recallDays: 1, medications: [medication({ genericName: 'methadone', strength: 10 })] }), use(5));
  assert.equal(calculateMme(s).window.totalMme, 235);
  s.medications[0].indication = 'oud';
  assert.equal(calculateMme(s).window.totalMme, 235);
  for (const indication of ['unknown', 'other']) {
    s.medications[0].indication = indication;
    assert.equal(calculateMme(s).medicationRows[0].reason, 'methadone_indication_requires_review');
    assert.equal(calculateMme(s).window.totalMme, null);
  }
  set(s, 0, noUse()); assert.equal(calculateMme(s).window.totalMme, 0);
});

test('liquid methadone includes OUD in MME and retains raw responses and indication in exports', () => {
  const s = session({recallDays:1, medications:[medication({genericName:'methadone',name:'Synthetic methadone liquid',formulation:'liquid',strength:2,strengthUnit:'mg/mL',quantityUnit:'mL',indication:'pain'})]});
  set(s,0,use(5));
  const pain = calculateMme(s);
  assert.equal(pain.medicationRows[0].doseBasis,10);
  assert.equal(pain.daily[0].mme,47);
  s.medications[0].indication = 'oud';
  const oud = calculateMme(s);
  assert.equal(oud.medicationRows[0].doseBasis,10);
  assert.equal(oud.daily[0].mme,47);
  const [exported] = parseCsv(medicationCsv(s));
  assert.equal(exported.indication,'oud'); assert.equal(exported.reported_quantity,'5');
  assert.equal(exported.quantity_unit,'mL'); assert.equal(exported.mme,'47');
  for (const indication of ['unknown','other']) {
    s.medications[0].indication = indication;
    const r = calculateMme(s).medicationRows[0];
    assert.equal(r.mme,null); assert.equal(r.reason,'methadone_indication_requires_review');
    assert.equal(r.quantity,5); assert.equal(r.effectiveStrength,2);
    const [row] = parseCsv(medicationCsv(s));
    assert.equal(row.reported_quantity,'5'); assert.equal(row.quantity_unit,'mL');
    assert.equal(row.response_status,'use'); assert.equal(row.mme,'');
  }
});

test('OUD methadone direct mg is converted once and missing quantities or strengths remain incomplete', () => {
  const s = session({recallDays:1, medications:[medication({genericName:'methadone',indication:'oud',strength:null,strengthUnit:'mg',quantityUnit:'mg'})]});
  set(s,0,use(60));
  assert.equal(calculateMme(s).window.totalMme,282);
  set(s,0,use(null));
  assert.equal(calculateMme(s).medicationRows[0].reason,'quantity_unknown');
  assert.equal(calculateMme(s).window.totalMme,null);
  s.medications[0] = medication({genericName:'methadone',indication:'oud',strength:null});
  set(s,0,use(1));
  assert.equal(calculateMme(s).medicationRows[0].reason,'strength_unknown');
  set(s,0,use(1,{strengthOverride:10}));
  assert.equal(calculateMme(s).window.totalMme,47);
});

test('OUD methadone reaches daily, monthly and combined exports with dose changes and other opioids', () => {
  const s = session({assessmentDate:'2026-10-03',recallDays:4,medications:[
    medication({id:'methadone',genericName:'methadone',indication:'oud',formulation:'liquid',strength:2,strengthUnit:'mg/mL',quantityUnit:'mL'}), medication(),
  ]});
  fill(s,noUse());
  set(s,0,use(5),'methadone'); set(s,1,use(5,{strengthOverride:4}),'methadone'); set(s,3,use(10),'methadone');
  for (let day=0;day<4;day++) set(s,day,use(1),'oxy-5');
  const before = JSON.stringify(s);
  const result = calculateMme(s);
  assert.deepEqual(result.daily.map(d=>d.mme),[54.5,101.5,7.5,101.5]);
  assert.equal(result.window.totalMme,265); assert.equal(result.window.averageAllDays,66.25);
  assert.equal(result.window.maximumDailyMme,101.5);
  assert.deepEqual(result.months.map(m=>[m.totalMme,m.averageAllDays]),[[156,78],[109,54.5]]);
  const daily = parseCsv(combinedDailyCsv(s));
  assert.equal(daily[1].medication_1_indication,'oud'); assert.equal(daily[1].medication_1_mme,'94');
  assert.equal(daily[1].medication_1_effective_strength,'4'); assert.equal(daily[1].daily_mme,'101.5');
  const [summary] = parseCsv(combinedSummaryCsv(s));
  assert.equal(summary.mme_full_period_total_mme,'265'); assert.equal(summary.month_2_full_period_total_mme,'109');
  for (const fn of [medicationCsv,dailyMmeCsv,mmeSummaryCsv,combinedDailyCsv,combinedSummaryCsv]) {
    assert.ok(parseCsv(fn(s)).every(r=>r.policy_id==='tlfb-mme-policy-2'));
  }
  assert.equal(JSON.stringify(s),before);
});

test('policy-1 sessions upgrade with a notice and preserve every reported field through save/reopen', () => {
  const s = fill(session({recallDays:1,medications:[medication({genericName:'methadone',indication:'oud',strength:10})]}),use(5));
  s.reference.policyId = 'tlfb-mme-policy-1';
  const original = JSON.stringify(s);
  const loaded = readResearchSession(original);
  assert.equal(loaded.notices.length,1); assert.match(loaded.notices[0],/totals may change/);
  assert.equal(loaded.session.reference.policyId,'tlfb-mme-policy-2');
  assert.deepEqual({...loaded.session,reference:s.reference},s);
  assert.equal(calculateMme(loaded.session).window.totalMme,235);
  assert.equal(JSON.stringify(s),original);
  const reopened = readResearchSession(writeResearchSession(loaded.session));
  assert.deepEqual(reopened.session,loaded.session); assert.deepEqual(reopened.notices,[]);
});

test('legacy policy import rejects altered references and malformed data before recalculating', () => {
  for (const change of [s=>s.reference.factors.methadone=12,s=>s.reference.retrieved='2026-01-01',s=>s.reference.extra=true,s=>s.version=3,s=>s.medications[0].strength=-1]) {
    const s = session(); s.reference.policyId='tlfb-mme-policy-1'; change(s);
    assert.throws(()=>readResearchSession(JSON.stringify(s)));
  }
});

test('fentanyl patch uses concurrent rate, not patch replacement count or mg/day', () => {
  const s = session({ recallDays: 3, medications: [medication({ genericName: 'fentanyl', route: 'transdermal', formulation: 'patch', strength: 25, strengthUnit: 'mcg/hr', quantityUnit: 'patches' })] });
  set(s, 0, use(1, { patchHours: 24 }));
  set(s, 1, use(2, { patchHours: 24 }));
  set(s, 2, use(1, { patchHours: 12 }));
  const r = calculateMme(s);
  assert.deepEqual(r.daily.map(d => d.mme), [60, 120, null]);
  assert.equal(r.medicationRows[0].doseBasisUnit, 'mcg/hr');
  assert.equal(r.medicationRows[2].reason, 'patch_full_day_not_confirmed');
  set(s, 2, use(1)); assert.equal(calculateMme(s).daily[2].mme, null);
});

test('buprenorphine stays separate even when missing, including combination generic', () => {
  const bup = medication({ id: 'bup', name: 'Buprenorphine/naloxone', genericName: 'buprenorphine/naloxone', route: 'sublingual', formulation: 'film', strength: 8, quantityUnit: 'units' });
  const s = session({ recallDays: 2, medications: [medication(), bup] });
  set(s, 0, use(1)); set(s, 1, noUse()); set(s, 0, use(2), 'bup');
  const r = calculateMme(s);
  assert.equal(r.window.totalMme, 7.5); assert.equal(r.window.averageAllDays, 3.75);
  assert.equal(r.buprenorphine[0].totalReportedQuantity, 2);
  assert.equal(r.buprenorphine[0].missingDays, 1);
  assert.ok(r.medicationRows.filter(x => x.medicationId === 'bup').every(x => x.mme === null && x.factor === null));
  const only = session({ recallDays: 1, medications: [bup] }); set(only, 0, use(1), 'bup');
  assert.equal(calculateMme(only).window.status, 'not_applicable');
  assert.equal(calculateMme(only).window.totalMme, null);
});

test('unknown BUP quantity suppresses quantity total without affecting supported MME', () => {
  const s = session({ recallDays: 1, medications: [medication({ genericName: 'buprenorphine' })] });
  set(s, 0, use(null));
  const b = calculateMme(s).buprenorphine[0];
  assert.equal(b.useDays, 1); assert.equal(b.unknownQuantityDays, 1); assert.equal(b.totalReportedQuantity, null);
});

test('one 300 mg buprenorphine injection is counted once in a month and never enters MME', () => {
  const s = fill(session({recallDays:30,medications:[medication({id:'sublocade',name:'Sublocade',genericName:'buprenorphine',route:'injection',formulation:'other',strength:300,strengthUnit:'mg/unit',quantityUnit:'units',indication:'oud'})]}));
  set(s,5,use(1),'sublocade');
  const result=calculateMme(s); const b=result.buprenorphine[0];
  assert.equal(b.totalReportedQuantity,1); assert.equal(b.totalReportedDoseMg,300);
  assert.equal(b.useDays,1); assert.equal(b.noUseDays,29); assert.equal(b.unknownDoseDays,0);
  assert.equal(result.window.totalMme,null); assert.equal(result.window.status,'not_applicable');
  const day=parseCsv(medicationCsv(s))[5];
  assert.equal(day.dose_basis,'300'); assert.equal(day.dose_basis_unit,'mg'); assert.equal(day.mme,'');
  const [combined]=parseCsv(combinedSummaryCsv(s));
  assert.equal(combined.buprenorphine_1_total_reported_dose_mg,'300');
  assert.equal(combined.buprenorphine_1_dose_recording,'administered_on_recorded_dates');
  assert.equal(combined.buprenorphine_1_route,'injection');
  const [exported]=parseCsv(buprenorphineCsv(s)); assert.equal(exported.total_reported_dose_mg,'300');
  assert.deepEqual(readResearchSession(writeResearchSession(s)).session,s);
});

test('unknown injection doses stay unknown; direct mg and date-specific doses are preserved', () => {
  const s = session({recallDays:3,medications:[medication({genericName:'buprenorphine',route:'injection',strength:null,strengthUnit:'mg/unit',quantityUnit:'units'})]});
  set(s,0,use(1)); set(s,1,use(1,{strengthOverride:100}));
  let b=calculateMme(s).buprenorphine[0];
  assert.equal(b.unknownDoseDays,1); assert.equal(b.totalReportedDoseMg,null); assert.equal(b.missingDays,1);
  set(s,0,use(1,{strengthOverride:300}));
  b=calculateMme(s).buprenorphine[0]; assert.equal(b.totalReportedDoseMg,400); assert.equal(b.missingDays,1);
  s.medications[0]=medication({genericName:'buprenorphine',route:'injection',strength:null,strengthUnit:'mg',quantityUnit:'mg'});
  set(s,0,use(300)); set(s,1,noUse());
  assert.equal(calculateMme(s).buprenorphine[0].totalReportedDoseMg,300);
  set(s,0,use(null)); assert.equal(calculateMme(s).buprenorphine[0].totalReportedDoseMg,null);
  assert.deepEqual(readResearchSession(writeResearchSession(s)).session,s);
});

test('pump daily delivery is recorded in mg while buprenorphine and other pump drugs stay outside MME', () => {
  for (const genericName of ['buprenorphine','morphine']) {
    const s=session({recallDays:2,medications:[medication({genericName,route:'pump',formulation:'other',strength:null,strengthUnit:'mg',quantityUnit:'mg'})]});
    set(s,0,use(2)); set(s,1,use(3));
    let r=calculateMme(s);
    assert.deepEqual(r.medicationRows.map(d=>d.doseBasis),[2,3]);
    assert.ok(r.medicationRows.every(d=>d.mme===null));
    if(genericName==='buprenorphine') {
      assert.equal(r.buprenorphine[0].totalReportedDoseMg,5);
      assert.equal(r.buprenorphine[0].doseRecording,'delivered_on_recorded_dates');
    }
    s.medications[0]={...s.medications[0],formulation:'liquid',strength:2,strengthUnit:'mg/mL',quantityUnit:'mL'};
    r=calculateMme(s); assert.deepEqual(r.medicationRows.map(d=>d.doseBasis),[4,6]);
    const rows=parseCsv(combinedDailyCsv(s)); assert.equal(rows[0].medication_1_dose_basis,'4'); assert.equal(rows[0].medication_1_mme,'');
    set(s,0,use(null));
    assert.equal(calculateMme(s).medicationRows[0].doseBasis,null);
    assert.deepEqual(readResearchSession(writeResearchSession(s)).session,s);
  }
});

test('pumps, injections, nonpatch fentanyl, and unlisted drugs are explicitly excluded', () => {
  const cases = [
    { route: 'pump', genericName: 'morphine' }, { route: 'injection', genericName: 'hydromorphone' },
    { route: 'buccal', genericName: 'fentanyl' }, { genericName: 'levorphanol' },
    { genericName: 'dihydrocodeine' }, { genericName: 'heroin' }, { genericName: 'counterfeit pill' },
  ];
  for (const extra of cases) {
    const s = session({ recallDays: 1, medications: [medication(), medication({ ...extra, id: 'excluded' })] });
    set(s, 0, use(1)); set(s, 0, use(100), 'excluded');
    const r = calculateMme(s);
    assert.equal(r.window.totalMme, 7.5);
    assert.equal(r.window.excludedMedicationEntries, 1);
    assert.equal(r.medicationRows[1].mme, null);
    assert.equal(r.excluded.length, 1);
    assert.match(r.scope, /excludes/);
  }
});

test('calendar-month averages use only intersecting recall dates, including leap day', () => {
  const s = fill(session({ assessmentDate: '2024-03-03', recallDays: 4 }), use(1));
  const r = calculateMme(s);
  assert.deepEqual(r.months.map(p => [p.period, p.start, p.end, p.daysInScope, p.totalMme, p.averageAllDays]), [
    ['2024-02', '2024-02-28', '2024-02-29', 2, 15, 7.5],
    ['2024-03', '2024-03-01', '2024-03-02', 2, 15, 7.5],
  ]);
  assert.equal(r.months.reduce((n, p) => n + p.totalMme, 0), r.window.totalMme);
});

test('a complete month remains available when another month is incomplete', () => {
  const s = fill(session({ assessmentDate: '2026-01-03', recallDays: 4 }), use(1));
  delete s.medicationResponses[keyFor('2026-01-02', 'oxy-5')];
  const r = calculateMme(s);
  assert.equal(r.months[0].averageAllDays, 7.5);
  assert.equal(r.months[1].averageAllDays, null);
  assert.equal(r.months[1].averageAnsweredDays, 7.5);
  assert.equal(r.window.averageAllDays, null);
});

test('nonopioid missingness does not change MME denominators', () => {
  const s = fill(session({ substances: [{ id: 'alcohol', name: 'Alcohol', unit: 'drinks', kind: 'quantity' }] }), use(1));
  assert.equal(calculateMme(s).window.calculableDays, 7);
  assert.equal(parseCsv(researchSubstanceCsv(s)).filter(r => r.status === 'unanswered').length, 7);
});

test('daily and summary CSV outputs preserve appointment, statuses and denominators', () => {
  const s = session({ recallDays: 2, appointment: { code: 'month_3', label: '3-month follow-up' } });
  set(s, 0, use(2));
  const rows = parseCsv(dailyMmeCsv(s));
  assert.equal(rows.length, 2); assert.equal(rows[0].daily_mme, '15'); assert.equal(rows[1].daily_mme, '');
  assert.equal(rows[1].status, 'incomplete'); assert.equal(rows[0].appointment_code, 'month_3');
  const q = parseCsv(mmeSummaryCsv(s))[0];
  assert.equal(q.full_period_total_mme, ''); assert.equal(q.complete_day_total_mme, '15');
  assert.equal(q.days_in_scope, '2'); assert.equal(q.calculable_days, '1');
  assert.equal(q.average_answered_days_mme_per_day, '15'); assert.equal(q.average_all_days_mme_per_day, '');
});

test('medication export contains reported values, source and unknown quantity without imputation', () => {
  const s = session({ recallDays: 2 });
  set(s, 0, use(2, { strengthOverride: 10 })); set(s, 1, use(null));
  s.notes['2026-09-26'] = 'Birthday, then "travel"\nLate shift';
  const rows = parseCsv(medicationCsv(s));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].reported_quantity, '2'); assert.equal(rows[0].configured_strength, '5');
  assert.equal(rows[0].effective_strength, '10'); assert.equal(rows[0].mme, '30');
  assert.equal(rows[0].event_note, s.notes['2026-09-26']);
  assert.equal(rows[1].response_status, 'use'); assert.equal(rows[1].reported_quantity, '');
  assert.equal(rows[1].mme, ''); assert.equal(rows[1].calculation_status, 'needs_review');
  assert.equal(rows[0].reference_id, 'cdc-2022-table-1');
  assert.equal(rows[0].policy_id, 'tlfb-mme-policy-2');
});

test('all CSV writers neutralize spreadsheet expressions and JSON preserves original text', () => {
  const s = fill(session({ participantId: '=DEMO()', appointment: { code: 'custom', label: '+Synthetic appointment' },
    substances: [{ id: 'other', name: 'Other', unit: 'units', kind: 'quantity' }],
    medications: [medication({ genericName: 'buprenorphine' })],
  }), use(1));
  for (const fn of [medicationCsv, dailyMmeCsv, mmeSummaryCsv, buprenorphineCsv, researchSubstanceCsv, researchSubstanceSummaryCsv]) {
    const row = parseCsv(fn(s))[0];
    assert.equal(row.participant_id, "'=DEMO()");
    assert.equal(row.appointment_label, "'+Synthetic appointment");
  }
  assert.equal(readResearchSession(writeResearchSession(s)).session.participantId, '=DEMO()');
});

test('version-1 migration preserves raw responses and does not guess opioid records', () => {
  const legacy = demoInterview(); legacy.substances[0].name = 'Oxycodone 5 mg';
  const before = JSON.stringify(legacy);
  const { session: migrated, notices } = readResearchSession(before);
  assert.equal(migrated.version, 2); assert.equal(migrated.appointment.code, 'unspecified');
  assert.deepEqual(migrated.medications, []); assert.deepEqual(migrated.responses, legacy.responses);
  assert.deepEqual(migrated.notes, legacy.notes); assert.equal(notices.length, 1);
  assert.equal(JSON.stringify(legacy), before);
  assert.deepEqual(readResearchSession(writeResearchSession(migrated)).session, migrated);
  assert.deepEqual(migrateInterview(legacy), migrated);
});

test('unknown session versions, fields and altered conversion references are rejected', () => {
  const s = session();
  for (const bad of [
    { ...s, version: 3 }, { ...s, unexpected: 1 },
    { ...s, reference: { ...s.reference, id: 'other-reference' } },
    { ...s, reference: { ...s.reference, factors: { ...s.reference.factors, hydromorphone: 4 } } },
    { ...s, reference: { ...s.reference, policyId: 'old-policy' } },
  ]) assert.throws(() => readResearchSession(JSON.stringify(bad)));
  assert.equal(MME_REFERENCE.factors.hydromorphone, 5);
});

test('validation rejects out-of-window, duplicate IDs, bad metadata and malformed values', () => {
  const invalids = [
    s => { s.assessmentDate = '2026-02-30'; }, s => { s.recallDays = 0; },
    s => { s.recallDays = 1.5; }, s => { s.participantId = ''; },
    s => { s.appointment = { code: 'custom', label: '' }; },
    s => { s.medications.push(medication()); },
    s => { s.substances = [{ id: 'oxy-5', name: 'Other', unit: 'unit', kind: 'quantity' }]; },
    s => { s.medicationResponses['2026-09-28|oxy-5'] = noUse(); },
    s => { s.medicationResponses['2026-09-21|unknown'] = noUse(); },
    s => { s.medicationResponses['2026-09-21|oxy-5'] = { status: 'no_use', quantity: 5 }; },
    s => { s.medicationResponses['2026-09-21|oxy-5'] = use(-1); },
    s => { s.medicationResponses['2026-09-21|oxy-5'] = use(0); },
    s => { s.medicationResponses['2026-09-21|oxy-5'] = use('2'); },
    s => { s.medicationResponses['2026-09-21|oxy-5'] = use(Infinity); },
    s => { s.medicationResponses['2026-09-21|oxy-5'] = use(1, { patchHours: 24 }); },
    s => { s.notes['2026-09-28'] = 'outside'; },
    s => { s.notes['2026-09-21'] = 'a'.repeat(2001); },
    s => { s.medications[0].strength = -5; },
    s => { s.medications[0].strengthUnit = 'mg/mL'; },
    s => { s.medications[0].genericName = 'Oxycodone'; },
    s => { s.medications[0].extra = true; },
  ];
  for (const mutate of invalids) { const s = session(); mutate(s); assert.throws(() => validateResearchSession(s), mutate.toString()); }
});

test('patch quantity, patch hours and numeric overflow cannot silently generate MME', () => {
  const s = session({ recallDays: 1, medications: [medication({ genericName: 'fentanyl', route: 'transdermal', formulation: 'patch', strength: 25, strengthUnit: 'mcg/hr', quantityUnit: 'patches' })] });
  set(s, 0, use(0.5, { patchHours: 24 })); assert.throws(() => calculateMme(s), /whole number/);
  set(s, 0, use(1, { patchHours: 25 })); assert.throws(() => calculateMme(s), /24/);
  const huge = session({ recallDays: 1 }); set(huge, 0, use(Number.MAX_VALUE));
  assert.throws(() => calculateMme(huge), /numeric range/);
  const tiny = session({ recallDays: 1, medications: [medication({ strength: 1e-300 })] });
  set(tiny, 0, use(1e-300));
  assert.throws(() => calculateMme(tiny), /numeric range/);
});

test('validation limits file size and rejects truncated or polluted session payloads', () => {
  assert.throws(() => readResearchSession(' ' .repeat(2_000_001)), /2 MB/);
  assert.throws(() => readResearchSession('{'));
  assert.throws(() => readResearchSession('null'));
  const s = session();
  s.medicationResponses = JSON.parse('{"__proto__":{"status":"no_use"}}');
  assert.throws(() => validateResearchSession(s));
});

test('month and day aggregates reconcile for 90 synthetic complete days', () => {
  const s = session({ recallDays: 90 });
  datesFor(s.assessmentDate, 90).forEach((d, i) => set(s, i, i % 4 === 0 ? noUse() : use(i % 3 + 1)));
  const r = calculateMme(s);
  const total = r.daily.reduce((n, d) => n + d.mme, 0);
  assert.equal(r.window.totalMme, total);
  assert.equal(r.months.reduce((n, m) => n + m.totalMme, 0), total);
  assert.equal(r.window.averageAllDays, total / 90);
  assert.equal(r.window.maximumDailyMme, Math.max(...r.daily.map(d => d.mme)));
  assert.equal(parseCsv(medicationCsv(s)).length, 90);
});

test('summary schema 4 includes medication contributions and flags incomplete OUD totals', () => {
  const s=session({recallDays:2,medications:[medication({genericName:'methadone',indication:'oud'})],medicationResponses:{'2026-09-27|oxy-5':use(2)}});
  const [r]=parseCsv(combinedSummaryCsv(s)); assert.equal(r.export_schema,'tlfb-combined-summary-4');
  assert.equal(r.medication_1_recorded_mme_subtotal,'47'); assert.equal(r.medication_1_full_window_mme,'');
  assert.equal(r.medication_1_missing_days,'1'); assert.equal(r.medication_1_minimum_known_use_dose,'10');
  assert.equal(r.oud_methadone_status,'incomplete'); assert.equal(r.oud_methadone_full_window_mme,'');
  assert.equal(r.oud_methadone_recorded_mme_subtotal,'47');
});
