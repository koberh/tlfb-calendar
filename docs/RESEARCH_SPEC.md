# Research data and calculation specification

Implementation policy: `tlfb-mme-policy-1`. Session format: version 2.
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

Application choices beyond the reference table:

- Oral tablets, capsules, liquid, and explicitly reported oral mg are supported
  for the nine listed oral drugs. Only the opioid ingredient strength is used.
- Methadone with an explicitly recorded pain indication uses the pinned factor.
  OUD, other, or unknown indication requires review and returns no MME. This is a
  conservative software boundary, not a claim that research can never study OUD
  methadone exposure. A future study policy would require a new policy version.
- Fentanyl support is limited to patches with documented whole-day use. Record
  the number of patches concurrently worn, not patches newly applied that day.
  Reported hours must equal 24. Partial-day/uncertain wear is retained and flagged
  for review; do not prorate or infer wear from replacement schedules.
- Pumps, injections, nonpatch fentanyl, unknown-strength illicit products, and
  drugs absent from the reference (including levorphanol and dihydrocodeine) are
  retained but excluded with a reason. No guessed factors or brand-name inference.
- Buprenorphine is separate regardless of formulation; it never enters MME.

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

## Exports and future UI contract

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
