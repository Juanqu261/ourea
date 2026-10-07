export function OureaLogo({
  compact = false,
  showWordmark = true,
  title = 'OUREA',
}) {
  const size = compact ? 26 : 32;

  return (
    <span className={compact ? 'ourea-logo compact' : 'ourea-logo'} aria-label={title}>
      <svg
        className="ourea-mark"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="ourea-ridge"
          d="M8 42 L24 16 L32 30 L42 12 L56 42"
          fill="none"
          strokeWidth="2.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path className="ourea-contour" d="M10 46 C20 42 28 50 38 44 C46 40 52 46 54 44" fill="none" strokeWidth="1.65" strokeLinecap="round" />
        <path className="ourea-contour" d="M12 51 C22 47 30 54 39 49 C47 45 52 51 54 49" fill="none" strokeWidth="1.45" strokeLinecap="round" />
        <path className="ourea-contour" d="M14 56 C24 52 31 58 40 54 C47 51 52 55 54 54" fill="none" strokeWidth="1.25" strokeLinecap="round" />
      </svg>

      {showWordmark && (
        <span className="ourea-word" aria-hidden="true">
          <svg className="ourea-o-glyph" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
            <circle cx="14" cy="14" r="11.2" className="ourea-ridge" fill="none" strokeWidth="1.7" />
            <path
              className="ourea-ridge"
              d="M8.2 17.8 L14 8.6 L16.8 13.4 L19.6 9.8 L22.4 17.8"
              fill="none"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path className="ourea-contour" d="M8.8 19.7 C12.2 18.4 14.6 21 17.4 19.4 C19.6 18.2 21.2 19.8 22.2 19.2" fill="none" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <span>URE</span>
          <svg className="ourea-a-glyph" viewBox="0 0 22 28" aria-hidden="true" focusable="false">
            <path
              className="ourea-ridge"
              d="M1.5 24 L11 4 L20.5 24"
              fill="none"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </span>
  );
}
