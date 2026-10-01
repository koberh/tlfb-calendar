// Regenerates docs/images/calendar.png from a synthetic 28-day interview. No participant data.
import {_electron as electron, expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {datesFor, keyFor} from '../lib/tlfb.ts';
import {session, medication, use, noUse} from './research-fixtures.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const work = await fs.mkdtemp(path.join(root, 'test-results', 'screenshot-'));
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({args: [root, '--user-data-dir=' + path.join(work, 'profile')], env});
const page = await app.firstWindow();
try {
  const s = session({
    participantId: 'DEMO-014', assessor: 'Research assistant', recallDays: 28,
    appointment: {code: 'month_1', label: '1-month follow-up'},
    medications: [medication({id: 'oxy', name: 'Oxycodone 5 mg'})],
    substances: [
      {id: 'alcohol', name: 'Alcohol', unit: 'standard drinks', kind: 'quantity'},
      {id: 'cannabis', name: 'Cannabis', unit: 'use / no use', kind: 'binary'},
    ],
  });
  datesFor(s.assessmentDate, s.recallDays).forEach((d, i) => {
    if (i === 25 || i === 26) return; // two days left unanswered
    const weekend = [0, 6].includes(new Date(d + 'T12:00:00Z').getUTCDay());
    s.medicationResponses[keyFor(d, 'oxy')] = i % 9 === 4 ? noUse() : use(weekend ? 3 : 2);
    s.responses[keyFor(d, 'alcohol')] = weekend ? 2 : 0;
    if (i !== 24) s.responses[keyFor(d, 'cannabis')] = i % 5 === 0 ? 1 : 0;
  });
  s.notes['2026-09-05'] = 'Family birthday dinner';
  s.notes['2026-09-14'] = 'Started new work schedule';
  const file = path.join(work, 'demo.json'); await fs.writeFile(file, JSON.stringify(s));
  await app.evaluate(({dialog}, f) => {dialog.showOpenDialog = async () => ({canceled: false, filePaths: [f]});}, file);
  await page.setViewportSize({width: 1440, height: 1480});
  await page.getByRole('button', {name: 'Open session', exact: true}).click();
  await expect(page.getByRole('status')).toContainText('Session opened');
  await page.locator('[data-date="2026-09-14"]').click(); await page.evaluate(() => window.scrollTo(0, 0));
  await fs.mkdir(path.join(root, 'docs', 'images'), {recursive: true});
  await page.screenshot({path: path.join(root, 'docs', 'images', 'calendar.png'), fullPage: false});
  console.log('saved docs/images/calendar.png');
} finally {
  await app.close();
  await fs.rm(work, {recursive: true, force: true});
}
