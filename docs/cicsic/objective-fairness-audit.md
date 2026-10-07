# Objective fairness audit

## Policy question

> What happens to downside (P10) performance if a planner explicitly optimizes robustness instead of only central expected performance?

## Does Ourea optimize the same quantity used to declare victory?

**Not exactly.**

- **Planning (robust):** marginal score ≈ mean(scenario benefits) − `downsidePenalty` × downside, with equity/access multipliers. Downside is an internal planning statistic over optimizer scenario samples — related to, but not identical to, evaluation P10.
- **Evaluation (headline):** empirical P10 of Monte Carlo portfolio benefits under a separate evaluation ensemble.

So robust is **aligned with** lower-tail thinking, but victory is declared on evaluation P10, not on the exact planning objective scalar.

## Does deterministic optimize EV while robust is judged only on P10?

- Deterministic freezes one central scenario and optimizes the same robust-value machinery under that freeze (effectively central/expected under certainty).
- Both strategies are evaluated on **P10 and expected/central benefit**.
- Judging deterministic on P10 is intentional: it answers whether a central planner still delivers acceptable downside when futures vary.

## Is that fair?

Yes for the stated policy question, with caveats:

1. Robust has access to planning-time uncertainty ensembles; deterministic does not — that is the treatment difference under test.
2. Robust’s downsidePenalty is a free parameter that shapes selection toward lower-tail outcomes; it is not hard-coded to equal evaluation P10, but it is **pro-robustness**.
3. Primary baseline must remain `deterministic_central`, not weak naïve baselines.

## Are robust weights hard-coded to the evaluation metric?

No direct coupling to evaluation P10. Coupling is conceptual (downside penalty). Profiles (`balanced`, etc.) set weights before looking at competition headlines.

## Baseline consistency

| Baseline | Same intervention catalog? | Same costs/effects? | Same evaluation MC? | Notes |
|----------|----------------------------|---------------------|---------------------|-------|
| deterministic_central | Yes | Yes | Yes | Fair primary |
| greedy_opportunity | Yes | Yes | Yes | Weaker info at selection |
| hazard_only | Yes | Yes | Yes | Medellín-shaped hazard prior |
| random_feasible | Yes | Yes | Yes | Feasibility floor |

## Expected-value trade-off (required)

Always report expected/central benefit alongside P10. If robust gains P10 by sacrificing large expected benefit, that must appear in headlines as a trade-off, not as universal superiority.

## Selection stability

Excluded from fairness claims when measured via evaluation-seed loops with fixed plans.
