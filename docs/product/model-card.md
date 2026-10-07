# Ourea — model card

## Intended purpose

OUREA is **adaptation decision support** for vulnerable urban hillsides.

It is designed to help ask:

> Which physical adaptation portfolios remain useful across uncertain climate/effectiveness assumptions and explicit public-policy priorities?

## Not intended for

Ourea is not:
- a landslide early-warning system;
- a replacement for SIATA;
- a geotechnical design package;
- a building-level failure-probability model;
- an autonomous investment authority;
- an evacuation-routing simulator;
- a community-acceptance predictor;
- an automatic resettlement recommender;
- a chatbot that replaces the optimizer or approves construction.

## Model status

`planning-priors-explicit`

Stable spatial inputs are real/official or explicitly derived from official sources. Rainfall contexts are anchored in CHIRPS v3 Final.

Intervention-effect ranges, **internal** planning-credit costs and decision weights remain explicit planning assumptions. The decision brief additionally shows a pre-feasibility **US$** envelope that is not an offer, contract or engineering estimate.

## City screening

Ourea city screening combines:
- official hazard coverage;
- official 2026 population projections;
- official 2023 comuna-level IMCV/AMPI.

Limitations:
- population is assumed uniformly distributed inside each barrio for hazard-exposure screening;
- IMCV is comuna-level, not barrio-level;
- screen is static, not dynamically SIATA-driven.

See `docs/methodology/city-screen.md`.

IMCV/AMPI and stratum-1 share are planning proxies. They are not community participation. Moravia is a learning case for safeguards, not a proving-ground target. See `docs/research/case-studies/moravia.md`.

## Detailed exposure

The sandbox population is a DANE census-based planning proxy allocated to buildings.

It is not a current household census.

## Dynamic Climate Stress

Current controls:
- rainfall accumulation context from CHIRPS v3 Final observational percentiles;
- antecedent rainfall percentile;
- planning-year restoration maturity.

These are planning rainfall contexts, not SIATA return periods, not calibrated storm classes, and not landslide probability.

A local SIATA series, if supplied, is an optional intensity comparison. It is not required to use Ourea.

## Intervention families

### Rainwater harvesting
Directly modeled quantity:
- potential captured roof runoff under storage/participation assumptions.

Not yet calibrated:
- captured water → slope-risk benefit.

### Drainage / water management
Current opportunity uses a mapped corridor proxy.

It is not drainage capacity.

### Restoration / soil bioengineering
Current model includes uncertain effect + maturity delay.

It is not instant deterministic stabilization.

## Uncertainty

Ourea separates:
1. climate uncertainty;
2. intervention-effect uncertainty.

Common-random-number design is used for comparative evaluation.

## Public-policy profiles

### Balanced
Default exposure-reduction lens with modest equity/access emphasis.

### Equity-first
Stronger weight on stratum-1 exposure.

Local limitation: the detailed sandbox is already overwhelmingly stratum 1, limiting the granularity of this proxy.

### Access-first
Stronger weight on mapped access relevance.

### Low-regret
Stronger penalty on lower-tail uncertainty.

These profiles are not moral/scientific truths. They exist to make policy preferences inspectable.

## Sampled trade-offs

Ourea samples equity/access weights and returns non-dominated portfolios among those samples.

This is not an exhaustive mathematical Pareto frontier.

## Formal cross-check

An independent binary MILP uses linearized robust coefficients and exact budget/cell constraints, then re-evaluates selected portfolios with nonlinear multiplicative effects.

## Cost

The optimizer budget is planning credits. The decision brief reports a low/base/high US$ envelope from versioned TRM, IPC and local comparators. Drainage corridor length is a named 40/60/80 m scenario until surveyed. Restoration is a project-scale package, not USD/m².

## Prohibited interpretations

Do not describe Ourea outputs as:
- landslide probability;
- expected casualties;
- people saved/protected;
- avoided monetary losses;
- exact current population;
- engineering design;
- drainage capacity;
- COP investment recommendation;
- exhaustive Pareto optimality;
- probability of true project optimality.

## Human oversight

Final decisions remain with:
- responsible public authorities;
- affected communities;
- engineering/geotechnical professionals;
- environmental/planning authorities.

## Validation path

1. CHIRPS v3 Final observational climatology as shipped climate context;
2. optional SIATA station comparison if a city supplies a series;
3. additional historical events only when independently verified;
4. local intervention-effect distributions;
5. comparable cost distributions;
6. stakeholder policy-weight co-design;
7. structured pilot user testing;
8. community co-design of safeguards without inventing social scores.
