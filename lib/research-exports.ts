import { csv, datesFor, keyFor, summary } from './tlfb.ts';
import { calculateMme } from './mme.ts';
import {medicationSummaries, oudMethadoneSummary} from './interview-tools.ts';
import type { MmeSummary } from './mme.ts';
import { validateResearchSession } from './research-session.ts';
import type { ResearchSession } from './research-session.ts';

const metadataHeaders = ['participant_id', 'assessor', 'appointment_code', 'appointment_label', 'assessment_date'];
const metadata = (s: ResearchSession) => [s.participantId, s.assessor, s.appointment.code, s.appointment.label, s.assessmentDate];
const sourceHeaders = ['reference_id', 'policy_id', 'reference_source', 'reference_published', 'reference_retrieved'];
const bupStatus = (b: {separateMmeFactor: number | null}) => b.separateMmeFactor === null ? 'excluded_buprenorphine' : 'separate_oud_buprenorphine_mme';
const source = (s: ResearchSession) => [s.reference.id, s.reference.policyId, s.reference.sourceUrl, s.reference.published, s.reference.retrieved];

/** Wide research export: exactly one row per recall date, with MME counted once. */
export function combinedDailyCsv(session: ResearchSession): string {
  const result = calculateMme(session);
  const medRows = new Map(result.medicationRows.map(r => [keyFor(r.date, r.medicationId), r]));
  const medicationFields = ['id', 'name', 'generic_name', 'route', 'formulation', 'indication', 'response_status',
    'reported_quantity', 'quantity_unit', 'configured_strength', 'effective_strength', 'strength_unit', 'strength_overridden',
    'patch_hours', 'dose_basis', 'dose_basis_unit', 'scope', 'calculation_status', 'reason', 'factor', 'mme', 'separate_mme'];
  const substanceFields = ['id', 'name', 'measurement', 'unit', 'response_status', 'value'];
  return csv([
    ['export_schema', ...metadataHeaders, 'recall_start', 'recall_end', 'recall_days', 'date', 'mme_scope', 'mme_status',
      'daily_mme', 'recorded_component_subtotal_mme', 'included_medications', 'answered_medications', 'calculable_medications',
      'unanswered_medications', 'review_medications', 'excluded_medications', 'buprenorphine_medications', 'event_note',
      ...session.medications.flatMap((_m, index) => medicationFields.map(f => `medication_${index + 1}_${f}`)),
      ...session.substances.flatMap((_s, index) => substanceFields.map(f => `substance_${index + 1}_${f}`)), ...sourceHeaders],
    ...result.daily.map(d => [
      'tlfb-combined-daily-1', ...metadata(session), result.window.start, result.window.end, session.recallDays,
      d.date, result.scope, d.status, d.mme, d.recordedComponentSubtotal, d.includedMedications, d.answeredMedications,
      d.calculableMedications, d.unansweredMedications, d.reviewMedications, d.excludedMedications, d.buprenorphineMedications,
      session.notes[d.date] ?? '',
      ...session.medications.flatMap(m => {
        const r = medRows.get(keyFor(d.date, m.id))!;
        return [m.id, m.name, m.genericName, m.route, m.formulation, m.indication, r.responseStatus, r.quantity, m.quantityUnit,
          m.strength, r.effectiveStrength, m.strengthUnit, r.strengthOverridden, r.patchHours, r.doseBasis, r.doseBasisUnit,
          r.scope, r.status, r.reason, r.factor, r.mme, r.separateMme];
      }),
      ...session.substances.flatMap(s => {
        const v = session.responses[keyFor(d.date, s.id)];
        return [s.id, s.name, s.kind, s.unit, v === undefined ? 'unanswered' : v === 0 ? 'no_use' : 'use', v];
      }), ...source(session),
    ]),
  ]);
}

const combinedPeriodFields: [keyof MmeSummary, string][] = [
  ['period', 'period'], ['start', 'start'], ['end', 'end'], ['status', 'status'], ['daysInScope', 'days_in_scope'],
  ['allResponsesRecordedDays', 'all_responses_recorded_days'], ['calculableDays', 'calculable_days'],
  ['incompleteDays', 'incomplete_days'], ['confirmedZeroDays', 'confirmed_zero_days'], ['positiveDays', 'positive_days'],
  ['unansweredMedicationEntries', 'unanswered_medication_entries'], ['reviewMedicationEntries', 'review_medication_entries'],
  ['excludedMedicationEntries', 'excluded_medication_entries'], ['buprenorphineMedicationEntries', 'buprenorphine_medication_entries'],
  ['recordedComponentSubtotal', 'recorded_component_subtotal_mme'], ['completeDayTotal', 'complete_day_total_mme'],
  ['totalMme', 'full_period_total_mme'], ['averageAllDays', 'average_all_days_mme_per_day'],
  ['averageAnsweredDays', 'average_answered_days_mme_per_day'], ['observedMaximumDailyMme', 'observed_maximum_daily_mme'],
  ['maximumDailyMme', 'full_period_maximum_daily_mme'],
];

