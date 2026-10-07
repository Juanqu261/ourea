import { useEffect, useRef } from 'react';
import { stepMeta } from './flowReducer.js';

export function StepShell({
  state,
  title,
  instruction,
  children,
  summary = null,
  actions = null,
}) {
  const headingRef = useRef(null);
  const bodyRef = useRef(null);
  const meta = stepMeta(state.step);

  useEffect(() => {
    bodyRef.current?.scrollTo?.(0, 0);
    headingRef.current?.focus?.();
  }, [state.step, state.mode]);

  return (
    <div className="step-shell" data-testid={`step-${state.step}`}>
      <div className="step-shell-body" ref={bodyRef}>
        {summary}
        <h1 ref={headingRef} tabIndex={-1} className="step-title" data-testid="step-title">
          {title ?? meta.title}
        </h1>
        <p className="step-instruction">{instruction ?? meta.instruction}</p>
        <div className="step-content">{children}</div>
      </div>
      {actions}
    </div>
  );
}

export function CompletedSummary({ label, value, onOpen, testId }) {
  return (
    <button
      type="button"
      className="step-summary"
      data-testid={testId}
      onClick={onOpen}
    >
      <span>{label}</span>
      <b>{value}</b>
    </button>
  );
}
