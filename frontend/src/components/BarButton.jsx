export function HelpIcon() {
  return (
    <svg className="bar-button-icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.8 7.7c.35-1.15 1.3-1.75 2.4-1.75 1.25 0 2.2.75 2.2 1.85 0 .95-.5 1.4-1.35 1.9-.7.4-.95.7-.95 1.35" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10" cy="14.4" r="0.85" fill="currentColor" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg className="bar-button-icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="5" r="1.25" fill="currentColor" />
      <circle cx="10" cy="10" r="1.25" fill="currentColor" />
      <circle cx="10" cy="15" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function LayersIcon() {
  return (
    <svg className="bar-button-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3.5 17 7.2 10 10.9 3 7.2Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3 10.2 10 13.9 17 10.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13.2 10 16.9 17 13.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BarButton({
  children,
  icon = null,
  testId,
  onClick,
  ariaExpanded,
  ariaHaspopup,
  ariaLabel,
  className = '',
}) {
  return (
    <button
      type="button"
      className={`bar-button ${className}`.trim()}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      onClick={onClick}
    >
      {icon}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

export function MenuItem({ children, testId, onClick }) {
  return (
    <button type="button" role="menuitem" className="menu-item" data-testid={testId} onClick={onClick}>
      {children}
    </button>
  );
}
