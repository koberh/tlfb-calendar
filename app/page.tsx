'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import './sol.css';
import {datesFor, keyFor, parseAmount, shiftDate} from '../lib/tlfb';
import {calculateMme} from '../lib/mme';
import {createResearchSession, readResearchSession, writeResearchSession} from '../lib/research-session';
import type {ResearchSession} from '../lib/research-session';
import {blankResponse, calendarStatus, commitResponse, responseDraft, revisedSetup, selectionDates, syntheticDemo, reasonLabel} from '../lib/workspace';
import type {ResponseDraft} from '../lib/workspace';
import {confirmAction, saveLocal} from '../lib/local-files';
import {MedicationEntry, SetupFields} from './research-controls';
import {ResearchSummary, show} from './research-summary';
import {InterviewReview} from './interview-review';
import {PrintSummary} from './print-summary';
import {followupDraft, rangeDates, sessionStem} from '../lib/interview-tools';
import {combinedDailyCsv, combinedSummaryCsv} from '../lib/research-exports';

const fmt = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
const longFmt = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'});
const localToday = () => {const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');};
const labels: Record<string, string> = {outside: 'Outside window', unanswered: 'Unanswered', partial: 'Partial', use: 'Use reported', zero: 'No use'};

export default function Home() {
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [draft, setDraft] = useState(() => createResearchSession('2026-09-27'));
  const [setup, setSetup] = useState(true), [setupDirty, setSetupDirty] = useState(false);
  const [tab, setTab] = useState<'calendar' | 'review' | 'summary'>('calendar');
  const [rangeStart, setRangeStart] = useState(''), [rangeEnd, setRangeEnd] = useState('');
  const [followingUp, setFollowingUp] = useState(false);
  const [selected, setSelected] = useState<string[]>([]), [bulk, setBulk] = useState(false);
  const [bulkId, setBulkId] = useState(''), [bulkResponse, setBulkResponse] = useState(blankResponse), [bulkQuantity, setBulkQuantity] = useState('');
  const [medDrafts, setMedDrafts] = useState<Record<string, ResponseDraft>>({}), [quantities, setQuantities] = useState<Record<string, string>>({}), [note, setNote] = useState('');
  const [editing, setEditing] = useState(false), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<ResearchSession | null>(null), checkpoint = useRef<string | null>(null), ioBusy = useRef(false);
  const [desktop, setDesktop] = useState(false);
  const [undoPoint, setUndoPoint] = useState<{session: ResearchSession; label: string} | null>(null);
  const [savedFile, setSavedFile] = useState<{name: string; at?: string; opened?: boolean; downloaded?: boolean} | null>(null);
  const [autoTarget, setAutoTarget] = useState<{token: string; name: string} | null>(null);
  const [autoSavedText, setAutoSavedText] = useState<string | null>(null), [autoError, setAutoError] = useState('');
  const sessionText = useMemo(() => session ? writeResearchSession(session) : null, [session]);
  useEffect(() => {const id = requestAnimationFrame(() => {setDraft(x => ({...x, assessmentDate: localToday()})); setDesktop(!!window.tlfbDesktop);}); return () => cancelAnimationFrame(id);}, []);
  useEffect(() => {
    const unsaved = dirty || editing || setupDirty;
    window.tlfbDesktop?.setDirty(unsaved);
    if (!unsaved || window.tlfbDesktop) return;
    const h = (e: BeforeUnloadEvent) => {e.preventDefault(); e.returnValue = '';};
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty, editing, setupDirty]);
  useEffect(() => {
    if (!autoTarget || !sessionText || sessionText === autoSavedText || autoError || busy || editing || setupDirty) return;
    const timer = setTimeout(async () => {
      if (ioBusy.current || !window.tlfbDesktop) return;
      ioBusy.current = true; setBusy(true);
      try {
        const result = await window.tlfbDesktop.autosave({token: autoTarget.token, text: sessionText});
        if (!result.ok) throw new Error(result.error || 'Autosave did not complete.');
        setAutoSavedText(sessionText);
        checkpoint.current = sessionText;
        setSavedFile({name: result.name || autoTarget.name, at: result.savedAt});
        if (sessionRef.current && writeResearchSession(sessionRef.current) === sessionText) setDirty(false);
      } catch (error) {setAutoError(error instanceof Error ? error.message : 'Autosave paused. Save session manually.');}
      finally {ioBusy.current = false; setBusy(false);}
    }, 1200);
    return () => clearTimeout(timer);
  }, [autoTarget, autoSavedText, sessionText, autoError, busy, editing, setupDirty]);
  const mme = useMemo(() => session ? calculateMme(session) : null, [session]);
  const dates = session ? datesFor(session.assessmentDate, session.recallDays) : [];
  const active = !bulk && selected.length === 1 ? selected[0] : null;
  const items = session ? [...session.medications, ...session.substances] : [];
  const expected = dates.length * items.length;
  const answered = session ? dates.reduce((n, d) => n + calendarStatus(session, d).answered, 0) : 0;
  const cells = dates.length ? (() => {const offset = (new Date(dates[0] + 'T00:00:00Z').getUTCDay() + 6) % 7; return Array.from({length: Math.ceil((offset + dates.length) / 7) * 7}, (_, i) => shiftDate(dates[0], i - offset));})() : [];
  const bulkMed = session?.medications.find(m => m.id === bulkId);
  const bulkSub = session?.substances.find(s => s.id === bulkId);
  function notify(text: string) {setMessage(text); setError('');}
  function fail(e: unknown) {setMessage(''); setError(e instanceof Error ? e.message : 'Unable to complete this action.');}
  function ready() {if (editing || setupDirty) {fail(new Error('Save or discard your day / settings edits first.')); return false;} return true;}
  function displaySession(s: ResearchSession) {
    setRangeStart(''); setRangeEnd(''); setFollowingUp(false);
    calculateMme(s); sessionRef.current = s; setSession(s); setDraft(structuredClone(s)); setSetup(false); setSetupDirty(false); setEditing(false); setSelected([]); setBulk(false); setTab('calendar');
    setBulkId(s.medications[0]?.id ?? s.substances[0]?.id ?? ''); setBulkResponse(blankResponse()); setBulkQuantity('');
  }
  function install(s: ResearchSession, saved = false, name = '') {
    displaySession(s); setDirty(!saved); checkpoint.current = saved ? writeResearchSession(s) : null;
    setUndoPoint(null); setSavedFile(name ? {name, opened: true} : null);
  }
  function applyChange(next: ResearchSession, label: string) {
    calculateMme(next);
    const text = writeResearchSession(next);
    if (session && text !== writeResearchSession(session)) setUndoPoint({session: structuredClone(session), label});
    sessionRef.current = next; setSession(next); setDirty(text !== checkpoint.current);
  }
  function undoChange() {
    if (!undoPoint || busy || !ready()) return;
    const previous = structuredClone(undoPoint.session), label = undoPoint.label;
    displaySession(previous); setUndoPoint(null); setDirty(writeResearchSession(previous) !== checkpoint.current);
    if (active && datesFor(previous.assessmentDate, previous.recallDays).includes(active)) loadDay(active, previous);
    notify(`Undid ${label}. Save session to keep this version, or let enabled autosave finish.`);
  }
  async function stopAutosave() {
    if (window.tlfbDesktop) {
      const result = await window.tlfbDesktop.stopAutosave();
      if (!result.ok) {fail(new Error(result.error)); return false;}
    }
    setAutoTarget(null); setAutoSavedText(null); setAutoError(''); return true;
  }
  async function mayReplace() {
    if ((dirty || editing || setupDirty) && !await confirmAction('Replace the current interview and discard unsaved changes? Save a session file first to keep them.')) return false;
    return stopAutosave();
  }
  async function openText(text: string, name = 'session.json') {const loaded = readResearchSession(text); calculateMme(loaded.session); if (await mayReplace()) {install(loaded.session, loaded.notices.length === 0, name); notify(['Session opened.', ...loaded.notices].join(' '));}}
  async function toggleAutosave() {
    if (!session || ioBusy.current || !ready() || !window.tlfbDesktop) return;
    if (autoTarget) {if (await stopAutosave()) notify('Autosave is off. The saved file is kept.'); return;}
    ioBusy.current = true; setBusy(true);
    try {
      const text = writeResearchSession(session);
      const name = `tlfb-${session.participantId}-${session.appointment.code}-${session.assessmentDate}-autosave.json`.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const result = await window.tlfbDesktop.selectAutosave({kind: 'session', name, text});
      if (result.error) throw new Error(result.error);
      if (result.ok && result.token && result.name) {
        setAutoTarget({token: result.token, name: result.name}); setAutoSavedText(text); setAutoError('');
        checkpoint.current = text; setDirty(false); setSavedFile({name: result.name, at: result.savedAt});
        notify('Autosave enabled for this interview. Save day or Apply settings to include your edits.');
      }
    } catch (error) {fail(error);} finally {ioBusy.current = false; setBusy(false);}
  }
  async function openSession() {
    if (busy) return;
    if (!window.tlfbDesktop) {fileRef.current?.click(); return;}
    setBusy(true);
    try {const result = await window.tlfbDesktop.open(); if (result.error) throw new Error(result.error); if (result.ok && result.text) await openText(result.text, result.name);} catch (e) {fail(e);} finally {setBusy(false);}
  }
  async function saveSession() {
    if (!session || ioBusy.current || busy || !ready()) return; ioBusy.current = true; setBusy(true);
    try {
      const name = `tlfb-${session.participantId}-${session.appointment.code}-${session.assessmentDate}.json`;
      const text = writeResearchSession(session), result = await saveLocal('session', name, text);
      if (result.ok) {
        setSavedFile({name: result.name || name, at: result.savedAt, downloaded: result.downloaded});
        if (!result.downloaded) {checkpoint.current = text; setDirty(false);}
        notify(result.downloaded ? 'Session download requested. Check your downloads.' : 'Session saved to your chosen file.');
      }
    } catch (e) {fail(e);} finally {ioBusy.current = false; setBusy(false);}
  }
  async function exportCsv(label: string, data: string) {
    if (!session || busy || !ready()) return; setBusy(true);
    try {if ((await saveLocal('csv', `tlfb-${session.participantId}-${session.appointment.code}-${session.assessmentDate}-${label}.csv`, data)).ok) notify('CSV saved. Save a session file to reopen this interview later.');} catch (e) {fail(e);} finally {setBusy(false);}
  }
  async function exportBundle() {
    if (!session || busy || !ready() || !window.tlfbDesktop) return;
    ioBusy.current = true; setBusy(true);
    try {
      const name = sessionStem(session), text = writeResearchSession(session);
      const result = await window.tlfbDesktop.bundle({name, files:[{kind:'session',name:name+'.json',text},
        {kind:'csv',name:name+'-combined-daily.csv',text:combinedDailyCsv(session)},
        {kind:'csv',name:name+'-combined-summary.csv',text:combinedSummaryCsv(session)}]});
      if (result.error) throw new Error(result.error);
      if (result.ok) {
        checkpoint.current = text; setDirty(false); setSavedFile({name:`${result.name} / ${name}.json`,at:result.savedAt});
        notify(`Export folder saved: ${result.name}. It contains your session and both combined CSVs.`);
      }
    } catch (e) {fail(e);} finally {ioBusy.current = false; setBusy(false);}
  }
  async function printSummary() {
    if (!session || busy || !ready()) return;
    setBusy(true);
    try {
      if (window.tlfbDesktop) {const result = await window.tlfbDesktop.print(); if (result.error) throw new Error(result.error);}
      else window.print();
    } catch (e) {fail(e);} finally {setBusy(false);}
  }
  async function startFollowup() {
    if (!session || busy || !ready()) return;
    const next = followupDraft(session, localToday());
    if (!await mayReplace()) return;
    setSession(null); sessionRef.current = null; checkpoint.current = null; setUndoPoint(null); setSavedFile(null);
    setDraft(next); setSetup(true); setFollowingUp(true); setSetupDirty(true); setDirty(false); setEditing(false); setSelected([]);
    notify('Setup copied for a follow-up. Check the date, visit and medications, then create the interview.');
  }
  function loadDay(date: string, source = session) {
    if (!source) return;
    setSelected([date]); setMedDrafts(Object.fromEntries(source.medications.map(m => [m.id, responseDraft(source.medicationResponses[keyFor(date, m.id)])])));
    setQuantities(Object.fromEntries(source.substances.map(s => [s.id, source.responses[keyFor(date, s.id)]?.toString() ?? ''])));
    setNote(source.notes[date] ?? ''); setEditing(false); setError('');
  }
  function choose(date: string) {if (!ready()) return; if (bulk) setSelected(x => x.includes(date) ? x.filter(d => d !== date) : [...x, date]); else loadDay(date);}
  function commitDay() {
    if (!session || !active) return;
    try {
      const next = structuredClone(session);
      for (const m of next.medications) {const k = keyFor(active, m.id), r = commitResponse(m, medDrafts[m.id] ?? blankResponse()); if (r) next.medicationResponses[k] = r; else delete next.medicationResponses[k];}
      for (const s of next.substances) {const k = keyFor(active, s.id), raw = quantities[s.id] ?? ''; if (raw.trim()) next.responses[k] = parseAmount(raw, s.kind); else delete next.responses[k];}
      if (note) next.notes[active] = note; else delete next.notes[active];
      applyChange(next, `day edit on ${fmt(active)}`); setEditing(false); notify(`Saved ${fmt(active)} in this session. Use Save session to keep a file.`);
    } catch (e) {fail(e);}
  }
  async function applyBulk(clear = false) {
    if (!session || !selected.length || busy) return;
    try {
      const next = structuredClone(session);
      const r = bulkMed && !clear ? commitResponse(bulkMed, bulkResponse) : undefined;
      const q = bulkSub && !clear ? parseAmount(bulkQuantity, bulkSub.kind) : undefined;
      const overwrites = selected.some(d => bulkMed ? session.medicationResponses[keyFor(d, bulkId)] !== undefined : session.responses[keyFor(d, bulkId)] !== undefined);
      setBusy(true);
      if (overwrites && !await confirmAction('Replace the existing responses for this item on the selected days? Other items and notes are preserved.')) return;
      for (const d of selected) {const k = keyFor(d, bulkId); if (bulkMed) {if (r) next.medicationResponses[k] = r; else delete next.medicationResponses[k];} else if (q !== undefined) next.responses[k] = q; else delete next.responses[k];}
      applyChange(next, `${clear ? 'clearing' : 'bulk entry for'} ${selected.length} days`); notify(`${clear ? 'Cleared' : 'Updated'} ${selected.length} days for ${bulkMed?.name ?? bulkSub?.name}.`);
    } catch (e) {fail(e);} finally {setBusy(false);}
  }
  async function applySetup() {
    try {
      const revised = revisedSetup(session, draft); setBusy(true);
      if (revised.removed && !await confirmAction(`These settings will clear ${revised.removed} recorded responses or notes because their dates or measurement definitions changed. Continue? Cancel to save the current session first.`)) return;
      if (session) {applyChange(revised.session, 'interview settings'); displaySession(revised.session);} else install(revised.session);
      notify('Interview ready. Select a date to record responses.');
    } catch (e) {fail(e);} finally {setBusy(false);}
  }
  return <main>
    <header><div className="brand">tlfb<span>calendar</span><i> / </i><small>RESEARCH WORKSPACE</small></div><span className="session-badge">LOCAL FILES · RESEARCH USE</span></header>
    <div className="top-actions sol-top">
      <button disabled={busy} className="primary" onClick={() => {if (ready()) {setDraft(structuredClone(session ?? draft)); setSetup(true);}}}>{session ? 'Interview settings' : 'Set up interview'}</button>
      <button disabled={busy} onClick={openSession}>Open session</button>
      <button disabled={busy} onClick={async () => {if (await mayReplace()) {setSession(null); sessionRef.current = null; checkpoint.current = null; setUndoPoint(null); setSavedFile(null); setDraft(createResearchSession(localToday())); setFollowingUp(false); setSetup(true); setSetupDirty(false); setEditing(false); setDirty(false); setSelected([]); notify('New interview.');}}}>New interview</button>
      <details className="more-options"><summary>More options</summary><div>{session && <button disabled={busy} onClick={startFollowup}>Start follow-up</button>}<button disabled={busy} onClick={async () => {if (await mayReplace()) {install(syntheticDemo()); notify('Synthetic demo loaded: 5 mg oxycodone, one tablet on weekdays and two on weekends.');}}}>Try synthetic demo</button></div></details>
      {session && <button disabled={busy} className="push-right" onClick={saveSession}>Save session{dirty ? ' •' : ''}</button>}
      <input hidden ref={fileRef} type="file" accept=".json" onChange={async e => {const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setBusy(true); try {if (file.size > 2_000_000) throw new Error('Session exceeds the 2 MB limit.'); await openText(await file.text(), file.name);} catch (err) {fail(err);} finally {setBusy(false);}}}/>
    </div>
    {session && <section className="save-panel" aria-label="Session saving">
      <div><strong data-testid="save-status">{busy ? 'Working with a file...' : editing || setupDirty ? 'Edits not applied yet' : dirty ? 'Changes not saved to a file' : 'Current interview saved'}</strong>
        <p data-testid="last-saved">{savedFile?.at ? `Last saved at ${new Date(savedFile.at).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit', second: '2-digit'})} to ${savedFile.name}` : savedFile?.opened ? `Opened ${savedFile.name}. No new save yet.` : savedFile?.downloaded ? `Download requested: ${savedFile.name}. Confirm it is in your downloads.` : 'No session file saved yet.'}</p>
        <p>Save day applies entries to this interview. Save session writes a file you can reopen.</p>
      </div>
      <div className="save-options">{desktop && <><button disabled={busy || editing || setupDirty} onClick={toggleAutosave}>{autoTarget ? 'Turn off autosave' : 'Enable local autosave'}</button><small className={autoError ? 'save-error' : ''} data-testid="autosave-status">{autoError ? autoError : autoTarget ? `Autosave on: ${autoTarget.name}. Applied changes save automatically.` : 'Autosave off. Choose a file to enable it for this interview.'}</small></>}
        <button disabled={busy || editing || setupDirty || !undoPoint} onClick={undoChange}>Undo last change</button><small>{undoPoint ? `Undo: ${undoPoint.label}` : 'Undo is available after a day, bulk, or settings change.'}</small>
      </div>
    </section>}
    {error && <p role="alert" className="alert error">{error}</p>}{message && <p role="status" className="alert">{message}</p>}
    {setup && <section className="panel setup"><div className="section-title"><div><p className="eyebrow">01 / INTERVIEW SETUP</p><h2>Assessment details</h2></div>{session && <button disabled={busy} onClick={async () => {if (!setupDirty || await confirmAction('Discard unapplied settings?')) {setSetup(false); setSetupDirty(false);}}}>Discard / close settings</button>}</div>
      {followingUp && <p className="alert">New follow-up for {draft.participantId}. Check the assessment date, appointment and current medications. All daily responses and notes start blank.</p>}<form onSubmit={e => {e.preventDefault(); void applySetup();}}><fieldset disabled={busy} className="plain-fieldset"><SetupFields draft={draft} onChange={s => {setDraft(s); setSetupDirty(true);}}/><div className="setup-footer"><span>Assessment day is excluded. Blank responses stay unanswered.</span><button className="primary" type="submit">{session ? 'Apply settings' : 'Create interview'}</button></div></fieldset></form>
    </section>}
    {session && !setup && <>
      <section className="metrics"><div><span>PARTICIPANT / VISIT</span><strong>{session.participantId}</strong><small>{session.appointment.label || 'Appointment unspecified'}</small></div><div><span>RECALL WINDOW</span><strong>{fmt(dates[0])} – {fmt(dates.at(-1)!)}</strong><small>{session.recallDays} days · assessment day excluded</small></div><div><span>RESPONSES</span><strong>{answered}<i> / {expected}</i></strong><small>All medications and substances</small></div><div><span>MME STATUS</span><strong>{mme!.window.status.replace('_', ' ')}</strong><small>{mme!.window.calculableDays} of {dates.length} days calculable</small></div></section>
      <div className="workspace-tabs"><div><button aria-pressed={tab === 'calendar'} onClick={() => {if (ready()) setTab('calendar');}}>Calendar</button><button aria-pressed={tab === 'review'} onClick={() => {if (ready()) setTab('review');}}>Review interview</button><button aria-pressed={tab === 'summary'} onClick={() => {if (ready()) setTab('summary');}}>Summary & exports</button></div><span>{editing ? 'Day edits not yet saved' : dirty ? 'Session has unsaved changes' : 'Applied changes saved'}</span></div>
      {tab === 'review' ? <InterviewReview session={session} result={mme!} onDay={d => {if (ready()) {setTab('calendar'); setBulk(false); loadDay(d); requestAnimationFrame(() => document.querySelector('.editor')?.scrollIntoView({block:'start',behavior:'smooth'}));}}}/> : tab === 'summary' ? <ResearchSummary session={session} result={mme!} onExport={exportCsv} onBundle={desktop ? exportBundle : undefined} onPrint={printSummary} busy={busy}/> : <div className="workspace"><section className="panel calendar-panel"><div className="section-title"><div><p className="eyebrow">02 / DAILY RECALL</p><h2>Interview calendar</h2></div><button aria-pressed={bulk} onClick={() => {if (ready()) {setBulk(!bulk); setSelected([]);}}}>{bulk ? 'Exit multi-select' : 'Select multiple days'}</button></div>
        <div className="legend">{['zero','use','partial','unanswered','outside'].map(s => <span key={s}><b className={`dot ${s}`}/>{labels[s]}</span>)}</div>
        <div className="calendar">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div className="weekday" key={d}>{d}</div>)}{cells.map(d => {
          const state = calendarStatus(session, d), day = mme!.daily.find(x => x.date === d);
          return <button key={d} data-date={d} aria-label={`${longFmt(d)}: ${labels[state.state]}, ${state.answered} of ${items.length} responses`} aria-pressed={selected.includes(d)} disabled={state.state === 'outside' || busy} className={`day ${state.state} ${selected.includes(d) ? 'selected' : ''}`} onClick={() => choose(d)}><span className="day-top"><strong>{Number(d.slice(-2))}</strong><small>{fmt(d).split(' ')[0]}</small></span><span className="day-state">{labels[state.state]}</span>{day && <><span className="day-count">{state.answered}/{items.length}{session.notes[d] ? ' · Note' : ''}</span><span className="day-count">{day.status === 'not_applicable' ? 'MME N/A' : day.status === 'incomplete' ? 'MME incomplete' : `MME ${show(day.mme)}`}</span></>}</button>;
        })}</div><p className="hint">Calendar status covers every configured medication and substance. MME completeness covers included opioids only.</p>
      </section><aside className="panel editor"><fieldset className="plain-fieldset" disabled={busy}>
        {bulk ? <><p className="eyebrow">REPEATED RESPONSES</p><h2>{selected.length} days selected</h2><div className="inline-actions">{(['weekdays','weekends','all'] as const).map(k => <button key={k} onClick={() => setSelected(selectionDates(session, k))}>{k[0].toUpperCase() + k.slice(1)}</button>)}<button onClick={() => setSelected([])}>Clear selection</button></div>
          <details className="range-picker"><summary>Select a date range</summary><div className="range-fields"><label>From date<input type="date" min={dates[0]} max={dates.at(-1)} value={rangeStart} onChange={e => setRangeStart(e.target.value)}/></label><label>Through date<input type="date" min={dates[0]} max={dates.at(-1)} value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}/></label></div><button disabled={!rangeDates(session,rangeStart,rangeEnd).length} onClick={() => setSelected(rangeDates(session,rangeStart,rangeEnd))}>Select this range</button>{rangeStart && rangeEnd && !rangeDates(session,rangeStart,rangeEnd).length && <p className="hint">Choose an ordered range inside this recall window.</p>}</details>
          <label>Medication or substance<select value={bulkId} onChange={e => {setBulkId(e.target.value); setBulkResponse(blankResponse()); setBulkQuantity('');}}>{items.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          {bulkMed ? <MedicationEntry medication={bulkMed} reference={session.reference} value={bulkResponse} onChange={setBulkResponse} applyLabel="Apply to selected days"/> : <label>Daily response ({bulkSub?.unit}){bulkSub?.kind === 'binary' ? <select value={bulkQuantity} onChange={e => setBulkQuantity(e.target.value)}><option value="">Choose response</option><option value="0">Confirmed no use</option><option value="1">Use reported</option></select> : <input type="number" min="0" step="any" value={bulkQuantity} onChange={e => setBulkQuantity(e.target.value)} placeholder="0 = confirmed no use"/>}</label>}
          {selected.length > 0 && <details className="selection-preview" open><summary>Check {selected.length} selected days</summary><p>{[...selected].sort().map(fmt).join(', ')}</p><small>{selected.filter(d => bulkMed ? session.medicationResponses[keyFor(d,bulkId)] !== undefined : session.responses[keyFor(d,bulkId)] !== undefined).length} existing responses for {bulkMed?.name ?? bulkSub?.name} will be replaced. Other entries and notes stay as they are.</small></details>}
          <button className="primary full" disabled={!selected.length || (bulkMed ? bulkResponse.status === 'unanswered' : !bulkQuantity.trim())} onClick={() => applyBulk()}>Apply to selected days</button><button className="full" disabled={!selected.length} onClick={() => applyBulk(true)}>Clear selected responses</button><p className="hint">For oxycodone configured as 5 mg/tablet: report use of 1 tablet on weekdays, then 2 on weekends. Clear restores unanswered status.</p>
        </> : active ? <><p className="eyebrow">DAY DETAIL</p><h2>{fmt(active)}</h2><p>{longFmt(active)}</p>
          {session.medications.map(m => <MedicationEntry key={m.id} medication={m} reference={session.reference} value={medDrafts[m.id] ?? blankResponse()} onChange={r => {setMedDrafts({...medDrafts, [m.id]: r}); setEditing(true);}}/>)}
          {session.substances.map(s => <label key={s.id}>{s.name}<small>{s.unit}</small>{s.kind === 'binary' ? <select value={quantities[s.id] ?? ''} onChange={e => {setQuantities({...quantities, [s.id]: e.target.value}); setEditing(true);}}><option value="">Unanswered</option><option value="0">Confirmed no use</option><option value="1">Use reported</option></select> : <input type="number" min="0" step="any" value={quantities[s.id] ?? ''} placeholder="Unanswered" onChange={e => {setQuantities({...quantities, [s.id]: e.target.value}); setEditing(true);}}/>}</label>)}
          <label>Memorable event / notes<textarea rows={3} maxLength={2000} value={note} onChange={e => {setNote(e.target.value); setEditing(true);}}/></label>
          <button className="primary full" onClick={commitDay}>Save day</button><button className="full" onClick={() => {setMedDrafts(Object.fromEntries(session.medications.map(m => [m.id, {...blankResponse(), status: 'no_use'}]))); setQuantities(Object.fromEntries(session.substances.map(s => [s.id, '0']))); setEditing(true);}}>Set all to no use</button>
          {editing && <button className="full" onClick={async () => {if (await confirmAction('Discard unsaved day edits?')) loadDay(active);}}>Discard day edits</button>}
          {!editing && mme!.medicationRows.filter(r => r.date === active && r.status === 'needs_review').map(r => <p className="hint" key={r.medicationId}>{session.medications.find(m => m.id === r.medicationId)?.name}: {reasonLabel(r.reason)}</p>)}
        </> : <><p className="eyebrow">DAY DETAIL</p><h2>Choose a date</h2><p>Select a calendar day to record responses, or select multiple days for a repeated response.</p><p className="hint">Zero means confirmed no use. Blank means unanswered.</p></>}
      </fieldset></aside></div>}
    </>}
    {session && <PrintSummary session={session} result={mme!}/>}
    <footer><span>Use Save day to apply edits, then Save session or enabled local autosave to keep them. Choose your institution-approved storage location.</span><span>Offline desktop edition: no automatic upload or AI connection. Research calculations only.</span></footer>
  </main>;
}
