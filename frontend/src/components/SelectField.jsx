export function SelectField({
  id,
  testId,
  label,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  disabled = false,
  required = false,
}) {
  return (
    <label className="select-field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        data-testid={testId}
        aria-label={label}
        value={value ?? ''}
        disabled={disabled}
        required={required}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
