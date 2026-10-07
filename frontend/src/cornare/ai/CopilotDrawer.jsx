import { useState } from 'react';
import { MapPin, Send } from 'lucide-react';
import { EVIDENCE_LABELS } from '../../domain/evidence.js';
import { askCopilot } from './client.js';

const ALLOWED_LABELS = new Set([...Object.values(EVIDENCE_LABELS), 'Información faltante']);

const SUGGESTIONS = [
  '¿Y si exigimos infraestructura gris?',
  '¿Qué tan robusto es el portafolio?',
  '¿Qué brecha conviene cerrar primero?',
];

export function CopilotDrawer({ gaps, onFocus, onGap }) {
  const [question, setQuestion] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [turns, setTurns] = useState([]);
  const [trace, setTrace] = useState([]);
  const [busy, setBusy] = useState(false);
  const gapNames = new Map(gaps.map((gap) => [gap.id, gap.missing_information]));

  async function submit(text) {
    const asked = text.trim();
    if (!asked || busy) return;
    setBusy(true);
    setTrace([]);
    setQuestion('');
    let result = null;
    try {
      await askCopilot(asked, threadId, ({ event, data }) => {
        if (event === 'start') setThreadId(data.thread_id);
        if (event === 'tool') setTrace((items) => [...items, `Consultando motor: ${data.name}…`]);
        if (event === 'retry') setTrace((items) => [...items, 'Verificando cifras: el borrador no pasó, se corrige…']);
        if (event === 'answer') result = data;
        if (event === 'error') result = { status: 'error', error: data.message };
      });
    } catch (error) {
      result = { status: 'error', error: error.message };
    }
    setTurns((items) => [...items, { question: asked, ...result }]);
    const focus = result?.answer?.enfoque_mapa?.intervention_id;
    if (focus) onFocus(focus);
    setBusy(false);
  }

  return (
    <section className="copilot" data-testid="copilot-drawer-body">
      <h2>Pregúntale a la decisión</h2>
      <p className="fine">Solo lectura. Cada cifra viene del motor y lleva su huella. Sin probabilidades ni pérdidas evitadas.</p>
      <div className="copilot-turns">
        {turns.map((turn, index) => (
          <article key={index} className="copilot-turn" data-testid="copilot-turn">
            <p className="copilot-question">{turn.question}</p>
            {turn.status === 'error' && <p className="copilot-error">El servicio no respondió: {turn.error}</p>}
            {turn.answer && (
              <>
                <p data-testid="copilot-answer">{turn.answer.respuesta}</p>
                {turn.status === 'fallback' && <p className="fine">Respuesta de respaldo: solo hechos de las herramientas.</p>}
                {turn.status === 'refused' && <p className="fine">Pregunta fuera de lo que Ourea puede afirmar.</p>}
                {turn.answer.cifras.length > 0 && (
                  <ul className="figure-chips" data-testid="copilot-figures">
                    {turn.answer.cifras.map((cifra, i) => (
                      <li key={i} title={`valor exacto ${cifra.valor}`}>
                        <strong>{cifra.texto}</strong> · {cifra.herramienta} · <code>{cifra.huella}</code>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="evidence-label">
                  {turn.answer.etiquetas.filter((label) => ALLOWED_LABELS.has(label)).join(' · ')}
                </p>
                {turn.answer.brechas_relacionadas.length > 0 && (
                  <ul className="copilot-gaps">
                    {turn.answer.brechas_relacionadas.map((gapId) => (
                      <li key={gapId}>
                        <button type="button" className="text-button" onClick={() => onGap(gapId)}>{gapNames.get(gapId) ?? gapId}</button>
                      </li>
                    ))}
                  </ul>
                )}
                {turn.answer.enfoque_mapa && (
                  <button type="button" data-testid="copilot-map" onClick={() => onFocus(turn.answer.enfoque_mapa.intervention_id, true)}>
                    <MapPin size={14} /> Ver en el mapa
                  </button>
                )}
              </>
            )}
          </article>
        ))}
      </div>
      {busy && (
        <ul className="copilot-trace" data-testid="copilot-trace" aria-live="polite">
          {(trace.length ? trace : ['Pensando…']).map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      )}
      {turns.length === 0 && (
        <div className="pill-row">
          {SUGGESTIONS.map((text) => <button key={text} type="button" onClick={() => submit(text)}>{text}</button>)}
        </div>
      )}
      <form className="copilot-form" onSubmit={(event) => { event.preventDefault(); submit(question); }}>
        <input
          data-testid="copilot-input"
          value={question}
          maxLength={600}
          placeholder="Pregunte sobre el portafolio…"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" data-testid="copilot-send" disabled={busy || !question.trim()} aria-label="Enviar"><Send size={16} /></button>
      </form>
    </section>
  );
}
