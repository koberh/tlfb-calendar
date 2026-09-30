# TLFB Calendar: staff quick start

## Install once

1. Obtain the Windows installer from your study's approved distribution location.
2. Double-click the installer and follow the prompts. It installs for your Windows
   account and creates desktop and Start Menu shortcuts.
3. Open **TLFB Calendar**. You can disconnect from the internet; no sign-in is needed.

The current installer is unsigned. Ask institutional IT if your computer blocks
it. A desktop shortcut or Start Menu icon opens the app; no commands are needed.

## Start an interview

Enter participant code, assessor, assessment date, recall days and appointment.
Choose Custom for a visit such as “12-month follow-up.” Assessment day is excluded.

Add opioid medications and any other substances required by the study. For each
opioid, confirm generic ingredient, route, entry method, strength and indication.
Strength can stay blank if unknown. For a combination tablet, enter only the opioid
ingredient strength; do not include acetaminophen or other ingredients in that number.

Use the participant's reported amount taken. Record actual doses; the app does not
assume that the prescribed amount was taken. For liquids, enter concentration in
mg/mL. Use “Total mg per day” when the response itself is already in mg.

## Start a follow-up

Open the earlier interview, then choose **More options > Start follow-up**.
The participant code, medications and substances are copied into setup. Check
current medications, assessment date, recall length, assessor and appointment,
then choose **Create interview**. Responses and notes start blank. Autosave is off
for the new interview. Save any unsaved earlier interview before replacing it.

## Record days

Choose a calendar date. For each medication, choose Unanswered, Confirmed no use,
or Use reported. Enter the daily quantity for use; leave quantity blank if unknown.
Leave day strength blank to use the setup strength, or enter a different strength
for that date. For other substances, zero is confirmed no use and blank is unanswered.

The **Calculation preview** explains the dose and research MME as you type.
Unknown quantities stay unknown; a preview is not yet an applied response.

Add an event note if helpful. Click **Save day**. This updates the open interview;
click **Save session** regularly to write it to a file.

### Example: 5 mg oxycodone

Configure oral oxycodone as a tablet with strength 5 mg/unit. Choose **Select
multiple days**, then **Weekdays**. Select Use reported and quantity 1, then apply.
Select **Weekends**, enter quantity 2, and apply. The quantities are tablet counts.
For a complete Monday–Sunday week, this produces 67.5 total MME and 15 maximum daily MME.

For a dose change over a specific period, choose **Select multiple days > Select
a date range**. Set From date and Through date, then **Select this range**. Both
endpoints are included. Check the selected dates and existing-response count,
enter the response and apply. Repeat for the next period. Use the day-strength
field when the strength changed. The existing Undo action works for range entry.

Bulk overwrite prompts apply only to that item on selected days. Clear selected
responses restores unanswered status and keeps other items and notes.

### Methadone for pain or OUD

Record the actual indication. Oral methadone for either pain or OUD contributes
research MME using mg/day x 4.7. Other/unknown indications still need review.
For liquid, enter mg/mL in setup and the mL actually taken on each date. This is a
research convention, not an OUD dosing or opioid-switching recommendation.

### Injections and pain pumps

For Sublocade, choose buprenorphine, route **injection**, and **Dose per injection**.
Enter the reported dose, e.g. **300** in **Dose per injection (mg)**. On the actual
administration date choose **Dose administered** and enter **1** for number of
injections. Use the date-specific dose field for a different dose on another date.
You can also choose **Total mg administered on date** and enter mg directly.

Do not copy a monthly injection onto every day. **No dose administered** means no
injection on that date, not no ongoing medication effect. Unknown dates/amounts
stay unanswered/unknown. BUP summaries show the recorded dose in mg separately
from MME, along with missing and unknown-dose days.

For a pump, enter the amount actually delivered each day, using **Total mg delivered
per day**, or choose liquid and enter known mg/mL with daily mL. A refill/reservoir
load is not daily delivery. If delivery is unknown, leave the quantity unknown.
Pump and injection amounts are recorded and exported without an MME conversion.
BUP dose/strength and pump delivery fields are optional. Blank means unknown,
not zero; the session can still be saved and other included-opioid MME can calculate.

### Patches and buprenorphine

Fentanyl patches require the rate in mcg/hr, concurrent patch count and documented
hours of wear. The calculator requires 24-hour concurrent wear; it does not use
the number of patch changes or prorate a partial day. Unknown/partial wear needs review.
Buprenorphine is recorded as separate reported quantities and is not converted to MME.
Pumps, injections and unsupported medication/routes remain excluded from MME.

## Review results

Calendar colors cover all configured items. The separate MME status covers only
included opioids. A recorded use response may still need quantity or strength
clarification before MME can be calculated.

