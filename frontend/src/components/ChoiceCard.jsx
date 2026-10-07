export function ChoiceCard({
  selected = false,
  disabled = false,
  primary = false,
  testId,
  onClick,
  children,
  footer = null,
}) {
  const classes = ['choice-card'];
  if (primary) classes.push('primary-choice');
  if (selected) classes.push('selected');

  return (
    <div className={classes.join(' ')} data-selected={selected ? 'true' : 'false'}>
      <button
        type="button"
        className="choice-card-button"
        data-testid={testId}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
      {footer}
    </div>
  );
}
