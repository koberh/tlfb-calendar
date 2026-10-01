import type {Medication, ResearchSession} from '../lib/research-session';
import {blankResponse, measurement, newMedication, reasonLabel} from '../lib/workspace';
import type {ResponseDraft} from '../lib/workspace';
import {isBuprenorphine, medicationEligibility} from '../lib/mme';
import {REFERENCES, referenceSnapshot, usesHeal} from '../lib/mme-reference';
import type {ReferenceSnapshot} from '../lib/mme-reference';
import {calculationPreview} from '../lib/calculation-preview';

export const visits = [['baseline','Baseline'],['month_1','1-month follow-up'],['month_3','3-month follow-up'],['month_6','6-month follow-up'],['custom','Custom'],['unspecified','Unspecified']] as const;
const drugs = ['codeine','hydrocodone','hydromorphone','methadone','morphine','oxycodone','oxymorphone','tapentadol','tramadol','fentanyl','buprenorphine','buprenorphine/naloxone','butorphanol','dihydrocodeine','levorphanol','meperidine','opium','pentazocine'];
const tableNames: Record<string, string> = {'cdc-2022-table-1': 'CDC 2022', 'nih-heal-2025-table-1': 'NIH HEAL'};

export function MedicationEntry({medication: m, reference, value, onChange, applyLabel = 'Save day'}: {medication: Medication; reference: ReferenceSnapshot; value: ResponseDraft; onChange: (d: ResponseDraft) => void; applyLabel?: string}) {
  const scope = medicationEligibility(m, reference);
  const preview = calculationPreview(m, value, reference);
  return <fieldset className="daily-med"><legend>{m.name}</legend>
    <p className="hint">{m.strength === null ? (m.quantityUnit === 'mg' ? 'Direct mg entry' : 'Strength unknown') : `${m.strength} ${m.route === 'injection' && m.strengthUnit === 'mg/unit' ? 'mg/injection' : m.strengthUnit}`} · {m.route} · enter {m.route === 'injection' && m.quantityUnit === 'units' ? 'injection count' : m.quantityUnit}</p>
    {m.route === 'injection' && <p className="hint">Record the dose only on its administration date. No dose administered means no injection that day, not absence of medication effect. Do not repeat a monthly dose across every day.</p>}
    {m.route === 'pump' && <p className="hint">Record the amount actually delivered that day. Reservoir/refill amount is not the delivered dose; leave quantity unknown if daily delivery is unknown.</p>}
    {scope.reason && <p className="hint">{reasonLabel(scope.reason)}</p>}
    <label>Response for {m.name}<select value={value.status} onChange={e => {const status = e.target.value as ResponseDraft['status']; onChange({...blankResponse(), status, hours: status === 'use' && m.route === 'transdermal' ? '24' : ''});}}>
      <option value="unanswered">Unanswered</option><option value="no_use">{m.route === 'injection' ? 'No dose administered' : 'Confirmed no use'}</option><option value="use">{m.route === 'injection' ? 'Dose administered' : 'Use reported'}</option>
    </select></label>
    {value.status === 'use' && <>
      <label>{m.route === 'injection' ? (m.quantityUnit === 'units' ? 'Number of injections' : `Amount administered (${m.quantityUnit})`) : m.route === 'pump' ? `Amount delivered that day (${m.quantityUnit})` : `Quantity (${m.quantityUnit})`}<input type="number" min="0" step={m.quantityUnit === 'patches' || (m.route === 'injection' && m.quantityUnit === 'units') ? 1 : 'any'} value={value.quantity} placeholder="Unknown" onChange={e => onChange({...value, quantity: e.target.value})}/></label>
      <p className="hint">Leave blank if the amount is unknown. {m.route === 'injection' ? 'Select “No dose administered” for zero injections.' : 'Select “Confirmed no use” for zero.'}</p>
      {!['mg', 'unknown'].includes(m.strengthUnit) && <label>{m.route === 'injection' && m.strengthUnit === 'mg/unit' ? 'Dose on this date (mg/injection)' : `Strength on this day (${m.strengthUnit})`}<input type="number" min="0" step="any" value={value.strength} placeholder={m.strength === null ? 'Unknown' : `Use setup strength: ${m.strength}`} onChange={e => onChange({...value, strength: e.target.value})}/></label>}
      {m.route === 'transdermal' && <><label>Confirmed hours of concurrent wear<input type="number" min="0" max="24" step="any" value={value.hours} placeholder="Unknown" onChange={e => onChange({...value, hours: e.target.value})}/></label><p className="hint">Count patches worn at the same time, not replacements. Starts at 24 hours; change it for partial-wear days, which require review.</p></>}
    </>}
    <div className={`calculation-preview${preview.invalid ? ' invalid' : ''}`} data-testid="calculation-preview" aria-live="polite"><strong>Calculation preview</strong><p>{preview.text}</p><small>Updates as you type. Use {applyLabel} to apply this response.</small></div>
  </fieldset>;
}

