# Red-team findings

Written for a skeptical external reviewer after the paired 500-trial protocol.

## Claims that survived

1. **Paired robust vs deterministic P10 advantage (reference config)**  
   - Nanjing: mean Δ +33.36 (~**+11.38%**), 95% CI [32.92, 33.81], wins 500/500.  
   - Medellín: mean Δ +2.81 (~**+4.23%**), 95% CI [2.65, 2.97], wins 467/500.

2. **Same decision engine across cities** — no Nanjing-specific optimizer fork required.

3. **Expected performance not sacrificed** for P10 in the reference plans (expected also improved).

4. **Advantage persists across most budgets** 6–20 (Nanjing ties at 8 when plans coincide).

5. **Nanjing WorldCover / population / planning-cell pipeline** remains technically functional; equity intentionally absent.

6. **Retrospective municipal evidence kept out of the optimizer** (`optimizer_input: false`).

## Claims weakened

1. **“Robust becomes more valuable as uncertainty increases.”**  
   Advantage persists under low/base/high evaluation uncertainty but absolute Δ is roughly flat — do not claim monotone gains with uncertainty.

2. **“Most value when budgets are constrained.”**  
   Relative lifts are often larger at low budgets, but absolute Medellín Δ is largest at budget 20; Nanjing ties at 8. Use only with nuance.

3. **Provisional 12-trial headlines** (+11.1% / +4.3%) — directionally confirmed, but must cite 500-trial CI and protocol.

4. **Hazard-only as a cross-city equal baseline** — Medellín-shaped hazard labels; Nanjing analogue is weaker conceptually.

## Claims rejected

1. **Selection-stability lift as a benefit** — evaluation-seed loops with fixed plans yield 0% by construction.

2. **Nanjing greedy P10 ≈ 0.5 as a fair baseline result** — caused by a **crossed-denominator ranking bug**; fixed. Post-fix greedy ~176 P10.

3. **Marketing ratios vs near-zero greedy** — scientifically meaningless; blocked by relative-delta safety flags.

4. **Physical flood-risk reduction claims** from planning-proxy scores.

5. **Using retrospective Nanjing projects to retune the optimizer** for narrative fit.

## Unexpected findings

1. **Greedy bug** materially distorted the prior Nanjing baseline story.
2. **Nanjing budget=8**: robust and deterministic select identical 8× RWH → Δ=0 (fair tie).
3. **Uncertainty widening does not amplify** the robust–deterministic gap under fixed plans.
4. **10× RWH** remains robust’s Nanjing budget-10 plan under ±20% joint effect scaling — parameter-favored but not bug-driven.
5. Robust’s Nanjing plan beats deterministic on **both** P10 and expected benefit (not a pure downside/expected trade).

## Remaining uncertainties

- Planning credits and effect ranges are priors, not calibrated engineering costs.
- Nanjing population is a WorldPop AOI estimate; equity unavailable.
- Evaluation MC (220 runs) and planning ensembles are computational approximations.
- Selection stability under **planning-time** uncertainty resampling was not elevated to a headline experiment.
- Physical drainage performance of selected RWH packages is not simulated.
