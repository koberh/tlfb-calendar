# TLFB Calendar

An interviewer-facing Timeline Followback workspace by Kobe Hanson, with an offline
Windows desktop edition. Record daily substance use, medication quantities and
event notes; review completeness; export research data.

## Use the Windows app

Install `TLFB-Calendar-0.1.4-Windows-x64-Setup.exe` from the local `release` folder.
Open **TLFB Calendar** from its desktop or Start Menu icon. Python, Node.js, a
terminal, an account, and internet access are not needed after installation.
The installer is currently unsigned. Institution-managed computers may require IT
approval; do not bypass your institution's installation policy.

- [Staff quick start](docs/STAFF_GUIDE.md)
- [Offline design and verification](docs/OFFLINE_REVIEW.md)
- [Research calculation specification](docs/RESEARCH_SPEC.md)
- [Ordered project plan](docs/IMPLEMENTATION_PLAN.md)
- [Current status and remaining release gates](docs/PROGRESS.md)

This is a testable research prototype, not yet an institution-approved production
release. Use synthetic data until study methods, storage policy, and deployment
have been reviewed. The older hosted prototype is separate from this desktop
build; it has not been redeployed.

## Features

- Assessment date, 1–90 recall days (assessment day excluded), assessor and visit name.
- Baseline, 1-, 3-, and 6-month visits, plus custom appointment labels.
- Up to 30 medication records and 12 other substances, with explicit units.
- Oral tablet, capsule, liquid and direct-mg entry; documented fentanyl patch wear.
- Daily strength overrides; unknown quantity/strength preserved for review.
- Weekday/weekend/manual date selection, overwrite confirmation and event notes.
- Distinct confirmed zero, reported use, partial, unanswered and outside-window days.
- Total, maximum and daily-average MME; calendar-month summaries within the recall interval.
- Buprenorphine quantities reported separately; injections, pumps and unsupported routes excluded from MME.
- Native local JSON session save/open, combined daily/summary CSVs and six detailed CSV exports.
- Live dose/MME previews, last-save time and filename, optional local autosave.
- Undo the last applied day, bulk-entry/clearing or settings change.
- Version-1 session import without guessing opioid identities or converting old free text.

## Data handling

The desktop app loads bundled files with Electron. It does not run a localhost
server or include an AI client, automatic upload, telemetry, cloud database,
automatic recovery file, or updater. Remote requests, navigation, popups and
permissions are blocked. Interview state stays in memory until explicitly saved/exported or saved by
local autosave after the researcher enables it and chooses a file. Native file dialogs select destinations. JSON/CSV files contain the
entered data, including notes; they are not encrypted by the app. A chosen folder
may itself be cloud-synced by Windows/OneDrive, so use approved storage.

Save day updates the open interview. Save session writes the resumable file.
Optional autosave writes applied changes after a short delay to the chosen file.
Unapplied day/settings drafts are not autosaved. Autosave starts off for every
new/opened interview; its chosen path is kept only in the main-process memory.
Canceled or failed saves do not mark an interview saved. Individual CSV exports do not replace a
session backup; Save export folder also includes a resumable JSON copy. Sudden shutdown can lose changes that have not been saved.

REDCap remains a separate downstream workflow. There is no REDCap API or embedded
REDCap instrument. The original workbook and participant data are not distributed.

## Research definitions

