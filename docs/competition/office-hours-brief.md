# Innovate4Cities 2026 Office Hours — OUREA brief

Official Office Hours: **19 August 2026**, listed by Innovate4Cities as the final opportunity to chat directly with expert mentors before submission.

Official page:
`https://www.innovate4cities.org/hackathon/hackathon2026/`

## 20-second project framing

> Medellín already has strong hazard mapping and early-warning capabilities. OUREA tackles the next decision: given limited budgets and uncertain rainfall, which physical adaptation interventions should a city fund first? It screens Medellín citywide, then uses a high-resolution Comuna 8 sandbox to compare rainwater harvesting, drainage and bioengineering portfolios across uncertain futures.

## What is already working

- city-scale screen using official hazard + 2026 population projection + 2023 socioeconomic index;
- real 1 m Medellín terrain;
- 1,588 cadastral buildings in the detailed proving ground;
- official hazard/access/stratum + DANE population proxy;
- manual portfolio builder;
- four transparent robust policy options;
- Monte Carlo P10/median/P90;
- budget robustness frontier;
- selection stability;
- sampled equity/access trade-offs;
- formal MILP cross-check;
- evidence/provenance labels;
- CHIRPS v3 Final climatology shipped offline.

## Five questions worth asking mentors

### 1. City-scale requirement

> We screen all Medellín barrios using official hazard, 2026 projected population and socioeconomic conditions, then zoom into a high-resolution neighborhood sandbox for intervention decisions. Does that two-stage workflow meet your expectation of a solution usable at city scale?

Why it matters: confirms that detailed action testing can be localized while architecture remains city-scale.

### 2. AI-driven requirement

> Our AI component is a robust decision engine rather than a chatbot: it evaluates many intervention-location combinations across uncertain climate/effectiveness futures, then exposes policy trade-offs and stable project selections. What would judges need to see to clearly recognize this as sufficiently AI-driven rather than a conventional GIS/optimization dashboard?

Why it matters: this is the most important framing risk.

### 3. Transportation bonus

> We naturally address Informal/Marginalized Settlements. We also include critical hillside access as a decision objective, but we do not simulate traffic. Would that meaningfully qualify as Transportation, or is it better to keep Transportation secondary rather than force the bonus category?

Why it matters: avoids overclaiming a bonus area.

### 4. Transparent uncertainty vs precise-looking impact

> At prototype stage, would judges prefer transparent P10/median/P90 and explicit development priors over a more precise impact estimate built on assumptions that are not yet locally calibrated?

Why it matters: validates our anti-fake-precision strategy.

### 5. Differentiation

> Medellín already has SIATA, Inform@Risk and published work prioritizing early-warning instrumentation. We position OUREA as adaptation-investment intelligence for physical interventions rather than another warning system. Is that distinction clear and compelling enough for the Innovation criterion?

Why it matters: tests the core selling point.

## If there is time for only one question

Ask #2 — **what evidence/behavior makes the robust optimizer clearly AI-driven to judges?**

## Do not spend mentor time on

- UI colors;
- coding stack;
- exact React/MapLibre architecture;
- asking whether 3D is innovative;
- generic “do you like our idea?” questions.

## What to listen for

Capture exact mentor wording on:
- city-scale expectation;
- AI definition;
- bonus-action interpretation;
- acceptable prototype uncertainty;
- what finalists most often fail to demonstrate.

Those answers should change the deck/demo if necessary.
