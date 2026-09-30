import {datesFor, keyFor} from './tlfb.ts';
import {calculateMme} from './mme.ts';
import {createResearchSession, validateResearchSession} from './research-session.ts';
import type {ResearchSession} from './research-session.ts';

export function followupDraft(source: ResearchSession, assessmentDate: string): ResearchSession {
  validateResearchSession(source);
  return {...createResearchSession(assessmentDate), participantId: source.participantId,
    recallDays: source.recallDays, appointment: {code: 'unspecified', label: ''},
    medications: structuredClone(source.medications), substances: structuredClone(source.substances)};
}

export function rangeDates(session: ResearchSession, start: string, end: string): string[] {
  const dates = datesFor(session.assessmentDate, session.recallDays);
  if (!dates.includes(start) || !dates.includes(end) || start > end) return [];
  return dates.filter(d => d >= start && d <= end);
}

export function interviewReview(session: ResearchSession, result = calculateMme(session)) {
  return datesFor(session.assessmentDate, session.recallDays).map(date => {
    const unanswered = [...session.medications.filter(m => !session.medicationResponses[keyFor(date, m.id)]),
      ...session.substances.filter(s => session.responses[keyFor(date, s.id)] === undefined)].map(x => x.name);
    const needsReview = result.medicationRows.filter(r => r.date === date && r.status === 'needs_review')
      .map(r => ({name: session.medications.find(m => m.id === r.medicationId)!.name, reason: r.reason}));
    return {date, unanswered, needsReview};
  }).filter(d => d.unanswered.length || d.needsReview.length);
}

export function medicationSummaries(session: ResearchSession, result = calculateMme(session)) {
  return session.medications.map(m => {
    const rows = result.medicationRows.filter(r => r.medicationId === m.id);
    const scope = rows[0].scope, answered = rows.filter(r => r.responseStatus !== 'unanswered');
    const quantities = answered.flatMap(r => r.quantity === null ? [] : [r.quantity]);
    const doses = answered.filter(r => r.responseStatus === 'use' && r.doseBasis !== null);
    const doseUnit = doses[0]?.doseBasisUnit ?? null;
    const knownMme = rows.flatMap(r => r.mme === null ? [] : [r.mme]);
    const recordedMme = scope === 'included' && knownMme.length ? knownMme.reduce((a,b) => a+b,0) : null;
    return {medication: m, scope, useDays: rows.filter(r => r.responseStatus === 'use').length,
      noUseDays: rows.filter(r => r.responseStatus === 'no_use').length,
      missingDays: rows.length - answered.length,
      unknownQuantityDays: answered.filter(r => r.responseStatus === 'use' && r.quantity === null).length,
      recordedQuantity: quantities.length ? quantities.reduce((a,b) => a+b,0) : null,
      minimumDose: doses.length ? Math.min(...doses.map(r => r.doseBasis!)) : null,
      maximumDose: doses.length ? Math.max(...doses.map(r => r.doseBasis!)) : null, doseUnit,
      calculableDays: knownMme.length, recordedMme,
      totalMme: scope === 'included' && knownMme.length === rows.length ? recordedMme : null};
  });
}

export function oudMethadoneSummary(session: ResearchSession, result = calculateMme(session)) {
  const ids = new Set(session.medications.filter(m => m.genericName === 'methadone' && m.route === 'oral' && m.indication === 'oud').map(m => m.id));
  if (!ids.size) return null;
  const rows = result.medicationRows.filter(r => ids.has(r.medicationId)), known = rows.filter(r => r.mme !== null);
  const subtotal = known.length ? known.reduce((n,r) => n + r.mme!,0) : null;
  return {complete: known.length === rows.length, subtotal, total: known.length === rows.length ? subtotal : null};
}

export const sessionStem = (session: ResearchSession) => `tlfb-${session.participantId}-${session.appointment.code}-${session.assessmentDate}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
