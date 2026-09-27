import { csv, datesFor, keyFor, summary } from './tlfb.ts';
import { calculateMme } from './mme.ts';
import type { MmeSummary } from './mme.ts';
import { validateResearchSession } from './research-session.ts';
import type { ResearchSession } from './research-session.ts';

const metadataHeaders = ['participant_id', 'assessor', 'appointment_code', 'appointment_label', 'assessment_date'];
const metadata = (s: ResearchSession) => [s.participantId, s.assessor, s.appointment.code, s.appointment.label, s.assessmentDate];
const sourceHeaders = ['reference_id', 'policy_id', 'reference_source', 'reference_published', 'reference_retrieved'];
const source = (s: ResearchSession) => [s.reference.id, s.reference.policyId, s.reference.sourceUrl, s.reference.published, s.reference.retrieved];

export function medicationCsv(session: ResearchSession): string {
  const result = calculateMme(session);
  const meds = new Map(session.medications.map(m => [m.id, m]));
  return csv([
    [...metadataHeaders, 'date', 'medication_id', 'name', 'generic_name', 'route', 'formulation', 'indication',
      'response_status', 'reported_quantity', 'quantity_unit', 'configured_strength', 'effective_strength', 'strength_overridden',
      'strength_unit', 'patch_hours', 'dose_basis', 'dose_basis_unit', 'scope', 'calculation_status', 'reason', 'factor', 'mme', 'event_note', ...sourceHeaders],
    ...result.medicationRows.map(r => {
      const m = meds.get(r.medicationId)!;
      return [...metadata(session), r.date, m.id, m.name, m.genericName, m.route, m.formulation, m.indication,
        r.responseStatus, r.quantity, m.quantityUnit, m.strength, r.effectiveStrength, r.strengthOverridden, m.strengthUnit,
        r.patchHours, r.doseBasis, r.doseBasisUnit, r.scope, r.status, r.reason, r.factor, r.mme, session.notes[r.date] ?? '', ...source(session)];
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
      'unknown_quantity_days', 'total_reported_quantity', 'mean_quantity_per_answered_day', 'mme_status'],
    ...result.buprenorphine.map(b => [...metadata(session), b.medicationId, b.name, b.quantityUnit, b.answeredDays,
      b.missingDays, b.useDays, b.noUseDays, b.unknownQuantityDays, b.totalReportedQuantity,
      b.meanQuantityPerAnsweredDay, 'excluded_buprenorphine']),
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
