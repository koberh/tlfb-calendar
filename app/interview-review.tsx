import type {ResearchSession} from '../lib/research-session';
import {calculateMme} from '../lib/mme';
import {interviewReview} from '../lib/interview-tools';
import {reasonLabel} from '../lib/workspace';

export function InterviewReview({session, result, onDay}: {session: ResearchSession; result: ReturnType<typeof calculateMme>; onDay: (date: string) => void}) {
  const days = interviewReview(session, result);
  const unanswered = days.reduce((n,d) => n+d.unanswered.length,0), review = days.reduce((n,d) => n+d.needsReview.length,0);
  return <section className="panel summary"><p className="eyebrow">INTERVIEW CHECK-IN</p><h2>Review interview</h2>
    <p>{days.length ? `${days.length} ${days.length === 1 ? 'date has' : 'dates have'} something to check. Select a date to return to its entries.` : 'All responses are recorded. No MME entries need review.'}</p>
    <p className="review-counts" data-testid="review-counts">{unanswered} unanswered {unanswered === 1 ? 'response' : 'responses'} · {review} MME {review === 1 ? 'entry' : 'entries'} to review</p>
    <p className="hint">Unknown amounts can stay unknown. Buprenorphine and pump doses are optional; leaving an amount blank does not add a review task. A blank response still means the day has not been answered.</p>
    <div className="review-list">{days.map(d => <div className="review-day" key={d.date}>
      <button onClick={() => onDay(d.date)} aria-label={`Review ${d.date}`}>{new Date(d.date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}</button>
      <div>{d.unanswered.length > 0 && <p>Unanswered: {d.unanswered.join(', ')}</p>}{d.needsReview.map((r,i) => <p key={i}>{r.name}: {reasonLabel(r.reason)}</p>)}</div>
    </div>)}</div>
  </section>;
}
