# TLFB Calendar: offline desktop roadmap

Latest update (2026-09-30): version 0.1.4 adds review navigation, medication summaries,
follow-up setup, date-range entry, export folders and printing with a simple calendar-first UI.
Version 0.1.3 added live calculation previews, explicit
save status, optional local autosave and one-step undo. Version 0.1.2 introduced
OUD methadone under research policy 2 and optional injection/pump dose recording. See PROGRESS.md for
packaging, installation and validation status.

## Interface preference

Keep the presentation simple and friendly. Preserve the calendar's existing
colors, typography and spacing. Keep secondary tools and detailed tables behind
plain-language buttons or expandable sections; avoid crowding the daily workflow.
This is an ongoing design constraint from the researcher (2026-09-30).

## Agreed outcome

A researcher installs a Windows application once and opens the familiar TLFB
calendar from a desktop/Start Menu icon. Normal use works offline. Interview
records are saved only to user-selected local files; there is no AI service,
analytics, cloud database, REDCap API, or automatic upload in the production app.
REDCap remains a separate downstream institutional workflow.

Public source and demonstrations contain synthetic data only. The current hosted
prototype is not the planned desktop deliverable. The original workbook is not
redistributed. Research calculations do not provide prescribing advice.

## Work sequence and handoff

Status on 2026-09-27: steps 1–4 are implemented; installer, packaged executable and
installed-copy checks have passed on the development computer. The staff guide and
source instructions from step 5 are present. Clean-machine validation, signing,
institutional review and any GitHub publication remain outstanding. PROGRESS.md
records the exact evidence and avoids treating these outstanding gates as complete.

1. **Astra: specification and foundation.** Review the existing code, settle the
   medication model, reference policy, completeness rules, appointment field,
   session migration, and offline architecture. Save decisions locally.
2. **Astra: calculation engine.** Implement pure, network-free functions for daily
   MME, window/month summaries, raw-dose preservation, exclusions, and exports.
   Test fixed synthetic examples before connecting UI controls.
3. **Sol: interface.** Connect the tested model. Add appointment preset/custom
   labels, medication setup, weekday/weekend selection, MME summaries and notes.
   Remove the introductory slogan, headline, and description. Preserve the
   calendar workflow and guard unsaved edits. Use the field contract in
   RESEARCH_SPEC.md; do not invent alternative missing-data rules.
4. **Astra: desktop.** Produce a separate static React build and Electron shell,
   bundle all runtime assets, add native file dialogs and single-instance/close
   behavior, block external requests, and package a Windows installer. Verify
   disconnected use and installation on a clean Windows environment.
5. **Sol: distribution materials.** Short researcher guide, synthetic examples,
   troubleshooting, source README, manual-update instructions and release notes.
   Prepare GitHub publication; do not include participant files.
6. **Astra: acceptance review.** Check install -> open -> interview -> calculations
   -> export -> save -> close -> reopen, including offline network verification,
   session compatibility, and agreement between exports and documentation.

## Interface requirements retained for step 3

- Appointment presets: baseline, 1-month, 3-month, 6-month follow-up; custom label.
- Remove `LISTEN. RECALL. RECORD.`, `Every day tells part of the story.`, and the
  introductory paragraph. Start directly with interview setup/open session.
- Weekday/weekend bulk selection uses actual dates in the recall interval.
- Preserve quantities, units, formulation, route, notes, and dose changes.
- Separate buprenorphine quantities; never label a total as including BUP MME.
- Show full-window vs answered-day denominators and observed vs complete totals.
- Generic daily and summary exports; no REDCap-specific schema or integration.

## Current prototype audit

- Version 1 stores numeric substance responses in React memory and downloads
  JSON/CSV. It has no medication model, appointment field or MME calculations.
- The project currently builds with vinext, Sites and Cloudflare tooling, plus
  hosted metadata and an unused authentication helper. `npm run dev` is a
  development server, not an independently verified offline release.
- Browser interaction testing was unavailable during the original build.
- Seven original domain tests cover the basic calendar and CSV functions.
- Existing sessions must remain readable. Do not infer opioid identities,
  strength, route, or appointment from free-text version-1 substance names.

## Desktop architecture decision

Reuse the React interface and pure TypeScript calculation modules. Build a local
static renderer with Vite; do not ship the Cloudflare/Sites development runtime
as the desktop server. Electron loads packaged assets in its own window. This
can avoid a localhost HTTP listener entirely. The main process handles only
allowlisted file-open/save requests through a narrow preload bridge. Renderer
Node integration stays disabled and context isolation/sandboxing enabled.

Bundle scripts, fonts and images locally. Block remote navigation, remote resource
requests, popups and arbitrary IPC. No auto-updater, crash-report upload, telemetry,
automatic recovery file, or browser storage for interviews. Version 0.1.3 adds opt-in autosave to a
user-selected local session file; no hidden recovery file is created. Use synthetic data
to test CSP/network blocking, file I/O, unsaved-close prompts and installer behavior.
Installer signing and clean-machine validation are release tasks, not completed
claims. Local files remain PHI-bearing files; institutional storage policy still
applies. Do not describe local/offline operation as HIPAA certification.

## Release gate

A nontechnical researcher can install, launch from an icon while disconnected,
complete a fictional interview, review calculations, choose export/save locations,
close the app, and reopen the saved session without a terminal or technical help.
Runtime network inspection must confirm no outbound application requests. Source
code analysis alone is not evidence that the packaged application meets this gate.
