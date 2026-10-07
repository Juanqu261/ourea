export function FlowActions({
  backLabel = 'Back',
  continueLabel = 'Continue',
  onBack,
  onContinue,
  continueDisabled = false,
  continueTestId = 'flow-continue',
  hideBack = false,
  extra = null,
}) {
  return (
    <div className="flow-actions" data-testid="flow-actions">
      {extra}
      {!hideBack && (
        <button type="button" className="flow-back" data-testid="flow-back" onClick={onBack} disabled={!onBack}>
          {backLabel}
        </button>
      )}
      <button
        type="button"
        className="primary flow-continue"
        data-testid={continueTestId}
        onClick={onContinue}
        disabled={continueDisabled}
      >
        {continueLabel}
      </button>
    </div>
  );
}