The fixed reference is the [CDC 2022 conversion table](https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm#T1_down),
stored with a separate application policy version. MME is research output, not a
prescribing or opioid-rotation recommendation. See the specification for factors
and exceptions.

All-days averages, full-period totals and maxima require every included-opioid
day to be calculable. Answered-day averages use only fully calculable days;
reported use of unknown quantity is recorded but excluded from that denominator.
Confirmed zero-use days count as zero. Incomplete periods show explicitly labeled
observed values/subtotals. No included opioid means MME is not applicable.

Calendar status includes every medication and substance, independently of MME
eligibility. Monthly results use only recall dates within each calendar month.
Values are not extrapolated to 30 days. Buprenorphine is never assigned an MME
factor; oral methadone for pain or OUD uses 4.7; fentanyl requires confirmed 24-hour
concurrent patch wear. Different units are never added together.

Version 0.1.2 includes OUD methadone under research policy 2, accepts mg per injection
(e.g., one reported 300 mg Sublocade administration), and records pump delivery.
BUP remains outside MME; its reported dose in mg is included in summaries/exports.
Older policy-1 sessions display an upgrade notice and keep their reported data.
Save a new session copy and regenerate CSVs; previous versions cannot open policy 2.

Version 0.1.3 adds calculation previews using the same engine as exports, a last-save
indicator, optional local autosave and one-step undo. Calculation policy 2 and the
session/CSV formats are unchanged. Undo history stays in memory and resets when
an interview is opened/replaced; saving/exporting does not erase it.

Version 0.1.4 adds an interview review with date links, optional medication detail,
follow-up setup copying, date-range selection, a three-file export folder and a
printable summary. The calendar keeps its existing styling; additional tables
and individual exports are collapsed until needed. BUP and pump doses stay optional.
Session version 2 and MME policy 2 are unchanged. Combined summary CSV schema 3
adds per-medication contributions and a separately labeled OUD-methadone subtotal.

## Export files

**Save export folder** writes a new folder containing the session JSON, combined daily CSV
and combined summary CSV. Names share the participant, visit and assessment date;
repeated exports get distinct folders. **Print summary** opens the native print
dialog with a compact report including notes. Printing does not save the session.

For MME and other substances together, use **Summary & exports → Individual CSV files → Combined daily CSV**
(one row per date) or **Combined summary CSV** (one row per interview with window/month
MME statistics and each substance's use/missing/zero days and reported quantities).
Both retain explicit missingness and separate buprenorphine from MME. Numbered
medication/substance column groups follow interview setup order and include IDs,
names and units; use those identifiers when combining files from different setups.

The UI offers substance daily/summary, medication daily, MME daily/summary and
buprenorphine CSVs. Each includes appointment metadata and explicit missingness;
MME exports carry reference/policy identifiers. Medication rows preserve raw
quantity, units, effective strength, overrides, patch hours, factors and reasons
for exclusions/review. Formula-like CSV text is neutralized for spreadsheets.
CSV values retain calculation precision; the screen rounds to two decimal places.
JSON contains the versioned reference snapshot and reopens the whole interview.

Settings preserve compatible responses on overlapping dates. Changing measurement
definitions or removing populated dates/items requires confirmation before those
responses are cleared. Use per-day strength overrides for dose changes.

## Build or replicate from source

Requires Node.js 22.18+ (tested with 24.18) and npm. Internet is needed to acquire
development dependencies and packaging tools, not to run the installed app.

```sh
npm ci
npm run desktop
```

On Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked by execution policy.
If your npm install-script policy skipped Electron's binary installer, review and
allow the Electron installation script before building.

```sh
npm test
npm run typecheck
npm run lint
npm run build:desktop
npm run test:desktop
npm run package:windows
```

The installer is written to `release/`. No publish step is run. Updates are manual:
save sessions, close the app, install a reviewed new version, then reopen sessions.
Regenerating the checked-in icon uses `python desktop/make-icon.py` and Pillow;
ordinary builds do not require Python.

The original `npm run dev` / `npm run build` remain the browser development path.
The desktop uses `vite.desktop.config.ts`; it does not import Sites/Cloudflare,
the hosted layout, authentication helpers, or server entry points. Packaging uses
an explicit file allowlist. Only synthetic fixtures belong in this repository.

## Code map

- `app/`: calendar, setup, response controls and research summary.
- `lib/research-session.ts`: validation and legacy migration.
- `lib/mme.ts`, `lib/mme-reference.ts`: pure calculations and pinned factors.
- `lib/research-exports.ts`: generic research CSVs.
- `lib/workspace.ts`: editing, response preservation and completeness rules.
- `desktop/`: static renderer, sandboxed shell, preload and file policy.
- `tests/`: synthetic domain and running-desktop acceptance checks.

MIT license. See [LICENSE](LICENSE).
