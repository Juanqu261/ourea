# Ourea — robust policy portfolio method

## Decision question

OUREA does not assume there is one universally correct adaptation portfolio.

The decision problem is:

> Given a budget, uncertain climate forcing, uncertain intervention effectiveness, vulnerable exposure and critical access, which physical adaptation portfolio remains defensible across plausible futures?

## Candidate projects

The detailed sandbox is discretized into ~80 m planning cells.

Each eligible candidate is:

`planning cell × intervention family`

Current intervention families:
1. rainwater harvesting;
2. drainage / water management;
3. restoration / soil bioengineering.

Opportunity is kept separate from hazard-weighted exposure:
- RWH opportunity → roof-area proxy;
- drainage opportunity → mapped corridor proxy;
- restoration opportunity → open-space × slope proxy.

This prevents the V1 error of counting hazard twice.

## Common-random-number uncertainty

Ourea separates:
1. climate-scenario uncertainty;
2. intervention-effect uncertainty.

Portfolio comparisons use common indexed climate futures. Project-effect draws are keyed by `project + future`.

Therefore:
- changing portfolio order does not change a project's random effect;
- comparing two portfolios does not silently compare different climate sequences;
- outputs are reproducible from centralized seeds.

## Marginal robust benefit

For each candidate project, the browser optimizer calculates benefit across the current scenario ensemble after accounting for projects already selected in that cell.

Let:
- `B_mean` = mean marginal benefit proxy;
- `B_p10` = 10th percentile marginal benefit proxy;
- `D = max(0, B_mean - B_p10)` = downside spread;
- `q_e` = stratum-1 building share in the cell;
- `q_a` = normalized mapped access-corridor index;
- `w_e` = equity policy weight;
- `w_a` = access policy weight;
- `λ` = downside penalty.

Development robust value:

`R = (B_mean - λD) × (1 + w_e q_e) × (1 + w_a q_a)`

Selection score:

`score = R / planning_credit_cost`

The selected project is added, residual exposure is updated multiplicatively, and the process repeats until no feasible positive candidate remains.

This makes stacked projects exhibit diminishing returns rather than unlimited additive benefits.

## Four explicit public-policy lenses

All weights live only in:
`frontend/src/config/modelParameters.json`

The values below are the **current 10-credit checkpoint** evaluated with the same 220 comparison futures. They are planning benefit proxies, not calibrated impact estimates.

### Balanced

Policy weights:
- equity: 0.25;
- access: 0.10;
- downside penalty: 0.55.

Current result:
- 6 projects;
- P10 **64.54**;
- median **80.67**.

Purpose: default robust exposure-reduction portfolio with modest equity/access emphasis.

### Equity-first

Policy weights:
- equity: 1.20;
- access: 0.05;
- downside penalty: 0.55.

Current result:
- 6 projects;
- P10 **63.03**;
- median **80.32**;
- deterministic equity-benefit proxy **79.09**.

Purpose: inspect how stronger weighting of stratum-1 exposure changes project selection.

Important local limitation: 1,540/1,588 buildings in the current detailed sandbox are stratum 1, so the social gradient is structurally limited. Ourea does not manufacture stronger differentiation.

### Access-first

Policy weights:
- equity: 0.10;
- access: 1.20;
- downside penalty: 0.55.

Current result:
- 6 projects;
- P10 **65.63**;
- median **78.82**;
- deterministic access-benefit proxy **57.31**, the highest among the four named profiles in this checkpoint.

Purpose: put more decision weight on cells related to mapped hillside access.

The access metric is a planning proxy, **not traffic or evacuation simulation**.

### Low-regret

Policy weights:
- equity: 0.25;
- access: 0.10;
- downside penalty: 1.50.

Current result:
- 4 projects;
- P10 **66.33**;
- median **81.90**;
- strongest lower-tail P10 among the named profiles in the current checkpoint.

Purpose: strongly penalize lower-tail uncertainty and favor projects whose marginal benefit remains defensible under adverse uncertainty-ensemble draws.

The UI labels this **“highest P10”**, not “the optimal plan”.

## Policy consensus across named lenses

Ourea also reports project membership across the four named policy profiles.

Current all-policy core:
- cell 35 — drainage (4/4 profiles)
- cell 35 — rwh (4/4 profiles)

This is **policy consensus under the current model**, not proof of real-world optimality.

## Selection stability

For the active policy profile, Ourea reruns the optimizer across independent uncertainty resamples.

The reported selection frequency means:
> how often a project remains selected under repeated uncertainty-ensemble draws.

It does **not** mean:
> probability that the project is truly optimal.

## Budget robustness frontier

For the active policy profile, Ourea evaluates configured budgets:

`4 / 8 / 12 / 16 / 20 planning credits`

Each resulting portfolio is evaluated under shared future sequences and reports:
- P10;
- median;
- P90;
- downside retention = `P10 / median`.

## Multi-objective trade-off exploration

Ourea samples a 3×3 grid of explicit equity/access weights and computes a non-dominated set over:
- robust median benefit proxy;
- equity-benefit proxy;
- access-benefit proxy.

The UI deliberately calls this:

> **sampled non-dominated trade-offs**

not an exhaustive mathematical Pareto frontier.

## Formal MILP cross-check

The Python model independently solves binary project selection with:
- exact budget constraint;
- exact maximum projects per cell;
- linearized robust benefit coefficients.

The selected MILP portfolios are then re-evaluated with the nonlinear multiplicative scenario engine over 500 futures.

Because the browser evaluates sequential marginal benefit while the MILP uses linearized coefficients, different near-performing portfolios are expected.

That disagreement is useful information rather than an error to hide.

## Policy interpretation

OUREA's policy lenses are not normative truth.

A real pilot should co-design weights with:
- responsible city agencies;
- affected communities;
- engineering/geotechnical professionals;
- planning/environmental authorities.

The Ourea purpose is to make those trade-offs explicit, inspectable and reproducible.
