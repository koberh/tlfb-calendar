/** Frozen research references. Changing factors requires a new reference/policy ID. */
export const CDC_REFERENCE = Object.freeze({
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
  }) as Readonly<Record<string, number>>,
});

/**
 * NIH HEAL Initiative MME mapping table (Table 1). Oral formulations unless named otherwise;
 * long-acting forms share the immediate-release factor. Buprenorphine factors are per mg
 * (sublingual), per mcg (buccal film) and per mcg/hr (patch).
 */
export const HEAL_REFERENCE = Object.freeze({
  id: 'nih-heal-2025-table-1',
  policyId: 'tlfb-mme-heal-policy-1',
  title: 'NIH HEAL Initiative MME mapping table (research use)',
  sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12266977/',
  published: '2025',
  retrieved: '2026-10-01',
  factors: Object.freeze({
    butorphanol: 7,
    codeine: 0.15,
    dihydrocodeine: 0.25,
    hydrocodone: 1,
    hydromorphone: 5,
    levorphanol: 11,
    meperidine: 0.1,
    methadone: 4.7,
    morphine: 1,
    opium: 1,
    oxycodone: 1.5,
    oxymorphone: 3,
    pentazocine: 0.37,
    tapentadol: 0.3,
    tramadol: 0.2,
    fentanyl_transdermal: 2.4,
    buprenorphine_sublingual: 38.8,
    buprenorphine_buccal: 0.039,
    buprenorphine_transdermal: 2.2,
  }) as Readonly<Record<string, number>>,
});

export const REFERENCES = Object.freeze([CDC_REFERENCE, HEAL_REFERENCE]);
/** Default reference for new sessions and the one older sessions were created with. */
export const MME_REFERENCE = CDC_REFERENCE;

export type ReferenceSnapshot = {
  id: string; policyId: string; title: string; sourceUrl: string; published: string; retrieved: string;
  factors: Readonly<Record<string, number>>;
};

export function referenceSnapshot(id: string = CDC_REFERENCE.id): ReferenceSnapshot {
  const reference = REFERENCES.find(r => r.id === id);
  if (!reference) throw new Error('Unknown MME reference.');
  return structuredClone(reference) as ReferenceSnapshot;
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
  return equal(value, { ...CDC_REFERENCE, policyId: 'tlfb-mme-policy-1' });
}

export function assertReference(value: unknown): asserts value is ReferenceSnapshot {
  if (!REFERENCES.some(r => equal(value, r))) {
    throw new Error('Unknown or altered MME reference. Do not recalculate with substituted factors.');
  }
}

export const usesHeal = (reference: { id: string }) => reference.id === HEAL_REFERENCE.id;
