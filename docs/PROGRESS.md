# Current handoff - 2026-09-30

## Version 0.1.4: friendly interview tools

- Review interview lists unanswered items and MME review reasons, with links back
  to each date. Optional BUP/pump amounts never create review tasks.
- By medication shows use/no-use/missing days, unknown amounts, recorded quantities,
  known dose ranges and MME contributions. An OUD-methadone subtotal is explicitly
  part of overall MME; BUP remains separate. Missingness is never filled with zero.
- More options > Start follow-up copies participant and item setup into a new draft.
  Date/visit/assessor can be confirmed; prior daily data and notes are never copied.
  Autosave and undo reset at the interview boundary.
- Multi-select offers an inclusive date range plus a selected-date/overwrite preview.
  Existing bulk confirmations, other-item preservation and one-step undo apply.
- Save export folder uses one native directory selection to save a JSON session and
  both combined CSVs into a fresh folder. Staging/finalization prevents incomplete
  bundles appearing as successful exports. Failure/cancel preserves unsaved state.
- Print summary exposes only an applied-session report, including notes. Printing
  opens a visible native dialog and does not mark the interview saved.
- More options, medication/month tables, individual CSV buttons and reference
  detail use disclosures. The existing calendar styling is preserved. The user's
  ongoing preference for simple, friendly presentation is in IMPLEMENTATION_PLAN.md.
- Session version 2, calculation policy 2 and daily CSV formats are unchanged.
  Combined summary CSV schema 3 adds medication and OUD-methadone summary fields.

Validation: 70 automated tests, TypeScript, ESLint and desktop build pass. All 26
source Electron checks pass with isolated synthetic profiles. These cover the new
workflows, unknown-dose handling, cancellation/failure recovery and existing offline
controls. Calendar/review/summary screenshots were inspected; a one-page synthetic
printed PDF was rendered and visually checked. Printer delivery is not tested.
The Windows installer is built and all 26 checks also pass against the packaged
executable. Installer: `release/TLFB-Calendar-0.1.4-Windows-x64-Setup.exe`.
SHA-256: `BC161DC93C6E63F7B25091E95D5CDED92160167DC58C397AE33C6448B4FA81D9`.
The user requested installation after closing TLFB. The installer checksum was
verified, installation completed with exit code 0, and the installed executable
reports version 0.1.4. All 26 acceptance checks passed against the installed copy
using an isolated synthetic profile. Report: test-results/installed-0.1.4-report.json.
No participant files or researcher window contents were read.

# Previous handoff - 2026-09-30

## Version 0.1.3: calculation previews, saving and undo

- Daily and bulk medication entry show live calculation previews from the same
  validated engine as saved results, including liquids, direct mg, overrides,
  patches and separately reported injection/pump doses. Unknown stays unknown.
- The saving panel distinguishes unapplied edits from applied changes needing
  a file save, and shows the last successful save time and filename. Canceled or
  failed saves and CSV exports do not mark new interview changes as saved.
- Local autosave is optional and off by default. A native Save dialog selects
  the file; only applied interview changes are written after a short pause.
  The target is kept in main-process memory and accessed with an opaque token.
  New/opened interviews turn autosave off; failed writes pause it visibly.
- One-step Undo restores the last applied day, bulk entry/clear or settings
  change, including removed records and notes. Undo resets on interview replacement;
  saved/exported data does not erase the in-memory undo point. Enabled autosave
  writes the restored version to its chosen file after undo.
- Calculation policy 2, optional BUP/pump fields and session/CSV formats are unchanged.

Validation so far: 63 automated tests, TypeScript and ESLint pass. All 21 source
Electron acceptance checks pass using isolated synthetic profiles, including
cancel/failure recovery, no autosave of unfinished drafts, undo of saved changes,
interview boundaries, previews and the existing offline controls. Screenshots of
previews and the saving panel were inspected. All 21 checks also pass against the
packaged executable and the installed copy. Installation completed with exit code 0;
the installed executable reports 0.1.3. The existing desktop/Start Menu shortcut
opens the updated app. Autosave remains off until the researcher enables it.
Installer: `release/TLFB-Calendar-0.1.3-Windows-x64-Setup.exe` (unsigned).
SHA-256: `7B79342F5168F5536E01E78E7C74D683CCD4F9ABA8C8B546A3E48E40C43B287E`.

No participant files or researcher windows were read. The installed app was closed
at the pre-install check. No GitHub or hosted publication was performed.

# Previous handoff - 2026-09-30

## Version 0.1.2: OUD methadone and injection/pump doses

- Oral methadone for pain or OUD now uses the same 4.7 factor under
  `tlfb-mme-policy-2`. Other/unknown indications still require review.
- Exact policy-1 sessions import with a recalculation notice; reported data is
  preserved, the session is marked unsaved, and the original file is untouched.
  Save a new copy and regenerate CSVs. Previous app versions reject policy 2.
- Correcting an indication preserves existing dose responses.
- Injection setup exposes optional mg per injection and an administration-date
  count, plus direct-mg entry. One monthly Sublocade 300 mg injection records
  300 mg once, without allocating it over subsequent days or creating BUP MME.
