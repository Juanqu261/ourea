# Ourea — likely judge Q&A

## “Is this just another digital twin?”

No.

The 3D terrain is the interaction layer. The product is a **robust adaptation portfolio decision engine** that compares physical interventions across uncertain futures, budgets and explicit public-policy priorities.

## “Is this another landslide early-warning system?”

No.

Medellín already has SIATA and local early-warning work. OUREA is intentionally downstream of risk intelligence:

> risk/monitoring information → adaptation project choices.

## “Why does this need AI?”

The core is not a chatbot.

The decision problem is combinatorial and uncertain:
- many locations;
- multiple intervention types;
- budget constraints;
- uncertain climate futures;
- uncertain intervention effects;
- equity/access priorities;
- diminishing returns from overlapping interventions.

Ourea performs uncertainty-aware portfolio search, stability analysis and multi-objective trade-off exploration.

The visible decision engine searches 125 eligible intervention-location candidates under budget constraints, using 80 uncertainty scenarios per optimization, four transparent policy objectives and 220 common-random futures for comparison. A binary MILP independently cross-checks the browser search. Neither method is claimed to find a global optimum.

## “Why not just use SIATA?”

SIATA is essential input infrastructure, not a competitor.

SIATA helps characterize hydrometeorological conditions and warning.

OUREA asks:
> Given the risk/climate information, what adaptation projects should we test/fund first?

## “How is this city-scale if the detailed model is one neighborhood?”

Ourea has a two-stage architecture:
1. all-Medellín barrio screening;
2. high-resolution intervention analysis in a selected proving ground.

The method is city-scale; high-resolution engineering/detail is intentionally localized where a decision is being tested.

## “Why did you choose Llanaditas?”

Not because it ranks #1 everywhere.

Current Ourea:
- #9 hazard-only;
- #7 exposure;
- #13 balanced;
- #22 equity.

It is selected because it combines substantial exposure, vulnerable hillside conditions, strong data, active local adaptation context and a historical event suitable for validation.

## “Is the city ranking a climate-risk model?”

No.

It is a static prioritization proxy using:
- official hazard coverage;
- official 2026 population projection;
- 2023 comuna-level IMCV.

It is explicitly not a dynamic SIATA-driven forecast or investment recommendation.

## “What does the equity lens really measure?”

At city scale it uses relative comuna-level socioeconomic conditions from official IMCV/AMPI.

At detailed scale it currently uses stratum-1 exposure share.

Both are planning proxies and both have limitations. Ourea states them instead of describing them as household income or a complete vulnerability model.

## “Why four AI plans?”

Because one hidden objective function is poor public decision design.

Balanced, Equity-first, Access-first and Low-regret make different priorities explicit.

The user can compare how project selection changes instead of accepting one supposedly neutral optimum.

## “Which plan do you recommend?”

The UI can highlight the current **highest-P10** plan—the strongest lower-tail benefit under the current uncertainty ensemble.

That is not universal optimality.

A real pilot should co-design policy weights and costs with decision-makers/community stakeholders.

## “What is P10?”

The 10th percentile of the current planning benefit-proxy distribution across sampled uncertain futures.

It is useful as a lower-tail robustness diagnostic.

It is not a 90%-confidence guarantee of real-world impact.

## “What is selection stability?”

How often a project remains selected when the uncertainty ensemble is independently resampled with the policy/budget held fixed.

It is not probability of true optimality.

## “Is that a Pareto frontier?”

Ourea calls it a **sampled non-dominated set**.

It samples explicit equity/access policy weights and removes dominated portfolios.

It is not exhaustive mathematical Pareto optimization.

## “Are you predicting people saved?”

No.

The model reports planning benefit/exposure proxies.

It never converts current outputs into people saved, casualties avoided or monetary loss avoided.

## “Why are costs not in COP?”

Because cross-intervention COP optimization would currently imply false comparability.

We have meaningful local procurement/project evidence—including an official RWH budget ceiling anchor—but drainage/bioengineering scopes differ and RWH capacity/context varies.

Planning credits remain more defensible until comparable cost distributions are built.

## “Do you have any local cost evidence at all?”

Yes.

Ourea includes:
- Medellín RWH specifications;
- isolated RWH budget components;
- an official 2023 Santa Elena procurement ceiling equivalent to ~COP 2.119M per installed 1,000 L household RWH system;
- Comuna 8 mitigation/bioengineering budgets;
- 2026 Medellín hydraulic project scale references.

The project deliberately does not misuse them as universal unit costs.

## “How do you validate it?”

Primary scientific gate:
- raw SIATA rainfall;
- verified June 2022 event timestamp;
- rainfall QA/features;
- historical hindcast/sensitivity.

If the available event labels are sparse, the project will prefer a transparent dynamic stress formulation rather than training a high-capacity model on inadequate data.

## “Why is this innovative if robust optimization already exists?”

The innovation claim is not that robust optimization was invented here.

It is the **city climate product architecture and decision target**:
- risk intelligence → physical adaptation portfolios;
- real city data;
- explicit uncertainty;
- equity/access policy lenses;
- project explainability;
- city-to-neighborhood workflow;
- evidence provenance;
- implementation/pilot path.

## “What if browser optimizer and MILP disagree?”

That is expected and useful.

The browser evaluates sequential marginal nonlinear effects. The formal MILP uses linearized coefficients with exact binary constraints, then nonlinear reevaluation.

Near-performing alternative plans should be surfaced, not hidden.

## “How does it scale?”

Replace local adapters:
- hazard;
- population/vulnerability;
- terrain/buildings;
- climate-driver data;
- intervention/cost library.

Keep the scenario/uncertainty/portfolio/evidence architecture.
