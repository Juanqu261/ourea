import { useState } from 'react';
import { answerInterview, startInterview } from './client.js';

function ratioText(ratio) {
  return ratio == null ? 'sin razón de cambio' : `cambia con ×${ratio.toFixed(2).replace('.', ',')}`;
}

export function InterviewDemo() {
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Scripted answers of the synthetic org, served from services/decision_ai/demo/. Never real data.
  const [demo, setDemo] = useState({});

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      const answers = next.demo_answers ?? demo;
      if (next.demo_answers) setDemo(next.demo_answers);
      setSession(next);
      setAnswer(next.question ? answers[next.question.gap_id] ?? '' : '');
    } catch (cause) {
      setError(cause.message);
    }
    setBusy(false);
  }

  return (
    <section className="interview" data-testid="interview-demo">
      <h3>Entrevista de dependencias</h3>
      <p className="synthetic-banner">SINTÉTICA · organización inventada para la demostración</p>
      <p className="fine">El valor de la información ordena las preguntas y el código decide cuándo parar. Las respuestas no cambian el puntaje.</p>
      {!session && <button type="button" disabled={busy} onClick={() => run(() => startInterview(true))}>Iniciar entrevista</button>}
      {error && <p className="copilot-error">{error}</p>}
      {session?.banner && <p className="fine">{session.banner}</p>}
      {session?.question && (
        <form onSubmit={(event) => { event.preventDefault(); run(() => answerInterview(session.thread_id, answer)); }}>
          <p className="fine">{session.question.gap_id} · {ratioText(session.question.ratio)}</p>
          <p data-testid="interview-question">{session.question.question}</p>
          <textarea rows={3} value={answer} onChange={(event) => setAnswer(event.target.value)} />
          <button type="submit" disabled={busy || !answer.trim()}>Responder</button>
        </form>
      )}
      {session?.closed && <p data-testid="interview-closed"><strong>{session.closed}</strong></p>}
      {session?.records?.length > 0 && (
        <ul className="fine">
          {session.records.map((record, index) => (
            <li key={index}>
              {record.gap_id}: {Object.entries(record.values).filter(([, value]) => value).map(([key, value]) => `${key} = ${value}`).join('; ') || 'sin dato'} · confianza {record.confidence}
              {record.rejected ? ' · rechazado: nombre identificable' : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
