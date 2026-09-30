# Desktop offline review

## What is shipped

Electron loads the static React bundle at `tlfb://app/index.html`. There is no
localhost HTTP listener. The package file allowlist contains the shell, preload, autosave and export-folder controllers,
static assets, icon and license. It excludes tests, synthetic output files, original
workbooks, participant files, hosting metadata, Cloudflare/Sites runtime and server
helpers. Build tools may download dependencies while creating the installer.

The shell follows the isolation, sandbox and navigation recommendations in
[Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).
The local custom scheme uses [protocol.handle](https://www.electronjs.org/docs/latest/api/protocol)
and serves allowlisted files from the packaged renderer directory. NSIS creates
[per-user desktop/Start Menu shortcuts](https://www.electron.build/nsis/).

## Runtime controls

- Node integration disabled; context isolation and renderer sandbox enabled.
- In-memory Electron session with caching disabled; no persistent interview store.
- Restrictive CSP: `connect-src 'none'`, local scripts/styles only, no frames or forms.
- Request interception permits packaged `tlfb://app` resources only. HTTP(S),
  WebSocket, localhost and arbitrary file URLs are denied.
- Background networking/components and sync disabled; DNS resolution blocked.
- External navigation, redirects, new windows, downloads and webviews denied.
- Permission checks and requests denied; spelling service disabled.
- No analytics, AI integration, crash-report uploader or auto-updater initialized.
- Preload exposes open, save, confirm, dirty-state, export-folder, print and three bounded autosave methods. IPC validates
  the main frame and local document identity; the renderer cannot specify a file path.
  Autosave uses an opaque token for a native-dialog-selected JSON file. The token
  is invalidated on stop or interview replacement. No path or token is persisted
  across app launches. Initial and repeated autosaves use the same bounded atomic
  write policy as manual saves. Failed saves preserve unsaved state in the UI.
- Native dialogs choose paths; payloads and file reads have byte limits. Saves use
  a same-folder temporary file and rename to avoid partial overwrites. No hidden interview recovery copies are created. User-enabled local autosave
  updates only the chosen session file; unapplied drafts remain in memory. An OS/process crash during a write could
  leave a temporary file beside the chosen output.
- Export folders accept exactly three bounded, consistently named files. A native
  directory picker selects the parent. The main process creates a unique staging
  folder, writes the files, and renames the folder only after success. Earlier
  export folders are never replaced. Failed writes clean up their own staging folder;
  a process/OS crash could leave a partial staging folder in the chosen parent.
- Print requests accept no renderer-supplied print options or printer targets.
  Electron opens a visible [native print dialog](https://www.electronjs.org/docs/latest/api/web-contents#contentsprintoptions-callback).
  The print stylesheet exposes only the applied-session summary. Printing does
  not mark a session saved. Automated checks mock the dialog callback and render
  a synthetic PDF; actual physical printer delivery is not part of these checks.
- Files are plaintext. Disk encryption, backups, OS memory/pagefiles, access control
  and independent folder syncing remain institutional responsibilities.

## Verification and limits

Synthetic automated tests cover calculations, day statuses, data preservation,
payload limits, asset-path restrictions, atomic writes and running Electron
interactions. Desktop tests exercise disconnected operation with Electron network
emulation, session save/open, canceled/failed save and autosave, undo, CSV, close confirmation, patches,
BUP, and outbound-request rejection even after network emulation is restored.

The test harness monitors renderer HTTP/WebSocket requests throughout the interview
workflow and explicitly probes blocked requests afterward. It also checks the actual
web preferences and restricted bridge. It uses automation to supply native dialog
choices; this does not replace a human check of the dialog UI. Test outputs stay in
ignored `test-results/` and contain only synthetic data.

This evidence is not a full machine packet capture, a penetration test, HIPAA
certification or institutional approval. Clean-machine testing, signed distribution
and study-specific validation remain release gates. See PROGRESS.md for which
packaging/installed checks have actually been completed.

The original hosted website is a separate prototype and is not this offline artifact.
No participant data should be used on the hosted prototype for these tests.
