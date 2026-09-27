import { referenceSnapshot } from '../lib/mme-reference.ts';

export function medication(overrides = {}) {
  return {
    id: 'oxy-5', name: 'Oxycodone 5 mg', genericName: 'oxycodone',
    route: 'oral', formulation: 'tablet', indication: 'pain',
    strength: 5, strengthUnit: 'mg/unit', quantityUnit: 'tablets', ...overrides,
  };
}

export function session(overrides = {}) {
  return {
    version: 2, participantId: 'SYNTHETIC-001', assessor: 'Demo assessor',
    assessmentDate: '2026-09-28', recallDays: 7,
    appointment: { code: 'baseline', label: 'Baseline' },
    substances: [], responses: {}, notes: {},
    medications: [medication()], medicationResponses: {},
    reference: referenceSnapshot(), ...overrides,
  };
}

export const noUse = () => ({ status: 'no_use' });
export const use = (quantity, extra = {}) => ({ status: 'use', quantity, ...extra });
