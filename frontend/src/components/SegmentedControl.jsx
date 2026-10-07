export function SegmentedControl({
  legend,
  value,
  options,
  onChange,
  className = '',
}) {
  return (
    <div className={`seg ${className}`.trim()} role="radiogroup" aria-label={legend}>
      {legend ? <span className="metric-group-label">{legend}</span> : null}
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={value === option.id ? 'active' : ''}
          data-testid={option.testId}
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