export function SetupFields({draft, onChange}: {draft: ResearchSession; onChange: (s: ResearchSession) => void}) {
  const updateMed = (id: string, m: Medication) => onChange({...draft, medications: draft.medications.map(x => x.id === id ? m : x)});
  return <>
    <div className="setup-grid">
      <label>Participant code<input required maxLength={80} value={draft.participantId} onChange={e => onChange({...draft, participantId: e.target.value})}/></label>
      <label>Assessor<input maxLength={160} value={draft.assessor} onChange={e => onChange({...draft, assessor: e.target.value})}/></label>
      <label>Assessment date<input required type="date" min="1900-01-01" max="2100-12-31" value={draft.assessmentDate} onChange={e => onChange({...draft, assessmentDate: e.target.value})}/></label>
      <label>Recall window (days)<input required type="number" min={1} max={90} value={draft.recallDays || ''} onChange={e => onChange({...draft, recallDays: Number(e.target.value)})}/></label>
    </div>
    <div className="setup-grid visit-grid">
      <label>Appointment<select value={draft.appointment.code} onChange={e => {const v = visits.find(v => v[0] === e.target.value)!; onChange({...draft, appointment: {code: v[0], label: v[0] === 'custom' ? '' : v[1]}});}}>{visits.map(v => <option key={v[0]} value={v[0]}>{v[1]}</option>)}</select></label>
      <label>Appointment name<input required={draft.appointment.code !== 'unspecified'} maxLength={120} value={draft.appointment.label} onChange={e => onChange({...draft, appointment: {...draft.appointment, label: e.target.value}})}/></label>
    </div>
    <div className="setup-grid reference-grid">
      <label>MME conversion table<select value={draft.reference.id} onChange={e => onChange({...draft, reference: referenceSnapshot(e.target.value)})}>{REFERENCES.map(r => <option key={r.id} value={r.id}>{tableNames[r.id] ?? r.title}</option>)}</select></label>
    <p className="hint">{usesHeal(draft.reference) ? 'NIH HEAL: adds factors for more opioids (tapentadol 0.3) and counts buprenorphine for pain in MME. OUD buprenorphine stays out of the totals, with its own MME subtotal.' : 'CDC 2022: the CDC pain-management table. Buprenorphine is reported separately, without MME.'} Changing the table keeps every recorded answer and recalculates.</p>
    </div>
    <div className="substance-header"><h3>Opioid medications</h3><p>Record the opioid ingredient and reported strength. For combination products, use only the opioid strength. Unknown strengths may stay blank.</p></div>
    {draft.medications.map((m, i) => <fieldset className="medication-card" key={m.id}><legend>Medication {i + 1}</legend><div className="medication-fields">
      <label>Generic ingredient<select value={drugs.includes(m.genericName) ? m.genericName : 'other'} onChange={e => {
        const genericName = e.target.value === 'other' ? '' : e.target.value;
        const route = genericName === 'fentanyl' ? 'transdermal' : genericName.startsWith('buprenorphine') ? 'sublingual' : 'oral';
        updateMed(m.id, measurement({...m, genericName, name: genericName ? genericName[0].toUpperCase() + genericName.slice(1) : '', route, indication: 'unknown'}, route === 'transdermal' ? 'patch' : route === 'sublingual' ? 'film' : 'tablet'));
      }}>{drugs.map(d => <option key={d}>{d}</option>)}<option value="other">Other / unlisted</option></select></label>
      {!drugs.includes(m.genericName) && <label>Other generic name<input required maxLength={100} value={m.genericName} onChange={e => updateMed(m.id, {...m, genericName: e.target.value.toLowerCase().trim()})}/></label>}
      <label>Display name<input required maxLength={160} value={m.name} onChange={e => updateMed(m.id, {...m, name: e.target.value})}/></label>
      <label>Route<select value={m.route} onChange={e => {
        const route = e.target.value as Medication['route'];
        updateMed(m.id, measurement({...m, route}, route === 'transdermal' ? 'patch' : route === 'oral' ? 'tablet' : route === 'buccal' ? 'film-mcg' : route === 'sublingual' ? 'film' : route === 'injection' ? 'injection' : route === 'pump' ? 'mg' : 'other'));
      }}>{['oral','transdermal','sublingual','buccal','injection','pump','other'].map(r => <option key={r}>{r}</option>)}</select></label>
      <label>Form / entry method<select value={m.quantityUnit === 'mg' ? 'mg' : m.route === 'injection' && m.formulation === 'other' && m.strengthUnit === 'mg/unit' && m.quantityUnit === 'units' ? 'injection' : m.strengthUnit === 'mcg/unit' ? 'film-mcg' : m.formulation} onChange={e => updateMed(m.id, measurement(m, e.target.value))}>
        {(m.route === 'transdermal' ? ['patch'] : m.route === 'oral' ? ['tablet','capsule','liquid','mg','other'] : m.route === 'injection' ? ['injection','mg','liquid','tablet','capsule','film','patch','other'] : m.route === 'buccal' || m.route === 'sublingual' ? ['film','film-mcg','tablet','capsule','liquid','mg','other'] : ['tablet','capsule','liquid','film','patch','mg','other']).map(f => <option value={f} key={f}>{f === 'injection' ? 'Dose per injection' : f === 'film-mcg' ? 'film (mcg strength)' : f === 'film' ? 'film (mg strength)' : f === 'mg' ? (m.route === 'injection' ? 'Total mg administered on date' : m.route === 'pump' ? 'Total mg delivered per day' : 'Total mg per day') : f}</option>)}
      </select></label>
      {!['mg','unknown'].includes(m.strengthUnit) && <label>{m.route === 'injection' && m.strengthUnit === 'mg/unit' ? 'Dose per injection (mg)' : `Strength (${m.strengthUnit})`}<input type="number" min="0" step="any" value={m.strength ?? ''} placeholder="Unknown" onChange={e => updateMed(m.id, {...m, strength: e.target.value === '' ? null : Number(e.target.value)})}/></label>}
      {m.quantityUnit === 'mg' && <p className="hint">Enter {m.route === 'injection' ? 'the administered dose' : m.route === 'pump' ? 'the amount delivered' : 'the daily dose'} in mg on the calendar.</p>}
      <label>Indication<select value={m.indication} onChange={e => updateMed(m.id, {...m, indication: e.target.value as Medication['indication']})}><option value="unknown">Unknown / not recorded</option><option value="pain">Pain</option><option value="oud">Opioid use disorder</option><option value="other">Other</option></select></label>
    </div><div className="inline-actions"><p className="hint">Daily quantity: {m.quantityUnit}. {reasonLabel(medicationEligibility(m, draft.reference).reason)}{isBuprenorphine(m) && usesHeal(draft.reference) ? ' Under NIH HEAL, record the indication: pain counts toward MME, OUD stays separate, other or unknown needs review.' : ''}{m.genericName === 'methadone' ? ' Oral methadone for pain or OUD: research MME = mg/day × 4.7. Record the actual indication; other or unknown indications need review.' : ''}</p><button type="button" onClick={() => onChange({...draft, medications: draft.medications.filter(x => x.id !== m.id)})}>Remove medication {i + 1}</button></div></fieldset>)}
    <button type="button" disabled={draft.medications.length >= 30} onClick={() => onChange({...draft, medications: [...draft.medications, newMedication(crypto.randomUUID())]})}>+ Add opioid</button>
    <div className="substance-header"><h3>Other substances</h3><p>Use the names, definitions, and units specified by your study.</p></div>
    {draft.substances.map((s, i) => <div className="substance-row" key={s.id}><span className="index">{i + 1}</span>
      <label>Substance<input required maxLength={80} value={s.name} onChange={e => onChange({...draft, substances: draft.substances.map(x => x.id === s.id ? {...s, name: e.target.value} : x)})}/></label>
      <label>Record as<select value={s.kind} onChange={e => onChange({...draft, substances: draft.substances.map(x => x.id === s.id ? {...s, kind: e.target.value as 'binary' | 'quantity', unit: e.target.value === 'binary' ? 'use / no use' : ''} : x)})}><option value="quantity">Daily quantity</option><option value="binary">Use / no use</option></select></label>
      <label>Unit<input required maxLength={80} readOnly={s.kind === 'binary'} value={s.unit} onChange={e => onChange({...draft, substances: draft.substances.map(x => x.id === s.id ? {...s, unit: e.target.value} : x)})}/></label>
      <button type="button" onClick={() => onChange({...draft, substances: draft.substances.filter(x => x.id !== s.id)})} aria-label={`Remove ${s.name}`}>Remove</button>
    </div>)}
    <button type="button" disabled={draft.substances.length >= 12} onClick={() => onChange({...draft, substances: [...draft.substances, {id: crypto.randomUUID(), name: '', kind: 'quantity', unit: ''}]})}>+ Add substance</button>
  </>;
}
