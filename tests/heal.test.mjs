import test from 'node:test';
import assert from 'node:assert/strict';
import { datesFor, keyFor } from '../lib/tlfb.ts';
import { referenceSnapshot, HEAL_REFERENCE, CDC_REFERENCE } from '../lib/mme-reference.ts';
import { readResearchSession, writeResearchSession } from '../lib/research-session.ts';
import { calculateMme } from '../lib/mme.ts';
import { followupDraft, medicationSummaries } from '../lib/interview-tools.ts';
import { revisedSetup } from '../lib/workspace.ts';
import { calculationPreview } from '../lib/calculation-preview.ts';
import { buprenorphineCsv, combinedSummaryCsv, medicationCsv } from '../lib/research-exports.ts';
import { session, medication, noUse, use } from './research-fixtures.mjs';

const heal = () => referenceSnapshot(HEAL_REFERENCE.id);
const fillAll = (s, response) => {
  for (const d of datesFor(s.assessmentDate, s.recallDays)) for (const m of s.medications) s.medicationResponses[keyFor(d, m.id)] = structuredClone(response);
  return s;
};
const suboxone = (indication) => medication({id: 'bup', name: 'Suboxone 8 mg', genericName: 'buprenorphine/naloxone', route: 'sublingual', formulation: 'film', strength: 8, strengthUnit: 'mg/unit', quantityUnit: 'units', indication});
const butrans = (indication = 'pain') => medication({id: 'but', name: 'Butrans', genericName: 'buprenorphine', route: 'transdermal', formulation: 'patch', strength: 10, strengthUnit: 'mcg/hr', quantityUnit: 'patches', indication});
const belbuca = () => medication({id: 'bel', name: 'Belbuca', genericName: 'buprenorphine', route: 'buccal', formulation: 'film', strength: 450, strengthUnit: 'mcg/unit', quantityUnit: 'units', indication: 'pain'});

test('both references are accepted, CDC stays the default, and altered factors are refused', () => {
  assert.equal(session().reference.id, CDC_REFERENCE.id);
  const s = fillAll(session({reference: heal()}), use(2));
  assert.equal(readResearchSession(writeResearchSession(s)).session.reference.id, HEAL_REFERENCE.id);
  const tampered = structuredClone(s); tampered.reference.factors.tapentadol = 0.4;
  assert.throws(() => readResearchSession(JSON.stringify(tampered)), /altered MME reference/);
});

test('NIH HEAL factors differ from CDC only where the table does', () => {
  const tap = medication({id: 'tap', name: 'Tapentadol 50', genericName: 'tapentadol', strength: 50});
  const cdc = calculateMme(fillAll(session({medications: [tap]}), use(2)));
  const nih = calculateMme(fillAll(session({medications: [tap], reference: heal()}), use(2)));
  assert.equal(cdc.daily[0].mme, 40); assert.equal(nih.daily[0].mme, 30);
  const oxy = calculateMme(fillAll(session({reference: heal()}), use(2)));
  assert.equal(oxy.daily[0].mme, 15);
});

test('opioids only in the HEAL table convert under HEAL and are excluded under CDC', () => {
  const levo = medication({id: 'levo', name: 'Levorphanol 2', genericName: 'levorphanol', strength: 2});
  assert.equal(calculateMme(fillAll(session({medications: [levo], reference: heal()}), use(1))).daily[0].mme, 22);
  const cdc = calculateMme(fillAll(session({medications: [levo]}), use(1)));
  assert.deepEqual(cdc.excluded.map(x => x.reason), ['no_factor_in_reference']);
});

test('HEAL buprenorphine for pain enters MME: sublingual mg, buccal mcg and 24-hour patch', () => {
  const s = session({reference: heal(), recallDays: 1, medications: [suboxone('pain'), butrans(), belbuca()]});
  const d = '2026-09-27';
  s.medicationResponses[keyFor(d, 'bup')] = use(1);
  s.medicationResponses[keyFor(d, 'but')] = use(1, {patchHours: 24});
  s.medicationResponses[keyFor(d, 'bel')] = use(2);
  const r = calculateMme(s);
  const by = Object.fromEntries(r.medicationRows.map(x => [x.medicationId, x]));
  assert.ok(Math.abs(by.bup.mme - 8 * 38.8) < 1e-9);
  assert.ok(Math.abs(by.but.mme - 10 * 2.2) < 1e-9);
  assert.ok(Math.abs(by.bel.mme - 900 * 0.039) < 1e-9);
  assert.equal(by.bel.doseBasisUnit, 'mcg/day');
  assert.equal(r.window.status, 'complete');
  assert.equal(r.buprenorphine.length, 0);
});

test('HEAL OUD buprenorphine stays out of totals with its own subtotal', () => {
  const s = fillAll(session({reference: heal(), medications: [medication(), suboxone('oud')]}), use(2));
  const r = calculateMme(s);
  assert.equal(r.window.totalMme, 7 * 15);
  const [b] = r.buprenorphine;
  assert.equal(b.separateMmeFactor, 38.8);
  assert.ok(Math.abs(b.separateMmeFullWindow - 7 * 16 * 38.8) < 1e-6);
  const summary = medicationSummaries(s, r).find(x => x.medication.id === 'bup');
  assert.equal(summary.scope, 'buprenorphine'); assert.equal(summary.totalMme, null);
  assert.match(buprenorphineCsv(s), /separate_oud_buprenorphine_mme/);
  assert.match(combinedSummaryCsv(s), /separate_mme_full_window/);
  assert.match(medicationCsv(s), /separate_mme/);
  assert.match(calculationPreview(suboxone('oud'), {status: 'use', quantity: '2', strength: '', hours: ''}, heal()).text, /separate subtotal: 16 × 38\.8 = 620\.8 MME/);
});

test('HEAL buprenorphine with unknown indication needs review; CDC keeps it separate without MME', () => {
  const s = fillAll(session({reference: heal(), medications: [suboxone('unknown')]}), use(1));
  const r = calculateMme(s);
  assert.equal(r.medicationRows[0].status, 'needs_review');
  assert.equal(r.medicationRows[0].reason, 'buprenorphine_indication_requires_review');
  const cdc = calculateMme(fillAll(session({medications: [suboxone('pain')]}), use(1)));
  assert.equal(cdc.buprenorphine[0].separateMmeFactor, null);
  assert.equal(cdc.window.status, 'not_applicable');
});

test('partial-day HEAL patch wear needs review and never counts as a separate subtotal', () => {
  const s = session({reference: heal(), recallDays: 1, medications: [butrans('pain'), {...butrans('oud'), id: 'but2'}]});
  s.medicationResponses['2026-09-27|but'] = use(1, {patchHours: 12});
  s.medicationResponses['2026-09-27|but2'] = use(1, {patchHours: 12});
  const r = calculateMme(s);
  assert.equal(r.medicationRows[0].status, 'needs_review');
  assert.equal(r.medicationRows[1].separateMme, null);
  assert.equal(r.buprenorphine[0].separateMmeFullWindow, null);
});

test('switching tables keeps every answer; follow-ups keep the chosen table', () => {
  const before = fillAll(session(), use(2));
  before.medicationResponses['2026-09-21|oxy-5'] = noUse();
  const after = structuredClone(before); after.reference = heal();
  const revised = revisedSetup(before, after);
  assert.equal(revised.removed, 0);
  assert.equal(revised.session.reference.id, HEAL_REFERENCE.id);
  assert.equal(followupDraft(revised.session, '2026-10-28').reference.id, HEAL_REFERENCE.id);
});
