export function InfoTip({ label, children, testId = null }) {
  return (
    <span className="info-tip" data-testid={testId}>
      <button
        type="button"
        className="info-tip-trigger"
        aria-label={label ? `About ${label}` : 'More information'}
        title={typeof children === 'string' ? children : label}
      >
        i
      </button>
      <span className="info-tip-panel" role="tooltip">{children}</span>
    </span>
  );
}
