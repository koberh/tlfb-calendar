import type {ResearchSession} from '../lib/research-session';
import {calculateMme} from '../lib/mme';
import {interviewReview} from '../lib/interview-tools';
import {summary} from '../lib/tlfb';
import {MedicationSummary} from './medication-summary';

const show = (n: number | null) => n === null ? 'Unavailable' : n.toLocaleString('en-US',{maximumFractionDigits:2});
export function PrintSummary({session, result}: {session: ResearchSession; result: ReturnType<typeof calculateMme>}) {
  const days = interviewReview(session,result), w = result.window;
  return <article className="print-summary"><h1>TLFB interview summary</h1>
    <p><strong>{session.participantId}</strong> · {session.appointment.label || 'Appointment unspecified'}<br/>Assessment: {session.assessmentDate} · Assessor: {session.assessor || 'Not recorded'}<br/>Recall: {w.start} to {w.end} ({session.recallDays} days)</p>
    <h2>Interview completeness</h2><p>{days.length ? `${days.length} dates have unanswered responses or MME entries needing review.` : 'All responses recorded; no MME entries need review.'} {w.calculableDays}/{session.recallDays} days have complete MME. Unknown and missing values are not zero.</p>
    <h2>MME results</h2><p>Total: {show(w.totalMme)} · Average across all recall days: {show(w.averageAllDays)} MME/day<br/>Average across calculable days: {show(w.averageAnsweredDays)} MME/day · Maximum: {show(w.maximumDailyMme)}</p>
    {w.status === 'incomplete' && <p>Recorded component subtotal: {show(w.recordedComponentSubtotal)} MME. This is not the full window total.</p>}
    {session.medications.length > 0 && <><h2>Medications</h2><MedicationSummary session={session} result={result}/></>}
    {result.buprenorphine.length > 0 && <><h2>Buprenorphine · separate from MME</h2>{result.buprenorphine.map(b => <p key={b.medicationId}>{b.name}: {show(b.totalReportedDoseMg)} mg on recorded dates;{b.separateMmeFactor !== null ? ` separate NIH HEAL MME ${show(b.separateMmeFullWindow ?? b.separateMmeRecordedSubtotal)}${b.separateMmeFullWindow === null ? ' (recorded so far)' : ''}, not in the overall total;` : ''} {b.missingDays} unanswered days, {b.unknownDoseDays} use days with unknown dose. Optional doses may remain unknown. Injections are recorded only on administration dates.</p>)}</>}
    {session.substances.length > 0 && <><h2>Other substances</h2>{session.substances.map(s => {const q = summary({...session,version:1},s); return <p key={s.id}>{s.name}: {q.useDays} use days, {q.zeroDays} no-use days, {q.missing} unanswered days.{s.kind === 'quantity' ? ` Recorded total: ${q.answered ? show(q.total) : 'Unavailable'} ${s.unit}.` : ''}</p>;})}</>}
    {Object.keys(session.notes).length > 0 && <><h2>Interview notes</h2>{Object.entries(session.notes).sort(([a],[b]) => a.localeCompare(b)).map(([d,n]) => <div className="printed-note" key={d}><strong>{d}</strong><p>{n}</p></div>)}</>}
    <p className="print-reference">Research calculations only. Oral methadone for pain or OUD uses 4.7 MME/mg under this study convention; not for OUD dosing decisions. {session.reference.id === 'nih-heal-2025-table-1' ? 'Buprenorphine for pain is included; OUD buprenorphine is reported separately; unsupported routes are excluded.' : 'Buprenorphine and unsupported routes are excluded.'} {session.reference.title}. Reference: {session.reference.id}; policy: {session.reference.policyId}. Screen and printed values are rounded to two decimal places.</p>
  </article>;
}
