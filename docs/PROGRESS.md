# Progress and model handoff

## Current milestone

Astra steps 1 and 2: specification and calculation foundation implemented.
The version-1 calendar and hosted prototype have not been modified or redeployed.
The new engine is not yet exposed in the UI. A desktop installer is not yet built.

## Verification completed on 2026-09-27

- `npm test`: 34 passing tests (27 new research tests and 7 original tests).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed for the existing browser prototype. This is a
  compatibility check, not a desktop/offline acceptance test. The build reports
  its existing unknown route-classification informational message.
- The oxycodone weekday/weekend example, reference examples, partial-day
  denominators, BUP separation, excluded routes, migration, month boundaries,
  malformed inputs and CSV handling are covered by synthetic tests.
- No browser interaction or installed-desktop test was performed at this stage.

## Completed work

- Saved the complete model-by-model roadmap in IMPLEMENTATION_PLAN.md.
- Recorded exact measurement/denominator rules in RESEARCH_SPEC.md.
- Added a frozen CDC 2022 reference plus application policy snapshot.
- Added version-2 appointment and medication records, strict import validation,
  source-factor validation, and loss-aware migration of version-1 sessions.
- Added pure medication/day/window/month calculations, explicit exclusions,
  separate BUP quantities and missing-vs-zero handling.
- Added six generic CSV writers with appointment context and source provenance.
- Added synthetic regression tests; original tests remain included.

## Files and interfaces for Sol

| Module | Entry points |
| --- | --- |
| `lib/research-session.ts` | `createResearchSession(date)` creates an incomplete setup draft; `validateResearchSession`, `readResearchSession`, `writeResearchSession`, `migrateInterview` |
| `lib/mme-reference.ts` | Frozen `MME_REFERENCE`, `referenceSnapshot`; do not edit in a session |
| `lib/mme.ts` | `calculateMme(session)`, `medicationEligibility(medication)` |
| `lib/research-exports.ts` | `medicationCsv`, `dailyMmeCsv`, `mmeSummaryCsv`, `buprenorphineCsv`, `researchSubstanceCsv`, `researchSubstanceSummaryCsv` |

Run `calculateMme` only on a validated, saved-in-memory interview, not a partial
setup draft. The return value contains medicationRows, daily, window, months,
excluded and buprenorphine. It has no I/O and does not mutate the session.

The JSON reader returns `{session, notices}`. Display notices after migration.
The current UI still imports `parseInterview` (version 1 only); replace this
explicitly when wiring version 2. Do not pass version-2 files through the old
parser or overwrite a legacy file during migration. The current session size
limit remains 2 MB. Medication entries use date|medicationId keys, matching the
existing general-substance key convention but in a separate dictionary.

## UI work next

1. Connect version-2 sessions and migration notices.
2. Add appointment presets/custom field and preserve labels in exports.
3. Remove the introductory slogan, headline and description.
4. Add explicit generic medication/formulation/route/indication/units/strength.
   Do not infer medication identity from free text. Unknown strength may be saved.
5. Connect daily medication responses and per-day strength overrides. A positive
   use response may have `quantity:null`; show it as requiring clarification.
   No-use is `{status:'no_use'}`; an absent key is unanswered.
6. Add weekday/weekend date selection inside the actual recall window.
7. Display denominators, exclusion/review reasons, separate BUP quantities, and
   observed vs full-period totals/maxima. Null is an unavailable result, never 0.
8. Use the new export functions, including the literal snapshot in JSON.

## Research decisions visible to users/reviewers

- All-days average is unavailable until every included-opioid day is calculable.
- Answered-days denominator means fully calculable included-opioid days, not
  days with merely one response or a use response of unknown quantity.
- Partial-day component subtotals cannot become daily totals or enter the mean.
- Full-period total/max are null while incomplete; observed values remain labeled.
- Calendar-month averages use only the recall dates in that month.
- BUP and unsupported routes do not enter included-opioid MME; exports state scope.
- No included medication means MME not applicable, not assumed abstinence.
- The selected reference does not contain every possible opioid. Missing factors
  remain explicit exclusions; do not import old factors to fill gaps.
- Methadone conversion is enabled for pain indication only under this first
  software policy. Other indications require a study-specific method decision.
- Fentanyl patch calculation requires documented 24-hour concurrent wear; no
  patch-change frequency conversion or partial-day extrapolation.

## Remaining release work

UI integration, actual browser interaction tests, desktop packaging, network-
disabled runtime verification, installer testing on a clean Windows machine,
and institutional method/privacy review have not been completed. No claim of
production research validation or HIPAA certification follows from unit tests.
Use synthetic data for continued development.