/** One row per interview, with separate column groups for each calendar month and substance. */
export function combinedSummaryCsv(session: ResearchSession): string {
  const result = calculateMme(session);
  const medications = medicationSummaries(session, result), oud = oudMethadoneSummary(session, result);
  const medFields = ['id','name','route','indication','mme_scope','use_days','no_use_days','missing_days','unknown_quantity_days','recorded_quantity_subtotal','quantity_unit','minimum_known_use_dose','maximum_known_use_dose','dose_unit','mme_calculable_days','recorded_mme_subtotal','full_window_mme'];
  const periods = [result.window, ...result.months];
  const subFields = ['id', 'name', 'measurement', 'unit', 'answered_days', 'missing_days', 'no_use_days', 'use_days',
    'percent_use_of_answered_days', 'total_reported_quantity', 'mean_per_answered_day'];
  const bupFields = ['id', 'name', 'quantity_unit', 'answered_days', 'missing_days', 'use_days', 'no_use_days',
    'unknown_quantity_days', 'total_reported_quantity', 'mean_quantity_per_answered_day', 'mme_status', 'route', 'dose_recording', 'unknown_dose_days', 'total_reported_dose_mg',
    'separate_mme_factor', 'separate_mme_recorded_subtotal', 'separate_mme_full_window'];
  return csv([
    ['export_schema', ...metadataHeaders, 'recall_days', 'mme_scope',
      ...periods.flatMap((_p, i) => combinedPeriodFields.map(([, label]) => `${i === 0 ? 'mme' : `month_${i}`}_${label}`)),
      ...session.substances.flatMap((_s, i) => subFields.map(f => `substance_${i + 1}_${f}`)),
      ...result.buprenorphine.flatMap((_b, i) => bupFields.map(f => `buprenorphine_${i + 1}_${f}`)),
      ...medications.flatMap((_m,i) => medFields.map(f => `medication_${i+1}_${f}`)),
      'oud_methadone_status','oud_methadone_recorded_mme_subtotal','oud_methadone_full_window_mme', ...sourceHeaders],
    ['tlfb-combined-summary-4', ...metadata(session), session.recallDays, result.scope,
      ...periods.flatMap(p => combinedPeriodFields.map(([key]) => p[key])),
      ...session.substances.flatMap(s => {
        const q = summary({...session, version: 1}, s);
        return [s.id, s.name, s.kind, s.unit, q.answered, q.missing, q.zeroDays, q.useDays, q.percentUse,
          s.kind === 'quantity' && q.answered ? q.total : null, q.mean];
      }),
      ...result.buprenorphine.flatMap(b => [b.medicationId, b.name, b.quantityUnit, b.answeredDays, b.missingDays,
        b.useDays, b.noUseDays, b.unknownQuantityDays, b.totalReportedQuantity, b.meanQuantityPerAnsweredDay, bupStatus(b), b.route, b.doseRecording, b.unknownDoseDays, b.totalReportedDoseMg,
        b.separateMmeFactor, b.separateMmeRecordedSubtotal, b.separateMmeFullWindow]),
      ...medications.flatMap(r => [r.medication.id,r.medication.name,r.medication.route,r.medication.indication,r.scope,r.useDays,r.noUseDays,r.missingDays,r.unknownQuantityDays,r.recordedQuantity,r.medication.quantityUnit,r.minimumDose,r.maximumDose,r.doseUnit,r.calculableDays,r.recordedMme,r.totalMme]),
      oud ? oud.complete ? 'complete' : 'incomplete' : 'not_applicable', oud?.subtotal ?? null, oud?.total ?? null,
      ...source(session)],
  ]);
}

export function medicationCsv(session: ResearchSession): string {
  const result = calculateMme(session);
  const meds = new Map(session.medications.map(m => [m.id, m]));
  return csv([
    [...metadataHeaders, 'date', 'medication_id', 'name', 'generic_name', 'route', 'formulation', 'indication',
      'response_status', 'reported_quantity', 'quantity_unit', 'configured_strength', 'effective_strength', 'strength_overridden',
      'strength_unit', 'patch_hours', 'dose_basis', 'dose_basis_unit', 'scope', 'calculation_status', 'reason', 'factor', 'mme', 'separate_mme', 'event_note', ...sourceHeaders],
    ...result.medicationRows.map(r => {
      const m = meds.get(r.medicationId)!;
      return [...metadata(session), r.date, m.id, m.name, m.genericName, m.route, m.formulation, m.indication,
        r.responseStatus, r.quantity, m.quantityUnit, m.strength, r.effectiveStrength, r.strengthOverridden, m.strengthUnit,
        r.patchHours, r.doseBasis, r.doseBasisUnit, r.scope, r.status, r.reason, r.factor, r.mme, r.separateMme, session.notes[r.date] ?? '', ...source(session)];
    }),
  ]);
}

