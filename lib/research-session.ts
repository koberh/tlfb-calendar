import { datesFor, keyFor, newInterview, parseInterview } from './tlfb.ts';
import type { Interview, Substance } from './tlfb.ts';
import { assertReference, referenceSnapshot } from './mme-reference.ts';
import type { ReferenceSnapshot } from './mme-reference.ts';

export const APPOINTMENTS = ['baseline', 'month_1', 'month_3', 'month_6', 'custom', 'unspecified'] as const;
export type Appointment = { code: typeof APPOINTMENTS[number]; label: string };
export type Medication = {
  id: string;
  name: string;
  genericName: string;
  route: 'oral' | 'transdermal' | 'sublingual' | 'buccal' | 'injection' | 'pump' | 'other';
  formulation: 'tablet' | 'capsule' | 'liquid' | 'patch' | 'film' | 'other';
  indication: 'pain' | 'oud' | 'other' | 'unknown';
  strength: number | null;
  strengthUnit: 'mg/unit' | 'mg/mL' | 'mcg/hr' | 'mg' | 'unknown';
  quantityUnit: 'tablets' | 'capsules' | 'mL' | 'mg' | 'patches' | 'units';
};
export type MedicationResponse =
  | { status: 'no_use' }
  | { status: 'use'; quantity: number | null; strengthOverride?: number; patchHours?: number };

export type ResearchSession = Omit<Interview, 'version'> & {
  version: 2;
  appointment: Appointment;
  medications: Medication[];
  medicationResponses: Record<string, MedicationResponse>;
  reference: ReferenceSnapshot;
};

/** A setup draft is deliberately incomplete until a participant code is entered. */
export function createResearchSession(assessmentDate: string): ResearchSession {
  datesFor(assessmentDate, 30);
  return {
    ...newInterview(), version: 2, assessmentDate,
    appointment: { code: 'baseline', label: 'Baseline' },
    medications: [], medicationResponses: {}, reference: referenceSnapshot(),
  };
}

function object(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}

function fields(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`${label} contains an unknown field.`);
}

function text(value: unknown, label: string, max: number, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    throw new Error(`${label} is missing or too long.`);
  }
}

function choice(value: unknown, allowed: readonly string[], label: string): void {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(`Invalid ${label}.`);
}

