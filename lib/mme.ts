import { datesFor, keyFor } from './tlfb.ts';
import { MME_REFERENCE } from './mme-reference.ts';
import { validateResearchSession } from './research-session.ts';
import type { Medication, MedicationResponse, ResearchSession } from './research-session.ts';

export type Eligibility = {
  scope: 'included' | 'buprenorphine' | 'excluded';
  factor: number | null;
  reason: string | null;
};
export type MedicationResult = Eligibility & {
  date: string;
  medicationId: string;
  responseStatus: 'unanswered' | 'no_use' | 'use';
  quantity: number | null;
  effectiveStrength: number | null;
  strengthOverridden: boolean;
  patchHours: number | null;
  doseBasis: number | null;
  doseBasisUnit: 'mg/day' | 'mcg/hr' | null;
  status: 'calculated' | 'no_use' | 'unanswered' | 'needs_review' | 'excluded' | 'buprenorphine';
  mme: number | null;
};
export type DailyMme = {
  date: string;
  status: 'complete' | 'incomplete' | 'not_applicable';
  includedMedications: number;
  answeredMedications: number;
  calculableMedications: number;
  unansweredMedications: number;
  reviewMedications: number;
  excludedMedications: number;
  buprenorphineMedications: number;
  mme: number | null;
  recordedComponentSubtotal: number | null;
};
export type MmeSummary = {
  period: string;
  start: string;
  end: string;
  status: DailyMme['status'];
  daysInScope: number;
  allResponsesRecordedDays: number;
  calculableDays: number;
  incompleteDays: number;
  confirmedZeroDays: number;
  positiveDays: number;
  unansweredMedicationEntries: number;
  reviewMedicationEntries: number;
  excludedMedicationEntries: number;
  buprenorphineMedicationEntries: number;
  recordedComponentSubtotal: number | null;
  completeDayTotal: number | null;
  totalMme: number | null;
  averageAllDays: number | null;
  averageAnsweredDays: number | null;
  observedMaximumDailyMme: number | null;
  maximumDailyMme: number | null;
};

export function medicationEligibility(m: Medication): Eligibility {
  if (['buprenorphine', 'buprenorphine/naloxone'].includes(m.genericName)) {
    return { scope: 'buprenorphine', factor: null, reason: 'buprenorphine_separate' };
  }
  const excluded = (reason: string): Eligibility => ({ scope: 'excluded', factor: null, reason });
  if (['injection', 'pump'].includes(m.route)) return excluded('route_excluded');
  if (m.genericName === 'fentanyl') {
    if (m.route !== 'transdermal' || m.formulation !== 'patch') return excluded('fentanyl_nonpatch_excluded');
    return { scope: 'included', factor: MME_REFERENCE.factors.fentanyl_transdermal, reason: null };
  }
  if (m.route !== 'oral') return excluded('unsupported_route');
  if (!Object.hasOwn(MME_REFERENCE.factors, m.genericName) || m.genericName === 'fentanyl_transdermal') {
    return excluded('no_factor_in_reference');
  }
  const factor = MME_REFERENCE.factors[m.genericName as keyof typeof MME_REFERENCE.factors];
  return { scope: 'included', factor, reason: null };
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Calculation exceeds the supported numeric range.');
  return value;
}

function product(a: number, b: number): number {
  const result = finite(a * b);
  if (result <= 0) throw new Error('Calculation falls below the supported numeric range.');
  return result;
}

function sum(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => finite(total + value), 0) : null;
}

function calculateMedication(m: Medication, response: MedicationResponse | undefined, date: string): MedicationResult {
  const eligibility = medicationEligibility(m);
  const effectiveStrength = response?.status === 'use' ? response.strengthOverride ?? m.strength : m.strength;
  const result: MedicationResult = {
    ...eligibility,
    date,
    medicationId: m.id,
    responseStatus: response?.status ?? 'unanswered',
    quantity: response?.status === 'no_use' ? 0 : response?.quantity ?? null,
    effectiveStrength,
    strengthOverridden: response?.status === 'use' && response.strengthOverride !== undefined,
    patchHours: response?.status === 'use' ? response.patchHours ?? null : null,
    doseBasis: null,
    doseBasisUnit: null,
    status: eligibility.scope === 'included' ? 'unanswered' : eligibility.scope,
    mme: null,
  };
  if (eligibility.scope !== 'included' || !response) return result;
  if (response.status === 'no_use') return { ...result, status: 'no_use', mme: 0 };
  const review = (reason: string): MedicationResult => ({ ...result, status: 'needs_review', reason });
  if (m.genericName === 'methadone' && m.indication !== 'pain') return review('methadone_indication_requires_review');
  if (response.quantity === null) return review('quantity_unknown');
  let basis: number;
  let unit: 'mg/day' | 'mcg/hr';
  if (m.genericName === 'fentanyl') {
    if (response.patchHours !== 24) return review('patch_full_day_not_confirmed');
    if (effectiveStrength === null) return review('strength_unknown');
    basis = product(response.quantity, effectiveStrength);
    unit = 'mcg/hr';
  } else if (m.quantityUnit === 'mg') {
    basis = response.quantity;
    unit = 'mg/day';
  } else {
    if (m.strengthUnit === 'unknown' || m.formulation === 'other') return review('dose_unit_requires_review');
    if (effectiveStrength === null) return review('strength_unknown');
    basis = product(response.quantity, effectiveStrength);
    unit = 'mg/day';
  }
  return { ...result, status: 'calculated', doseBasis: basis, doseBasisUnit: unit, mme: product(basis, eligibility.factor!) };
}