**Review interview** lists unanswered items and MME entries needing clarification.
Click a date to open it. Unknown amounts may remain unknown. Optional BUP/pump
amounts do not create review tasks, but an unanswered response still needs attention.
The checklist does not block saving or exporting an incomplete interview.

**Summary & exports > By medication** shows use days, recorded amounts, known dose
ranges and each medication's MME contribution. Incomplete contributions are labeled
as recorded subtotals. The OUD-methadone subtotal is already included in overall MME;
do not add it again. Buprenorphine stays separate. Open **Calendar-month results**
for monthly detail.

**Summary & exports** shows full-period results only when complete. Answered-day
averages use fully calculable days. Review the listed missing entries/exclusions.
Monthly averages include only recall days inside that calendar month.

## Undo an applied change

**Undo last change** restores the interview before the most recent Save day,
bulk application/clearing, or Apply settings action. It restores affected doses,
notes and removed medications/dates. There is one undo step and no redo. If you
are still editing a day or settings, save/apply or discard those draft edits first.
Undo is cleared when starting/opening another interview. After undo, save the
session again or wait for enabled autosave to finish.

## Save, close and resume

Choose **Save session**, then select your institution-approved folder. The JSON
session is the file to reopen with **Open session**. The app does not automatically
send the file anywhere; OneDrive or other folder-sync software can still sync a
folder independently. Use the location approved for study data.

The saving panel shows unfinished edits, changes needing a file save, and the
last successful save time and filename. Opening a file is labeled as an open;
CSV export does not update this save timestamp. Canceling/failing a save does not
mark new changes saved.

**Enable local autosave** is optional and off by default. Choose a JSON file in
your approved folder. The current interview is saved there immediately; applied
changes then save after a short pause. **Save day** and **Apply settings** are still
needed to apply drafts. Watch the save status before closing. Autosave also saves
an Undo result, replacing the chosen file's contents with that restored version.
Use a separate file for autosave if you want to retain an earlier manual snapshot.

Autosave turns off when you start/open another interview or close the app.
**Turn off autosave** keeps the saved file. Reopen that JSON with **Open session**
after an interruption. If autosave pauses after a failure, use **Save session** to
save elsewhere, then turn autosave off and enable it again at a writable location.

**Summary & exports > Save export folder** saves the session JSON and both combined
CSVs together. Choose a parent folder; a new dated folder is created each time.
Successful export includes a saved session copy and updates the save indicator.
Canceling or failing the export does not mark changes saved. Reopen the JSON inside
the folder to resume. CSV schema 3 adds medication and OUD-methadone summary fields.

**Print summary** opens the native print dialog. The printout includes participant
and visit details, completeness, medication/substance summaries, MME and notes.
Select a local printer or an available PDF printer. Printing does not save the
session. Save/apply unfinished edits before printing or exporting.

Open **Individual CSV files** for separate analysis exports. Choose CSV buttons for analysis exports or your separate REDCap workflow. CSVs
do not reopen an interview and do not mark a session saved. Keep the JSON file too.

For a file containing **both MME and other substances**, open **Summary & exports**:

- **Combined daily CSV:** one row per date with daily MME, medication quantities,
  other substance responses, units and notes.
- **Combined summary CSV:** one row for this interview, with MME total/averages/max,
  calendar-month MME results and each substance's use/no-use/unanswered day counts.

Buprenorphine quantities remain separate from MME. Blank is unavailable/unanswered,
not zero. Individual detailed export buttons remain available.

If these buttons are missing, save your JSON session, close TLFB, install version
0.1.3, then reopen your saved session. The JSON structure remains version 2.
Policy-1 sessions show a recalculation notice because OUD methadone is now included.
Save a new session copy and regenerate CSVs; older app versions cannot open the
new policy. Original saved files are not automatically modified.
Canceling a save or a failed write leaves the open interview available. Unsaved
changes prompt before close. A power loss can still lose unsaved work.

Use **New interview** for a new participant or visit. If prompted to discard
changes, cancel and save first if you need to retain the current interview.

## Common problems

- **MME is blank:** review unanswered entries, unknown quantities/strengths,
  methadone indication and patch hours. Blank is not zero.
- **No included opioid:** MME is not applicable, including BUP-only sessions.
- **Cannot save:** choose a writable approved folder. The interview remains open.
- **Cannot change screens:** Save day or Discard day edits; apply or discard settings.
- **Settings will clear responses:** cancel and save a copy first. Use a day-strength
  override for a dose change instead of redefining an existing medication.
- **Old session:** version-1 files import without inferring medication identity.
  Review legacy opioid entries under the study's migration method before analysis.
- **Another window does not open:** only one instance is allowed; the existing
  TLFB window is brought forward.

Before first real-data use, complete a synthetic interview and have your study/IT
team review calculations, storage and installation. Do not send participant session
files, screenshots or notes to ChatGPT for troubleshooting.