- Pumps record optional actual daily delivery in mg or mL with known mg/mL.
  Reservoir/refill quantities are not treated as delivered doses. Blank is unknown.
- BUP summaries/exports include route, dose-recording basis, unknown-dose days and
  reported mg totals. Medication/combined daily exports include recorded dose for
  BUP and excluded routes without MME. Combined summary schema is now version 2.
- No participant files or open researcher windows were read during development.

Validation: 58 automated tests, TypeScript, ESLint and desktop build pass.
All 16 running-desktop checks pass against source, packaged and installed copies,
using isolated synthetic profiles. These include policy migration, indication
correction, OUD exports/save/reopen, optional dose handling, injection UI and
300 mg export, pump delivery, and the existing offline controls. Setup/entry/summary
screenshots were inspected. The sandbox could not launch Electron or download
packaging tools; the successful runs used desktop/network access for those tasks.

Installer: `release/TLFB-Calendar-0.1.2-Windows-x64-Setup.exe` (unsigned).
SHA-256: `0A9B5D40F614C8593E6BEAFD72343E80E8F8B68030153AF7B57F87ADB4757303`.
After the user saved and closed TLFB, the installer completed with exit code 0.
The installed executable reports version 0.1.2 and passes the 16 synthetic checks.
The user can reopen the app from the existing shortcut and load their saved file.
Clean-machine and institutional release gates remain unchanged.
Source changes are local and uncommitted; no hosting/GitHub publication was done.

# Previous handoff — 2026-09-27

## Version 0.1.1: combined exports

Added Combined daily CSV (one date per row) and Combined summary CSV (one interview
per row with calendar-month MME column groups), joining MME and other substances.
Includes explicit missingness, units/IDs and separate BUP values. Session format
and calculation rules are unchanged. 48 unit tests, TypeScript and ESLint pass.
All 13 packaged desktop checks pass, including actual combined CSV downloads,
in an isolated synthetic profile. The previous installed version is left running.
This update is packaged separately as `TLFB-Calendar-0.1.1-Windows-x64-Setup.exe`.
The open installed interview is not closed or inspected; save and close it before
installing the update. Desktop automation now uses a fresh isolated profile to
avoid interacting with an open researcher's window.

## Version 0.1.0 baseline

The research UI is connected and the offline Electron shell is implemented.
A Windows x64 installer has been built and installed for the current Windows user.
Desktop and Start Menu shortcuts were verified. The packaged and installed copies
both pass the synthetic acceptance checks. No terminal/Python is needed for normal use.
No hosted deployment or GitHub publication has been performed in this phase.

## Astra review corrections

- Removed assumed patch wear and medication-strength/indication defaults.
- Preserved day-specific strength and patch-hour values during note edits.
- Calendar use/completeness now considers all configured items, including BUP,
  other substances and excluded routes, independently of MME calculability.
- Guarded unsaved day/settings changes, session replacement, bulk overwrites and close.
- Restored substance additions, units/formulation/route controls, dose changes,
  explicit unknowns, excluded/review reasons and nonopioid summaries.
- Retained compatible overlapping responses on settings edits; confirmation is
  required before clearing redefined/out-of-window responses.
- Native local open/save/CSV dialogs, bounded file I/O and atomic writes added.
- Separate static renderer build and restricted offline Electron shell added.

## Evidence

- 42 automated domain/file-policy tests pass.
- TypeScript and ESLint pass; standalone desktop build succeeds.
- 12 running-Electron acceptance checks pass using only synthetic data. These
  include offline workflow, oxycodone example, weekday/weekend entry, overrides,
  canceled/failed save, file roundtrip, CSV, patch/BUP rules, setup, close prompt,
  no observed remote requests during entry, and blocked network/navigation probes.
- Runtime dependency audit (`npm audit --omit=dev`) reports zero advisories.
  This excludes Electron/build tooling advisories and is not a complete security review.
- Screenshots and machine-readable reports are local in ignored `test-results/`.
- The NSIS installer completed with exit code 0 on the development computer.
  This is installation evidence on this machine, not a clean-machine test.
- Installer: `release/TLFB-Calendar-0.1.0-Windows-x64-Setup.exe` (unsigned).
  SHA-256: `ED374AAEFE00A72E90E02A2E481E4CD98966ABF72392FB0D8C5400A80694E51E`.
- Installed executable: `C:\Users\kober\AppData\Local\Programs\TLFB Calendar\TLFB Calendar.exe`.
- The archive file list was inspected: local shell/preload/policy, bundled renderer,
  icon, package metadata and license only; no data/test/hosting files.

## Remaining release gates

Test installation and a complete synthetic workflow on a separate clean Windows
machine under a normal researcher account.
No clean-machine or institutional approval is claimed. Installer signing is not yet
configured. Have the study review calculation policy, exceptions and PHI storage.

Use STAFF_GUIDE.md for team onboarding and OFFLINE_REVIEW.md for evidence and limits.
Do not send participant data to ChatGPT during further development.

The model-by-model plan remains in IMPLEMENTATION_PLAN.md; REDCap stays downstream.
