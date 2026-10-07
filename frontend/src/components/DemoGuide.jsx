import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ourea-demo-guide-dismissed';

const HINTS = Object.freeze({
  area: 'Start here: pick a screening lens, then analyze the focus area.',
  conditions: 'Choose rainfall conditions and a planning budget, then continue.',
  priorities: 'Pick what the plan should prioritize.',
  portfolio: 'Generate a plan — or build one manually.',
  review: 'Compare Baseline vs With plan on the map, then continue.',
  safeguards: 'Download a briefing when you are ready to discuss.',
});

export function DemoGuide({ step, visible = true }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!visible || dismissed) return null;
  const hint = HINTS[step];
  if (!hint) return null;

  return (
    <div className="demo-guide" data-testid="demo-guide" role="status">
      <span><b>Demo tip</b> {hint}</span>
      <button
        type="button"
        className="demo-guide-dismiss"
        data-testid="demo-guide-dismiss"
        onClick={() => {
          try {
            window.sessionStorage.setItem(STORAGE_KEY, '1');
          } catch {
            // Ignore storage failures.
          }
          setDismissed(true);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
