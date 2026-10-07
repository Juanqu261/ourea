export function TextField({
  id,
  testId,
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
}) {
  return (
    <label className="select-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type={type}
        data-testid={testId}
        aria-label={label}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