function positive(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite.`);
}

function id(value: unknown): asserts value is string {
  text(value, 'ID', 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error('Invalid ID.');
}

export function validateMedication(value: unknown): asserts value is Medication {
  object(value, 'Medication');
  fields(value, ['id', 'name', 'genericName', 'route', 'formulation', 'indication', 'strength', 'strengthUnit', 'quantityUnit'], 'Medication');
  id(value.id);
  text(value.name, 'Medication name', 160);
  text(value.genericName, 'Generic name', 100);
  if (value.genericName !== value.genericName.trim().toLowerCase()) throw new Error('Use a canonical lowercase generic name.');
  choice(value.route, ['oral', 'transdermal', 'sublingual', 'buccal', 'injection', 'pump', 'other'], 'route');
  choice(value.formulation, ['tablet', 'capsule', 'liquid', 'patch', 'film', 'other'], 'formulation');
  choice(value.indication, ['pain', 'oud', 'other', 'unknown'], 'indication');
  choice(value.strengthUnit, ['mg/unit', 'mg/mL', 'mcg/hr', 'mg', 'unknown'], 'strength unit');
  choice(value.quantityUnit, ['tablets', 'capsules', 'mL', 'mg', 'patches', 'units'], 'quantity unit');
  if (value.strength !== null) positive(value.strength, 'Strength');
  if (value.quantityUnit === 'mg' && (value.strength !== null || value.strengthUnit !== 'mg')) {
    throw new Error('Direct-mg entry needs strength=null and strengthUnit=mg; do not multiply mg twice.');
  }
  if (value.strengthUnit === 'unknown' && value.strength !== null) throw new Error('Unknown strength unit cannot have a numeric strength.');
  // Unsupported routes still retain their reported units for audit, without conversion.
  if (value.route === 'oral' && value.quantityUnit !== 'mg') {
    const valid =
      (value.formulation === 'tablet' && value.quantityUnit === 'tablets' && value.strengthUnit === 'mg/unit') ||
      (value.formulation === 'capsule' && value.quantityUnit === 'capsules' && value.strengthUnit === 'mg/unit') ||
      (value.formulation === 'liquid' && value.quantityUnit === 'mL' && value.strengthUnit === 'mg/mL') ||
      (value.formulation === 'other' && value.quantityUnit === 'units' && value.strengthUnit === 'unknown');
    if (!valid) throw new Error('Oral formulation, strength unit, and quantity unit do not agree.');
  }
  if (value.route === 'transdermal' &&
      (value.formulation !== 'patch' || value.quantityUnit !== 'patches' || value.strengthUnit !== 'mcg/hr')) {
    throw new Error('Patch entry requires patches and mcg/hr strength.');
  }
}

export function validateMedicationResponse(value: unknown, medication: Medication): asserts value is MedicationResponse {
  object(value, 'Medication response');
  if (value.status === 'no_use') {
    fields(value, ['status'], 'No-use response');
    return;
  }
  if (value.status !== 'use') throw new Error('Use absent keys for unanswered responses.');
  fields(value, ['status', 'quantity', 'strengthOverride', 'patchHours'], 'Use response');
  if (value.quantity !== null) positive(value.quantity, 'Use quantity');
  if (value.strengthOverride !== undefined) {
    positive(value.strengthOverride, 'Strength override');
    if (['mg', 'unknown'].includes(medication.strengthUnit)) throw new Error('This entry cannot have a strength override.');
  }
  if (value.patchHours !== undefined) {
    if (medication.route !== 'transdermal') throw new Error('Patch hours require a transdermal medication.');
    positive(value.patchHours, 'Patch hours');
    if ((value.patchHours as number) > 24) throw new Error('Patch hours cannot exceed 24 per day.');
  }
  if (medication.quantityUnit === 'patches' && value.quantity !== null && !Number.isInteger(value.quantity)) {
    throw new Error('Patch count must be a whole number of concurrent patches.');
  }
}

export function validateResearchSession(value: unknown): asserts value is ResearchSession {
  object(value, 'Session');
  fields(value, ['version', 'participantId', 'assessor', 'assessmentDate', 'recallDays', 'substances', 'responses', 'notes', 'appointment', 'medications', 'medicationResponses', 'reference'], 'Session');
  if (value.version !== 2) throw new Error('Unsupported research session version.');
  text(value.participantId, 'Participant code', 80);
  text(value.assessor, 'Assessor', 160, true);
  text(value.assessmentDate, 'Assessment date', 10);
  if (typeof value.recallDays !== 'number') throw new Error('Invalid recall window.');
  const dates = datesFor(value.assessmentDate, value.recallDays);
  object(value.appointment, 'Appointment');
  fields(value.appointment, ['code', 'label'], 'Appointment');
  choice(value.appointment.code, APPOINTMENTS, 'appointment');
  text(value.appointment.label, 'Appointment label', 120, value.appointment.code === 'unspecified');
  assertReference(value.reference);

  if (!Array.isArray(value.substances) || value.substances.length > 12) throw new Error('Use at most 12 substances.');
  const substanceIds = new Set<string>();
  const names = new Set<string>();
  for (const s of value.substances) {
    object(s, 'Substance');
    fields(s, ['id', 'name', 'unit', 'kind'], 'Substance');
    id(s.id); text(s.name, 'Substance name', 80); text(s.unit, 'Unit', 80);
    choice(s.kind, ['quantity', 'binary'], 'measurement');
    if (substanceIds.has(s.id) || names.has(s.name.trim().toLowerCase())) throw new Error('Duplicate substance.');
    substanceIds.add(s.id); names.add(s.name.trim().toLowerCase());
  }
  object(value.responses, 'Substance responses');
  const substances = value.substances as Substance[];
  const substanceKeys = new Map(dates.flatMap(d => substances.map(s => [keyFor(d, s.id), s] as const)));
  for (const [key, quantity] of Object.entries(value.responses)) {
    const s = substanceKeys.get(key);
    if (!s || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0 ||
        (s.kind === 'binary' && quantity !== 0 && quantity !== 1)) throw new Error('Invalid substance response.');
  }
  object(value.notes, 'Event notes');
  for (const [date, note] of Object.entries(value.notes)) {
    if (!dates.includes(date)) throw new Error('Event note falls outside the recall window.');
    text(note, 'Event note', 2000, true);
  }

  if (!Array.isArray(value.medications) || value.medications.length > 30) throw new Error('Use at most 30 medication records.');
  const ids = new Set<string>();
  for (const m of value.medications) {
    validateMedication(m);
    if (ids.has(m.id) || substanceIds.has(m.id)) throw new Error('Medication IDs must be unique across records.');
    ids.add(m.id);
  }
  object(value.medicationResponses, 'Medication responses');
  const meds = value.medications as Medication[];
  const medKeys = new Map(dates.flatMap(d => meds.map(m => [keyFor(d, m.id), m] as const)));
  for (const [key, response] of Object.entries(value.medicationResponses)) {
    const medication = medKeys.get(key);
    if (!medication) throw new Error('Medication response has an unknown date or medication.');
    validateMedicationResponse(response, medication);
  }
  if (!substances.length && !meds.length) throw new Error('Configure at least one substance or medication.');
}

export function migrateInterview(legacy: Interview): ResearchSession {
  // Validate all legacy fields before copying them, and never infer a medication.
  object(legacy, 'Legacy session');
  fields(legacy, ['version', 'participantId', 'assessor', 'assessmentDate', 'recallDays', 'substances', 'responses', 'notes'], 'Legacy session');
  const checked = parseInterview(JSON.stringify(legacy));
  const session: ResearchSession = {
    version: 2,
    participantId: checked.participantId,
    assessor: checked.assessor,
    assessmentDate: checked.assessmentDate,
    recallDays: checked.recallDays,
    substances: structuredClone(checked.substances),
    responses: structuredClone(checked.responses),
    notes: structuredClone(checked.notes),
    appointment: { code: 'unspecified', label: '' },
    medications: [],
    medicationResponses: {},
    reference: referenceSnapshot(),
  };
  validateResearchSession(session);
  return session;
}

export function readResearchSession(text: string): { session: ResearchSession; notices: string[] } {
  if (new TextEncoder().encode(text).length > 2_000_000) throw new Error('Session exceeds the 2 MB limit.');
  const parsed: unknown = JSON.parse(text);
  object(parsed, 'Session');
  if (parsed.version === 1) {
    fields(parsed, ['version', 'participantId', 'assessor', 'assessmentDate', 'recallDays', 'substances', 'responses', 'notes'], 'Legacy session');
    return {
      session: migrateInterview(parseInterview(text)),
      notices: ['Imported version 1. Appointment is unspecified. No medication identities, strengths, or MME were inferred; map legacy opioid entries explicitly.'],
    };
  }
  validateResearchSession(parsed);
  return { session: parsed, notices: [] };
}

export function writeResearchSession(session: ResearchSession): string {
  validateResearchSession(session);
  return JSON.stringify(session, null, 2);
}
