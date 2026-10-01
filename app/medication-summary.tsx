import type {ResearchSession} from '../lib/research-session';
import {calculateMme} from '../lib/mme';
import {medicationSummaries, oudMethadoneSummary} from '../lib/interview-tools';

const number = (n: number | null) => n === null ? '—' : n.toLocaleString('en-US',{maximumFractionDigits:2});
export function MedicationSummary({session, result}: {session: ResearchSession; result: ReturnType<typeof calculateMme>}) {
  const rows = medicationSummaries(session,result), oud = oudMethadoneSummary(session,result);
  return <><p>Recorded amounts cover answered entries only. Missing days and unknown amounts are not zero. Dose ranges reflect known doses on use dates.</p>
    <div className="table-scroll"><table data-testid="medication-summary"><thead><tr><th>Medication</th><th>Use / no use days</th><th>Unanswered / unknown amount</th><th>Recorded amount</th><th>Dose on use dates</th><th>MME contribution</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.medication.id}><th>{r.medication.name}<small>{r.medication.route} · {r.medication.indication === 'oud' ? 'OUD' : r.medication.indication}</small></th>
        <td>{r.useDays} / {r.noUseDays}</td><td>{r.missingDays} / {r.unknownQuantityDays}</td><td>{number(r.recordedQuantity)} {r.medication.quantityUnit}</td>
        <td>{r.minimumDose === null ? '—' : `${number(r.minimumDose)}${r.maximumDose !== r.minimumDose ? '–'+number(r.maximumDose) : ''} ${r.doseUnit}`}</td>
        <td>{r.scope === 'included' ? <>{number(r.totalMme)}<small>{r.totalMme === null ? `Recorded subtotal: ${number(r.recordedMme)}; ${r.calculableDays}/${session.recallDays} days calculable` : 'Full recall window'}</small></> : r.scope === 'buprenorphine' ? (r.separateMmeFactor === null ? 'Separate · no MME' : <>Separate · {number(r.separateMmeFullWindow ?? r.separateMmeRecordedSubtotal)} MME<small>Not in overall MME</small></>) : 'Excluded from MME'}</td></tr>)}</tbody></table></div>
    {oud && <p data-testid="oud-subtotal"><strong>OUD methadone:</strong> {oud.complete ? `${number(oud.total)} MME across the recall window` : `${number(oud.subtotal)} MME recorded so far; full total unavailable`}. Already included in overall MME; do not add it again.</p>}
    <p className="hint">For injections, use days are administration dates. Pump doses are actual daily delivery. Patch dose ranges are rates in mcg/hr.</p>
  </>;
}