function calculateDay(date: string, rows: MedicationResult[]): DailyMme {
  const included = rows.filter(r => r.scope === 'included');
  const calculable = included.filter(r => r.mme !== null);
  const isComplete = included.length > 0 && calculable.length === included.length;
  const recorded = sum(calculable.map(r => r.mme!));
  return {
    date,
    status: !included.length ? 'not_applicable' : isComplete ? 'complete' : 'incomplete',
    includedMedications: included.length,
    answeredMedications: included.filter(r => r.responseStatus !== 'unanswered').length,
    calculableMedications: calculable.length,
    unansweredMedications: included.filter(r => r.responseStatus === 'unanswered').length,
    reviewMedications: included.filter(r => r.status === 'needs_review').length,
    excludedMedications: rows.filter(r => r.scope === 'excluded').length,
    buprenorphineMedications: rows.filter(r => r.scope === 'buprenorphine').length,
    mme: isComplete ? recorded : null,
    recordedComponentSubtotal: recorded,
  };
}

function summarizeDays(days: DailyMme[], period: string): MmeSummary {
  const completeDays = days.filter(d => d.status === 'complete');
  const complete = completeDays.length === days.length;
  const notApplicable = days.every(d => d.status === 'not_applicable');
  const values = completeDays.map(d => d.mme!);
  const completeDayTotal = sum(values);
  const max = values.length ? Math.max(...values) : null;
  return {
    period,
    start: days[0].date,
    end: days.at(-1)!.date,
    status: notApplicable ? 'not_applicable' : complete ? 'complete' : 'incomplete',
    daysInScope: days.length,
    allResponsesRecordedDays: days.filter(d => d.includedMedications > 0 && d.answeredMedications === d.includedMedications).length,
    calculableDays: completeDays.length,
    incompleteDays: days.filter(d => d.status === 'incomplete').length,
    confirmedZeroDays: values.filter(v => v === 0).length,
    positiveDays: values.filter(v => v > 0).length,
    unansweredMedicationEntries: days.reduce((n, d) => n + d.unansweredMedications, 0),
    reviewMedicationEntries: days.reduce((n, d) => n + d.reviewMedications, 0),
    excludedMedicationEntries: days.reduce((n, d) => n + d.excludedMedications, 0),
    buprenorphineMedicationEntries: days.reduce((n, d) => n + d.buprenorphineMedications, 0),
    recordedComponentSubtotal: sum(days.flatMap(d => d.recordedComponentSubtotal === null ? [] : [d.recordedComponentSubtotal])),
    completeDayTotal,
    totalMme: complete ? completeDayTotal : null,
    averageAllDays: complete ? completeDayTotal! / days.length : null,
    averageAnsweredDays: completeDays.length ? completeDayTotal! / completeDays.length : null,
    observedMaximumDailyMme: max,
    maximumDailyMme: complete ? max : null,
  };
}

function summarizeSeparate(m: Medication, rows: MedicationResult[]) {
  const responses = rows.filter(r => r.medicationId === m.id);
  const answered = responses.filter(r => r.responseStatus !== 'unanswered');
  const knownQuantities = answered.flatMap(r => r.quantity === null ? [] : [r.quantity]);
  const unknownQuantityDays = answered.filter(r => r.responseStatus === 'use' && r.quantity === null).length;
  const total = unknownQuantityDays ? null : sum(knownQuantities);
  return {
    medicationId: m.id,
    name: m.name,
    quantityUnit: m.quantityUnit,
    answeredDays: answered.length,
    missingDays: responses.length - answered.length,
    useDays: answered.filter(r => r.responseStatus === 'use').length,
    noUseDays: answered.filter(r => r.responseStatus === 'no_use').length,
    unknownQuantityDays,
    totalReportedQuantity: total,
    meanQuantityPerAnsweredDay: total !== null && answered.length ? total / answered.length : null,
  };
}

/** Public entrypoint validates in-memory inputs as well as imported sessions. */
export function calculateMme(session: ResearchSession) {
  validateResearchSession(session);
  const dates = datesFor(session.assessmentDate, session.recallDays);
  const medicationRows: MedicationResult[] = [];
  const daily = dates.map(date => {
    const rows = session.medications.map(m => calculateMedication(m, session.medicationResponses[keyFor(date, m.id)], date));
    medicationRows.push(...rows);
    return calculateDay(date, rows);
  });
  const months = [...new Set(dates.map(date => date.slice(0, 7)))].map(month =>
    summarizeDays(daily.filter(day => day.date.startsWith(month)), month));
  return {
    scope: 'Included opioids under tlfb-mme-policy-1; excludes buprenorphine and unsupported medications/routes.',
    referenceId: session.reference.id,
    policyId: session.reference.policyId,
    medicationRows,
    daily,
    window: summarizeDays(daily, 'recall_window'),
    months,
    excluded: session.medications.filter(m => medicationEligibility(m).scope === 'excluded').map(m => ({ medicationId: m.id, name: m.name, reason: medicationEligibility(m).reason })),
    buprenorphine: session.medications.filter(m => medicationEligibility(m).scope === 'buprenorphine').map(m => summarizeSeparate(m, medicationRows)),
  };
}
