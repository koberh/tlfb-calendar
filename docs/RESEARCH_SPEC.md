# Research data and calculation specification

Implementation policy: `tlfb-mme-policy-2` (2026-09-30). Session format: version 2.
These rules are implementation decisions unless explicitly attributed below.

## Reference and scope

Use a frozen copy of the CDC 2022 pain-management conversion table, with a table
ID, publication date, retrieval date, source URL and snapshot stored in the
session. Never silently substitute older factors or accept edited factors.
Sources:

- https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm#T1_down
- https://archive.cdc.gov/www_cdc_gov/opioids/data-resources/index.html

The pinned factors are codeine 0.15, hydrocodone 1, hydromorphone 5, methadone 4.7,
morphine 1, oxycodone 1.5, oxymorphone 3, tapentadol 0.4, tramadol 0.2, and
transdermal fentanyl 2.4 (mcg/hr input). The older dose-tier methadone table is
not part of this policy. Buprenorphine has no factor here and is recorded
separately. MME is an estimate, not a drug-switching or prescribing instruction;
the CDC table does not establish equivalent overdose risk for all drugs.

### Optional reference: NIH HEAL Initiative MME mapping table

Selectable per interview (reference `nih-heal-2025-table-1`, policy `tlfb-mme-heal-policy-1`;
source https://pmc.ncbi.nlm.nih.gov/articles/PMC12266977/, Table 1). Oral factors: butorphanol 7,
codeine 0.15, dihydrocodeine 0.25, hydrocodone 1, hydromorphone 5, levorphanol 11, meperidine 0.1,
methadone 4.7, morphine 1, opium 1, oxycodone 1.5, oxymorphone 3, pentazocine 0.37, tapentadol 0.3,
tramadol 0.2 (long-acting forms share these factors); fentanyl patch 2.4 per mcg/hr; buprenorphine
sublingual 38.8 per mg, buccal film 0.039 per mcg, patch 2.2 per mcg/hr. HEAL's nonpatch fentanyl
factors (buccal, lozenge, nasal) are not implemented; those entries remain excluded.

Study convention for buprenorphine under HEAL: indication **pain** enters MME; indication **OUD** is
kept out of all MME totals and reported as a separate per-medication MME subtotal (full-window only
when every day is answered); other/unknown indications need review. Buprenorphine routes without a
HEAL factor (injection, pump) remain separate without MME.

Application choices beyond the reference table:

- Oral tablets, capsules, liquid, and explicitly reported oral mg are supported
  for the nine listed oral drugs. Only the opioid ingredient strength is used.
- Oral methadone with a pain or OUD indication uses the same pinned 4.7 factor.
  Including OUD methadone is the requested research convention, not a CDC clinical
  recommendation for OUD dosing. Other or unknown indications still require review.
  Preserve the recorded indication and actual reported dose, including liquid
  concentration, amount consumed and date-specific strength changes. Do not assume
  the prescribed amount was taken. This changes application policy 1, which withheld
  MME for OUD; the reference table and conversion factors themselves are unchanged.
- Fentanyl support is limited to patches with documented whole-day use. Record
  the number of patches concurrently worn, not patches newly applied that day.
  Reported hours must equal 24. Partial-day/uncertain wear is retained and flagged
  for review; do not prorate or infer wear from replacement schedules.
- Pumps, injections, nonpatch fentanyl, unknown-strength illicit products, and
  drugs absent from the chosen reference (under CDC, including levorphanol and dihydrocodeine) are
  retained but excluded with a reason. No guessed factors or brand-name inference.
- Under CDC, buprenorphine is separate regardless of formulation; it never enters MME.
  Under NIH HEAL, see the buprenorphine convention above.

## Importing earlier policies

Exact, unaltered policy-1 reference snapshots are recognized on file import and
upgraded to policy 2 after validating the session. The UI discloses recalculation,
keeps the reported data and indication, and marks the session unsaved. The original
file is untouched. Save a new copy and regenerate exports; earlier app versions
will not accept the new policy. Altered factors, unknown policies and malformed
records remain rejected. Version-1 interviews use the current policy on migration.

## Version-2 record

Preserve the version-1 fields: participantId, assessor, assessmentDate, recallDays,
substances, responses, notes. Add appointment, medications, medicationResponses,
and a calculation reference snapshot. A version-1 import gets appointment
`unspecified`, no medications, and an explicit migration notice. Existing
substance entries remain untouched and must be deliberately mapped in the UI.

Appointment code is baseline, month_1, month_3, month_6, custom, or unspecified.
Store the human label too. Metadata may be edited without clearing observations.

Medication records have a stable unique ID, display name, generic name, route,
formulation, indication, strength, strength unit and quantity unit. Multiple
records can share a generic name (e.g. different strengths). A combination product
stores only the opioid ingredient strength. Quantity units never imply dosing
frequency: daily input is the total actually taken that date.

Each date/medication response is either absent/unanswered, explicit no_use, or
use. A use response may retain an unknown quantity (`null`) and is then answered
but not calculable. An optional positive strength override records a dated
strength change. Multiple strengths on the same day use separate medication
records. Zero use needs no dose/strength estimate. All configured medication
records are expected on every recall day; there is no inferred start/stop date.

Only input records and the reference snapshot are saved, not mutable calculated
totals. Recalculate from validated inputs. Reject unknown versions, unknown
fields, invalid IDs/keys, altered reference factors, out-of-window dates,
nonfinite/negative values and incompatible units. This avoids silently dropping
data from a future session format. Saving a migrated session does not overwrite
the original unless the researcher explicitly chooses its path later in the UI.

## Calculation and missingness

Oral MME = reported daily quantity x opioid strength per unit x pinned factor.
If quantity is directly mg, use reported mg x factor, without a second strength
multiplier. Oral liquids use mg/mL x mL. No rounding of intermediate calculations.
Fentanyl patch MME/day = mcg/hr per patch x concurrent patch count x 2.4 for a
documented 24-hour day; do not multiply by 24 or divide by replacement interval.

An included medication yields zero only for an explicit no_use response.
Unanswered and review-required results are null. Excluded/BUP entries have null
MME even when their raw response is no use; they are not converted to numeric zero.

**Scope:** totals refer to the included opioid subset under this policy. Every
export identifies that scope, exclusions and review counts. Never label a subset
as total exposure to every opioid. A supported medication with unknown dose or
methadone requiring indication review remains expected and prevents a complete
included-opioid daily total. Excluded drugs and BUP do not enter this denominator.

**Complete/calculable day:** every included medication has either an explicit
zero or a calculable positive dose. Unrelated nonopioid responses do not determine
MME completeness. If no included medications are configured, MME is not applicable
and all MME aggregates are null, not an inferred zero-exposure window.

| Metric | Exact meaning |
| --- | --- |
| Daily MME | Sum of all included medications on a complete day; otherwise null |
| Recorded component subtotal | Sum of calculable components, including those on incomplete days; null when none exist |
| Complete-day total | Sum of fully calculable daily MME values; null when no day is calculable |
| Full-window total | Available only when every recall day is fully calculable |
| Average across all recall days | Full-window total / recallDays; unavailable on incomplete windows |
| Average across answered days | Complete-day total / fully calculable days; excludes any day with a missing/uncalculable included medication |
| Observed maximum daily MME | Maximum among fully calculable days; explicitly observed when other days are incomplete |
| Full-window maximum | Available only when every recall day is fully calculable |

Also report days with all included medication responses recorded (may still lack
strength/quantity), fully calculable days, incomplete days, positive-use days and
confirmed-zero days among calculable days. Unknown quantity is not zero.

The two averages coincide for a complete window. They are not alternative ways
to impute missing values. No extrapolated or zero-imputed full-window statistic.

## Monthly summaries

Group actual recall dates by YYYY-MM. Apply the same rules within each group's
intersection with the recall window. Include start/end and days-in-scope. A
10-day intersection is a 10-day denominator, not 30 or 31. A 30-day TLFB may span
two months; the full 30-day average is the window statistic, not a calendar-month
statistic. Report MME/day for averages, and cumulative MME for totals.

## Buprenorphine and exclusions

Retain raw use/no-use/unknown responses, quantities, units, dates and strengths in
the medication export. Summarize buprenorphine per medication record (no mixing
units or formulations). Show answered/missing/use/no-use counts and an observed
quantity total/mean only when all recorded positive responses have known quantity.
No `with BUP MME` output is created.

Injection setup supports mg per injection plus the reported number administered
on each date, or direct mg on the administration date. A 300 mg monthly injection
reported once contributes 300 mg once; no daily exposure or 30-day allocation is
inferred. A no-use response for an injection means no administration on that date,
not absence of medication effect. Pump quantities mean actual delivery on that
date, in direct mg or reported mL with known mg/mL; reservoir/refill loads are not
substituted for delivered dose. Unknown delivery remains unknown.

Separate dose reporting preserves mg for BUP and excluded drugs where units and
strength permit: `dose_basis` in medication/combined daily exports, with `mg` for
injections or `mg/day` for other delivery. This never assigns MME. BUP summaries
add route, dose-recording basis, unknown-dose days and total reported dose in mg.
The observed mg total is blank if any reported administration/use has an unknown
dose; unanswered days remain explicitly counted. No inference is made for missing
days. Counts of injection days are administration days, not duration of effect.

## Exports and future UI contract

- Combined daily CSV (`tlfb-combined-daily-1`): one row per recall date, strict
  daily MME/subtotal and completeness plus each medication's raw/effective dose
  fields, eligibility and MME, each substance's value/status/units, and event note.
  No repeated daily MME across substance rows. BUP/excluded medication MME stays blank.
- Combined summary CSV (`tlfb-combined-summary-2`): one row per interview; full-window
  MME metrics, separate column groups for each intersecting calendar month, substance
  counts/quantities, and separate BUP quantities. Denominators follow existing rules.
- Wide combined exports use numbered column groups in setup order with explicit
  identifiers/names/units. Names need not be valid CSV identifiers; same medication
  display names do not collide. Align groups by included identifiers across files,
  not solely by column position. Unavailable numeric values remain blank.

- Existing general substance exports remain available.
- Medication CSV: one row per recall date and medication, including unanswered,
  reported values, effective strength, factor, source, policy, dose basis,
  calculation status, exclusion reason and calculated MME (blank when unavailable).
- Daily MME CSV: one row per date, strict daily total and recorded subtotal,
  response/calculation completeness, review and exclusion counts.
- MME summary CSV: full-window row plus calendar-month rows, both denominator
  counts, complete/observed totals, observed/full maximum and scoped averages.
- General version-2 substance exports include appointment identity too.
- CSV fields are escaped and spreadsheet formula-like text neutralized. JSON
  preserves literal original text. No automatic upload or REDCap field mapping.

## Synthetic verification examples

- Seven days of oxycodone 5 mg: one tablet on five weekdays and two on two weekend
  days -> 67.5 cumulative MME, 67.5/7 MME/day, maximum 15 MME/day.
- One day includes oxycodone and morphine, but morphine is unanswered -> strict
  daily MME null, recorded oxycodone subtotal visible, day excluded from mean.
- Entirely unanswered window -> all MME totals/means/maxima null, not zero.
- All included medications explicitly no_use -> zero daily MME and averages.
- BUP-only interview -> BUP response summary, MME not applicable.
- A mixed supported/injection interview -> supported-subset metrics plus explicit
  injection exclusion counts; no claim that this covers all opioid exposure.

## Before research release

Study review of this declared method, end-to-end UI tests, packaged offline
network tests and clean-machine installation remain required. The engine's unit
tests are not validation of the whole application or approval for clinical use.
