import {previewMedication} from './mme.ts';
import type {Medication} from './research-session.ts';
import {commitResponse, reasonLabel} from './workspace.ts';
import type {ResponseDraft} from './workspace.ts';

const number = (n: number) => n.toLocaleString('en-US', {maximumSignificantDigits: 12});
export function calculationPreview(m: Medication, draft: ResponseDraft): {text: string; invalid: boolean} {
  try {
    const r = previewMedication(m, commitResponse(m, draft));
    if (r.responseStatus === 'unanswered') return {text: 'No response entered. Nothing is counted as zero.', invalid: false};
    if (r.responseStatus === 'no_use') return {text: r.scope === 'included' ? 'Confirmed no use = 0 MME.' : `${m.route === 'injection' ? 'No dose administered' : 'Confirmed no use'} = 0 reported quantity. No MME conversion.`, invalid: false};
    if (r.status === 'needs_review') return {text: `${reasonLabel(r.reason)}. Research MME is unavailable.`, invalid: false};
    if (r.doseBasis === null) return {text: `Reported dose is unknown. ${r.scope === 'buprenorphine' ? 'Buprenorphine stays separate from MME.' : reasonLabel(r.reason) + '.'}`, invalid: false};
    const unit = m.route === 'injection' && m.quantityUnit === 'units' ? 'injection(s)' : m.quantityUnit;
    const strengthUnit = m.route === 'injection' && m.strengthUnit === 'mg/unit' ? 'mg/injection' : m.strengthUnit;
    const dose = `${number(r.doseBasis)} ${r.doseBasisUnit}`;
    const equation = m.quantityUnit === 'mg' ? dose : `${number(r.quantity!)} ${unit} × ${number(r.effectiveStrength!)} ${strengthUnit} = ${dose}`;
    if (r.mme !== null) return {text: `${equation}. ${m.genericName === 'fentanyl' ? 'Confirmed 24-hour wear. ' : ''}${number(r.doseBasis)} × ${number(r.factor!)} = ${number(r.mme)} research MME.`, invalid: false};
    return {text: `${equation}. ${r.scope === 'buprenorphine' ? 'Buprenorphine recorded separately; no MME conversion.' : reasonLabel(r.reason) + '.'}`, invalid: false};
  } catch (error) {
    return {text: error instanceof Error ? error.message : 'Check the entered dose.', invalid: true};
  }
}
