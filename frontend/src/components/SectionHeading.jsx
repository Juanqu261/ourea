export function Guardrail({ children }) {
  return (
    <details className="guardrail">
      <summary>Scientific guardrail</summary>
      <p>{children}</p>
    </details>
  );
}

export function SectionHeading({ step, title, children }) {
  return (
    <header className="section-heading">
      {step != null && <span className="section-step">{String(step).padStart(2, '0')}</span>}
      <div>
        <h2>{title}</h2>
        {children ? <p>{children}</p> : null}
      </div>
    </header>
  );
}
