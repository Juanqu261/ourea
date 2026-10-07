import { FLOW_STEPS } from '../config/uiCopy.js';
import { canEnterStep } from './flowGuards.js';
import { stepIndex } from './flowReducer.js';
import { StepIcon } from '../components/FlowIcons.jsx';

export function FlowStepper({ state, onGoToStep }) {
  const currentIndex = stepIndex(state.step);

  return (
    <nav className="flow-stepper" aria-label="Decision steps" data-testid="flow-stepper">
      <p className="flow-stepper-progress" data-testid="flow-progress">
        Step {currentIndex + 1} of 6
      </p>
      <ol className="flow-stepper-list">
        {FLOW_STEPS.map((step, index) => {
          const current = step.id === state.step;
          const reachable = canEnterStep(state, step.id);
          const completed = reachable && index < currentIndex;
          const className = current ? 'is-current' : completed ? 'is-complete' : reachable ? 'is-reached' : 'is-locked';
          return (
            <li key={step.id}>
              <button
                type="button"
                className={className}
                aria-current={current ? 'step' : undefined}
                aria-disabled={!reachable}
                disabled={!reachable}
                title={step.title}
                data-testid={`flow-step-${step.id}`}
                onClick={() => reachable && onGoToStep(step.id)}
              >
                <span className="flow-stepper-mark">
                  {completed ? (
                    <span className="flow-stepper-check" aria-hidden="true">✓</span>
                  ) : (
                    <span className="flow-stepper-icon"><StepIcon id={step.id} /></span>
                  )}
                  <span className="flow-stepper-index">{index + 1}</span>
                </span>
                <span className="flow-stepper-label">{step.short}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
