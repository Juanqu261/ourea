import { PRIORITY_CARDS } from '../../config/uiCopy.js';
import { ChoiceCard } from '../../components/ChoiceCard.jsx';
import { PriorityGlyph } from '../../components/FlowIcons.jsx';
import { FlowActions } from '../FlowActions.jsx';
import { StepShell } from '../StepShell.jsx';

export function PrioritiesStep({
  state,
  priorityCards = null,
  objectiveProfileIds = null,
  onSelect,
  onHow,
  onBack,
  onContinue,
}) {
  const cards = priorityCards ?? PRIORITY_CARDS;
  const entries = objectiveProfileIds?.length
    ? objectiveProfileIds
      .filter((id) => cards[id])
      .map((id) => [id, cards[id]])
    : Object.entries(cards);
  const selected = cards[state.profileId] ?? cards.balanced ?? entries[0]?.[1];

  return (
    <StepShell
      state={state}
      actions={(
        <FlowActions
          onBack={onBack}
          onContinue={onContinue}
          continueLabel={`Continue with ${selected?.name ?? 'priority'}`}
          continueTestId="confirm-priority"
        />
      )}
    >
      <div className="priority-grid" role="radiogroup" aria-label="Plan priority">
        {entries.map(([id, card]) => (
          <ChoiceCard
            key={id}
            selected={state.profileId === id}
            testId={`priority-${id}`}
            onClick={() => onSelect(id)}
            footer={(
              <button
                type="button"
                className="choice-how"
                data-testid={`priority-how-${id}`}
                onClick={() => onHow(id)}
              >
                Details
              </button>
            )}
          >
            <span className="choice-icon"><PriorityGlyph id={id} /></span>
            <b>{card.name}</b>
            <span>{card.description}</span>
          </ChoiceCard>
        ))}
      </div>
    </StepShell>
  );
}
