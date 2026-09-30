/** Frozen research reference. Changing factors requires a new reference/policy ID. */
export const MME_REFERENCE = Object.freeze({
  id: 'cdc-2022-table-1',
  policyId: 'tlfb-mme-policy-2',
  title: 'CDC 2022 opioid pain-management MME conversion table',
  sourceUrl: 'https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm#T1_down',
  published: '2022-11-04',
  retrieved: '2026-09-27',
  factors: Object.freeze({
    codeine: 0.15,
    hydrocodone: 1,
    hydromorphone: 5,
    methadone: 4.7,
    morphine: 1,
    oxycodone: 1.5,
    oxymorphone: 3,
    tapentadol: 0.4,
    tramadol: 0.2,
    fentanyl_transdermal: 2.4,
  }),
});

export type ReferenceSnapshot = typeof MME_REFERENCE;

export function referenceSnapshot(): ReferenceSnapshot {
  return structuredClone(MME_REFERENCE);
}

function equal(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const x = a as Record<string, unknown>;
    const y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length &&
      Object.keys(y).every(key => Object.hasOwn(x, key) && equal(x[key], y[key]));
}

/** Recognize the exact previous snapshot before upgrading its calculation policy. */
export function isLegacyReference(value: unknown): boolean {
  return equal(value, { ...MME_REFERENCE, policyId: 'tlfb-mme-policy-1' });
}

export function assertReference(value: unknown): asserts value is ReferenceSnapshot {
  if (!equal(value, MME_REFERENCE)) {
    throw new Error('Unknown or altered MME reference. Do not recalculate with substituted factors.');
  }
}
