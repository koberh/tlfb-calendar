# TLFB Calendar

An interviewer-facing Timeline Followback workspace built by Kobe Hanson. Record daily substance-use responses, annotate memorable events, review completeness, and export analysis-ready data.

## Features

- Configurable assessment date and 1–90-day recall window; assessment day excluded.
- One to twelve substances, each with a unique name and explicit measurement type/unit.
- Daily quantity or binary use/no-use responses, plus date-specific event notes.
- Multi-date entry with confirmation before overwriting existing responses.
- Distinct confirmed no use, reported use, unanswered, partial, and outside-window states.
- Daily long-format CSV, per-substance summary CSV, and validated JSON session save/restore.
- Fictional demonstration interview. No original workbook or participant data is included.

## Run locally

Requires Node.js 22.18+ (or Node.js 24+) and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by the development server.

```sh
npm test
npm run typecheck
npm run build
```

## Workflow

1. Enter a participant code, assessor, assessment date, recall window, and substances.
2. Select a day, enter responses and optional event notes, then select **Save day**.
3. For repeated responses, enable **Select multiple days**, select dates, choose one substance and response, and apply.
4. Review **Summary & exports**. Missing days remain visible and can be exported before completion.
5. Download the JSON session before closing or refreshing. Open that file to resume later.

Changes to the recall window, substance definitions, or units explicitly start a fresh interview after confirmation. Participant and assessor labels can be edited without clearing responses.

## Measurement definitions

The recall interval is `[assessment_date - recall_days, assessment_date - 1]`, inclusive. All date arithmetic uses UTC calendar dates to avoid daylight-saving offsets. The calendar begins Monday and shows disabled padding dates outside the interval.

- **Unanswered:** no stored numeric response; exported value is blank.
- **No use:** an explicit numeric zero.
- **Use:** a positive quantity or binary `1`.
- **Partial day:** at least one configured substance is answered and another remains unanswered.
- **Complete day:** all configured substances are answered, irrespective of use.
- **Use percentage:** use days / answered days × 100; undefined when none are answered.
- **Total quantity:** sum of answered quantities; blank for binary measures or when no responses exist.
- **Mean quantity:** total / answered days, including confirmed zeros; blank when undefined or binary.

Counts refer to each substance separately. A positive response for one substance is not treated as use of every substance. Values of different units are never summed together. No automatic medication-equivalence calculations, alcohol conversions, diagnostic scores, or abstinence imputation are performed. Units and substance definitions should follow the study's measurement protocol.

## Exports

Daily CSV: one row for every expected participant/date/substance combination, including unanswered entries. Columns:

`participant_id, assessor, assessment_date, recall_start, recall_end, date, substance_id, substance, measurement, unit, status, value, event_note`

Summary CSV: one row per substance, with answered/missing/no-use/use counts and the denominator-explicit metrics above. Neither export contains out-of-window calendar padding dates. UTF-8 BOM supports Excel; fields are quoted, and spreadsheet formula-like text is prefixed with an apostrophe to prevent interpretation as executable formulas.

JSON sessions preserve the input state. Import validates dates, quantities, IDs, the recall window, and response keys. CSV is an analysis output, not an import format.

## Data handling

Interview data exists in browser memory only. No interview upload endpoint, analytics, cookies, local storage, or database is used by the application. The hosting provider serves the application and may retain ordinary access logs; downloaded session and CSV files contain the entered information and should be handled accordingly. Refreshing or closing clears memory. A browser exit warning is requested for unsaved sessions, but browsers do not guarantee that warning.

The public demonstration uses synthetic data exclusively. This project is an independent software implementation inspired by a calendar-entry workflow, not a reproduction or validation of a clinical instrument. It has not been validated for production clinical research use.

## Architecture

- `app/page.tsx`: React interview interface.
- `lib/tlfb.ts`: date arithmetic, validation, completion states, summaries, and CSV serialization.
- `tests/tlfb.test.mjs`: deterministic tests for date boundaries, missingness, export semantics, and session import.
- `app/globals.css`: responsive, keyboard-accessible styling.
- Vite/vinext provides local development and a Cloudflare-compatible deployment build.

## Project scope

Based on the calendar workflow used during interviewer-administered TLFB collection. Supporting medication calculators and unused sheets from the legacy workbook are outside this project's scope. The original Excel file is not redistributed.

## License

MIT. See LICENSE.