export function dailyMmeCsv(session: ResearchSession): string {
  const result = calculateMme(session);
  return csv([
    [...metadataHeaders, 'date', 'scope', 'status', 'daily_mme', 'recorded_component_subtotal_mme', 'included_medications',
      'answered_medications', 'calculable_medications', 'unanswered_medications', 'review_medications', 'excluded_medications',
      'buprenorphine_medications', ...sourceHeaders],
    ...result.daily.map(d => [...metadata(session), d.date, result.scope, d.status, d.mme, d.recordedComponentSubtotal,
      d.includedMedications, d.answeredMedications, d.calculableMedications, d.unansweredMedications, d.reviewMedications,
      d.excludedMedications, d.buprenorphineMedications, ...source(session)]),
  ]);
}

export function mmeSummaryCsv(session: ResearchSession): string {
  const result = calculateMme(session);
  const row = (p: MmeSummary) => [...metadata(session), p.period, p.start, p.end, result.scope, p.status, p.daysInScope,
    p.allResponsesRecordedDays, p.calculableDays, p.incompleteDays, p.confirmedZeroDays, p.positiveDays,
    p.unansweredMedicationEntries, p.reviewMedicationEntries, p.excludedMedicationEntries, p.buprenorphineMedicationEntries,
    p.recordedComponentSubtotal, p.completeDayTotal, p.totalMme, p.averageAllDays, p.averageAnsweredDays,
    p.observedMaximumDailyMme, p.maximumDailyMme, ...source(session)];
  return csv([
    [...metadataHeaders, 'period', 'period_start', 'period_end', 'scope', 'status', 'days_in_scope', 'all_responses_recorded_days',
      'calculable_days', 'incomplete_days', 'confirmed_zero_days', 'positive_days', 'unanswered_medication_entries',
      'review_medication_entries', 'excluded_medication_entries', 'buprenorphine_medication_entries',
      'recorded_component_subtotal_mme', 'complete_day_total_mme', 'full_period_total_mme', 'average_all_days_mme_per_day',
      'average_answered_days_mme_per_day', 'observed_maximum_daily_mme', 'full_period_maximum_daily_mme', ...sourceHeaders],
    row(result.window), ...result.months.map(row),
  ]);
}

export function buprenorphineCsv(session: ResearchSession): string {
  const result = calculateMme(session);
  return csv([
    [...metadataHeaders, 'medication_id', 'name', 'quantity_unit', 'answered_days', 'missing_days', 'use_days', 'no_use_days',
      'unknown_quantity_days', 'total_reported_quantity', 'mean_quantity_per_answered_day', 'mme_status', 'route', 'dose_recording', 'unknown_dose_days', 'total_reported_dose_mg',
      'separate_mme_factor', 'separate_mme_recorded_subtotal', 'separate_mme_full_window', ...sourceHeaders],
    ...result.buprenorphine.map(b => [...metadata(session), b.medicationId, b.name, b.quantityUnit, b.answeredDays,
      b.missingDays, b.useDays, b.noUseDays, b.unknownQuantityDays, b.totalReportedQuantity,
      b.meanQuantityPerAnsweredDay, bupStatus(b), b.route, b.doseRecording, b.unknownDoseDays, b.totalReportedDoseMg,
      b.separateMmeFactor, b.separateMmeRecordedSubtotal, b.separateMmeFullWindow, ...source(session)]),
  ]);
}

export function researchSubstanceCsv(session: ResearchSession): string {
  validateResearchSession(session);
  return csv([
    [...metadataHeaders, 'date', 'substance_id', 'substance', 'measurement', 'unit', 'status', 'value', 'event_note'],
    ...datesFor(session.assessmentDate, session.recallDays).flatMap(d => session.substances.map(s => {
      const value = session.responses[keyFor(d, s.id)];
      return [...metadata(session), d, s.id, s.name, s.kind, s.unit,
        value === undefined ? 'unanswered' : value === 0 ? 'no_use' : 'use', value, session.notes[d] ?? ''];
    })),
  ]);
}

export function researchSubstanceSummaryCsv(session: ResearchSession): string {
  validateResearchSession(session);
  const legacyView = { ...session, version: 1 as const };
  return csv([
    [...metadataHeaders, 'substance_id', 'substance', 'measurement', 'unit', 'answered_days', 'missing_days', 'no_use_days',
      'use_days', 'percent_use_of_answered_days', 'total_reported_quantity', 'mean_per_answered_day'],
    ...session.substances.map(s => {
      const q = summary(legacyView, s);
      return [...metadata(session), s.id, s.name, s.kind, s.unit, q.answered, q.missing, q.zeroDays, q.useDays,
        q.percentUse, s.kind === 'quantity' && q.answered ? q.total : null, q.mean];
    }),
  ]);
}
