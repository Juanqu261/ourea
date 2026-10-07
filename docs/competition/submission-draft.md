# Ourea — Innovate4Cities 2026 submission draft

## Solution name

**OUREA**

## One-line pitch

**Ourea is an evidence-backed decision sandbox that helps cities turn climate risk, budget constraints, equity and community safeguards into robust portfolios of urban resilience actions.**

## ≤200-character description

**AI stress-tests climate and investment scenarios to identify robust adaptation portfolios for vulnerable urban hillsides. Medellín’s Comuna 8 is the proving ground.**

## City climate focus

Primary:
- climate adaptation / resilience;
- vulnerable urban hillsides;
- **Informal / Marginalized Settlements**.

Secondary, if mentor guidance supports it:
- critical hillside access as transportation/connectivity resilience.

Do not force misinformation/disinformation.

## The problem

Cities increasingly have maps showing **where risk is**.

They still face an implementation question that maps do not answer:

> With limited budgets and an uncertain climate future, which adaptation projects should we fund first?

For vulnerable urban hillsides, that means comparing combinations of water management, decentralized rainwater capture and nature-based/bioengineering interventions while considering:
- uncertain rainfall;
- uncertain intervention effectiveness;
- vulnerable population exposure;
- critical access;
- budget constraints;
- legitimate public-policy priorities.

## Why Medellín

Medellín is not a city with no risk intelligence.

It already has:
- official hazard information;
- SIATA hydrometeorological monitoring/early warning;
- participatory early-warning research such as Inform@Risk;
- published work on cost-effective prioritization of landslide early-warning instrumentation.

That is precisely why OUREA focuses on the **next decision layer**:

> **From risk intelligence to adaptation investment intelligence.**

## The solution

OUREA is an AI-driven climate-adaptation decision sandbox with two scales.

### 1. Screen the city

Ourea screens Medellín barrios using:
- official mass-movement hazard coverage;
- official Medellín/DANE 2026 population projections;
- official 2023 socioeconomic IMCV/AMPI conditions.

Users can switch between:
- Exposure;
- Balanced;
- Equity.

The screen is explicitly a **shortlisting proxy**, not a dynamic climate prediction or investment recommendation.

IMCV/AMPI and stratum-1 share do not equal community participation. Ourea records community evidence as safeguards, not as a predicted acceptance score. Moravia is a learning case for territorial attachment and livelihoods; Llanaditas remains the proving ground.

### 2. Test action in a detailed proving ground

Upper Comuna 8 / Llanaditas–El Faro.

The 3D sandbox uses:
- 1 m municipal terrain;
- cadastral buildings;
- official hazard;
- official access network;
- socioeconomic stratum;
- DANE population planning proxy.

Current sandbox:
- 1,588 buildings;
- ~4,057 people planning proxy;
- 1,445 buildings intersecting official high hazard;
- 1,540 buildings assigned stratum 1;
- median slope ~25.4°.

## Interventions

Ourea tests only three physical adaptation families:

1. **Rainwater harvesting**
   - roof runoff capture;
   - directly reports potential captured volume;
   - does not pretend the runoff-to-landslide-benefit link is already calibrated.

2. **Drainage / water management**
   - current opportunity is a corridor/exposure proxy;
   - not drainage-capacity simulation.

3. **Restoration / soil bioengineering**
   - uncertain effect;
   - site-dependent;
   - explicit maturity delay.

## Why AI is necessary

The AI is the **decision engine**, not a chatbot.

The search space contains:
- many intervention-location candidates;
- multiple intervention families;
- budget constraints;
- uncertain climate futures;
- uncertain intervention effects;
- equity/access policy preferences;
- diminishing returns when interventions overlap.

The Ourea engine:
- evaluates portfolios across uncertainty ensembles;
- uses marginal robust benefit rather than additive ranking;
- penalizes downside;
- applies transparent policy weights;
- generates multiple robust policy options;
- reports project-selection stability;
- evaluates budget robustness;
- exposes sampled multi-objective trade-offs;
- is independently cross-checked with a binary MILP.

## Four robust policy options

Instead of hiding political choices inside one “optimal” plan, OUREA can show:
- Balanced;
- Equity-first;
- Access-first;
- Low-regret.

The UI highlights **highest P10** in the current ensemble, not “the correct plan”.

At the current 10-credit checkpoint, Low-regret produces the strongest lower-tail P10 while using four projects instead of six.

Ourea also exposes **policy consensus**: in the current checkpoint, cell 35 RWH and cell 35 drainage are selected by all four named policy lenses. That is shown as cross-policy decision stability, not universal optimality.

These numbers are planning benefit proxies, not calibrated impact estimates.

## Explainability

For each selected project, the user can inspect:
- intervention opportunity;
- equity exposure share;
- access relevance;
- mean marginal benefit;
- P10 marginal benefit;
- robust value per credit;
- how often it remains selected under uncertainty resampling;
- which assumptions could change the recommendation.

## What is innovative

OUREA is not:
- another landslide predictor;
- another early-warning system;
- another generic 3D digital twin;
- an LLM wrapper.

The innovation is:

> **robust adaptation portfolio decision intelligence under uncertainty, grounded in a real city workflow and explicitly separating evidence from assumptions.**

## Observed climate context

Ourea ships a CHIRPS v3 Final climatology for the Llanaditas / upper Comuna 8 cell (1991–2020, plus a 1981–2024 record summary). Typical, high and extreme planning presets are observational percentiles, not arbitrary millimetres.

CHIRPS is a 0.05° gridded estimate. It is not station intensity, not a real-time forecast and not landslide probability.

Optional SIATA station ingest remains a local-intensity comparison tool. It is not required to use Ourea.

## Evidence / anti-fake-precision design

Every major layer is labeled as:
- observed / official;
- official projection;
- planning proxy;
- derived screening proxy;
- observed gridded climatology;
- explicit planning prior;
- planning-credit budget unit.

Current optimizer costs remain planning credits. The decision brief reports a pre-feasibility US$ envelope without putting currency into the objective.

Ourea now has a real local RWH procurement budget ceiling anchor, but deliberately does not transfer that value blindly into Comuna 8.

## Scalability

Medellín is the proving ground, not the product boundary.

Transferable modules:
- city screening adapter;
- hazard/terrain/building/exposure adapter;
- climate-driver adapter;
- intervention evidence library;
- robust portfolio engine;
- policy profiles;
- evidence/provenance framework;
- auditable decision export.

## Expected real-world benefit

A six-month pilot would test whether OUREA helps city/community/technical users:
- compare adaptation portfolios faster;
- see uncertainty rather than hide it;
- identify stable vs assumption-sensitive project choices;
- understand equity/access trade-offs;
- identify where engineering/geotechnical follow-up is still required;
- move from risk information toward an implementable adaptation shortlist.

## 6-month pilot

See `docs/pilot/six-month-pilot.md`.

## Scientific guardrails

Do not interpret current outputs as:
- landslide probability;
- people saved/protected;
- avoided economic loss;
- exact current population;
- engineering design;
- drainage capacity;
- COP investment recommendation;
- exhaustive Pareto optimality.

## Closing

**Don’t just show me where climate risk is. Let me test what Medellín can do about it.**
