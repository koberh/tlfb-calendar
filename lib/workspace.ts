import {datesFor, keyFor} from './tlfb.ts';
import {calculateMme} from './mme.ts';
import {createResearchSession, validateMedicationResponse, validateResearchSession} from './research-session.ts';
import type {Medication, MedicationResponse, ResearchSession} from './research-session.ts';

export type ResponseDraft = {status: 'unanswered' | 'no_use' | 'use'; quantity: string; strength: string; hours: string};
export const blankResponse = (): ResponseDraft => ({status: 'unanswered', quantity: '', strength: '', hours: ''});
export function responseDraft(r?: MedicationResponse): ResponseDraft {
  return r?.status === 'use' ? {status: 'use', quantity: r.quantity?.toString() ?? '', strength: r.strengthOverride?.toString() ?? '', hours: r.patchHours?.toString() ?? ''} : {...blankResponse(), status: r?.status ?? 'unanswered'};
}
export function commitResponse(m: Medication, d: ResponseDraft): MedicationResponse | undefined {
  if (d.status === 'unanswered') return undefined;
  const r: MedicationResponse = d.status === 'no_use' ? {status: 'no_use'} : {
    status: 'use', quantity: d.quantity.trim() ? Number(d.quantity) : null,
    ...(d.strength.trim() ? {strengthOverride: Number(d.strength)} : {}),
    ...(d.hours.trim() ? {patchHours: Number(d.hours)} : {}),
  };
  validateMedicationResponse(r, m);
  return r;
}
export function calendarStatus(s: ResearchSession, date: string) {
  if (!datesFor(s.assessmentDate, s.recallDays).includes(date)) return {state: 'outside', answered: 0};
  const values = [...s.substances.map(x => s.responses[keyFor(date, x.id)]), ...s.medications.map(m => {
    const r = s.medicationResponses[keyFor(date, m.id)];
    return !r ? undefined : r.status === 'no_use' ? 0 : 1;
  })];
  const answered = values.filter(v => v !== undefined).length;
  return {state: answered === 0 ? 'unanswered' : answered < values.length ? 'partial' : values.some(v => v! > 0) ? 'use' : 'zero', answered};
}
export function selectionDates(s: ResearchSession, kind: 'all' | 'weekdays' | 'weekends') {
  return datesFor(s.assessmentDate, s.recallDays).filter(d => {
    const weekend = [0, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay());
    return kind === 'all' || (kind === 'weekends' ? weekend : !weekend);
  });
}
export function newMedication(id: string): Medication {
  return {id, name: 'Oxycodone', genericName: 'oxycodone', route: 'oral', formulation: 'tablet', indication: 'unknown', strength: null, strengthUnit: 'mg/unit', quantityUnit: 'tablets'};
}
export function measurement(m: Medication, kind: string): Medication {
  const options: Record<string, Pick<Medication, 'formulation' | 'strengthUnit' | 'quantityUnit'>> = {
    tablet: {formulation: 'tablet', strengthUnit: 'mg/unit', quantityUnit: 'tablets'},
    capsule: {formulation: 'capsule', strengthUnit: 'mg/unit', quantityUnit: 'capsules'},
    liquid: {formulation: 'liquid', strengthUnit: 'mg/mL', quantityUnit: 'mL'},
    patch: {formulation: 'patch', strengthUnit: 'mcg/hr', quantityUnit: 'patches'},
    film: {formulation: 'film', strengthUnit: 'mg/unit', quantityUnit: 'units'},
    mg: {formulation: 'other', strengthUnit: 'mg', quantityUnit: 'mg'},
    injection: {formulation: 'other', strengthUnit: 'mg/unit', quantityUnit: 'units'},
    other: {formulation: 'other', strengthUnit: 'unknown', quantityUnit: 'units'},
  };
  return {...m, ...options[kind], strength: null};
}
/** Preserve overlapping dates; never reinterpret recorded quantities after measurement changes. */
export function revisedSetup(old: ResearchSession | null, draft: ResearchSession) {
  const next = structuredClone(draft);
  next.responses = {}; next.medicationResponses = {}; next.notes = {};
  validateResearchSession(next);
  const dates = datesFor(next.assessmentDate, next.recallDays);
  let removed = 0;
  if (old) {
    const medIds = new Set(next.medications.filter(m => {
      const previous = old.medications.find(x => x.id === m.id);
      // A strength that was blank at setup may be filled in later; it completes, not reinterprets, the recorded days.
      const strength = previous?.strength === null ? m.strength : previous?.strength;
      return previous && JSON.stringify({...previous, name: '', indication: '', strength}) === JSON.stringify({...m, name: '', indication: ''});
    }).map(m => m.id));
    const subIds = new Set(next.substances.filter(s => {
      const previous = old.substances.find(x => x.id === s.id);
      return previous && previous.kind === s.kind && previous.unit === s.unit && previous.name === s.name;
    }).map(s => s.id));
    for (const [k, v] of Object.entries(old.responses)) {
      const [d, id] = k.split('|'); if (dates.includes(d) && subIds.has(id)) next.responses[k] = v; else removed++;
    }
    for (const [k, v] of Object.entries(old.medicationResponses)) {
      const [d, id] = k.split('|'); if (dates.includes(d) && medIds.has(id)) next.medicationResponses[k] = v; else removed++;
    }
    for (const [d, note] of Object.entries(old.notes)) {if (dates.includes(d)) next.notes[d] = note; else if (note) removed++;}
  }
  calculateMme(next); // also guard numeric overflow before committing UI state
  return {session: next, removed};
}
export function syntheticDemo() {
  const s = createResearchSession('2026-09-28');
  s.participantId = 'SYNTHETIC-001'; s.assessor = 'Demo'; s.recallDays = 7;
  s.medications = [{...newMedication('oxy-5'), strength: 5, indication: 'pain'}];
  for (const date of datesFor(s.assessmentDate, s.recallDays)) {
    s.medicationResponses[keyFor(date, 'oxy-5')] = {status: 'use', quantity: selectionDates(s, 'weekends').includes(date) ? 2 : 1};
    for (const sub of s.substances) s.responses[keyFor(date, sub.id)] = 0;
  }
  s.notes['2026-09-26'] = 'Fictional family event';
  return s;
}
export const reasonLabel = (reason: string | null) => ({
  quantity_unknown: 'Quantity unknown', strength_unknown: 'Strength unknown',
  patch_full_day_not_confirmed: '24-hour concurrent patch wear not confirmed',
  methadone_indication_requires_review: 'Methadone indication requires review',
  dose_unit_requires_review: 'Dose units require review', route_excluded: 'Pump / injection dose recorded separately; excluded from MME',
  unsupported_route: 'Route excluded', fentanyl_nonpatch_excluded: 'Nonpatch fentanyl excluded',
  no_factor_in_reference: 'No factor in this reference', buprenorphine_separate: 'Buprenorphine reported separately',
}[reason ?? ''] ?? reason ?? '');
