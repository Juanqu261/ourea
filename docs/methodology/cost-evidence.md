# OUREA — local cost evidence ladder (Ourea)

**Status:** local evidence defines intervention typologies and a **pre-feasibility US$ envelope** for the decision brief. It is **not** strong enough to replace planning credits in the optimizer.

The key rule remains: do not divide a heterogeneous project budget by an arbitrary length/area/system count and call the result a transferable unit cost.

## 1. Rainwater harvesting

### Medellín / Comuna 1 — exact local technical specification

A 2025 Fundación Universidad de Antioquia procurement document specifies **130 rainwater systems**. Each system includes, among other items:

- 3-inch PVC conveyance;
- up to 10 m of gutter/canaleta;
- fittings;
- debris filter mesh;
- **250 L rainwater storage tank**;
- garden tap;
- PVC cleaner/adhesive;
- metal support/base;
- installation labor;
- work-at-height/internal transport requirements;
- user instructions/labeling;
- transport to each dwelling.

The document explicitly says **130 rainwater tanks/systems must be supplied and installed**.

Source:  
`https://www.fundacionudea.com/sitio/img/Documentos%20referencia%202/Segunda_Invitaci%C3%B3n_FUDEA_C1_HOGA.pdf`

**Ourea use:** this is now the preferred local *technical intervention archetype* for household RWH.

**Still missing:** the corresponding awarded/evaluated economic line that isolates the 130-system RWH component.

---

### Medellín / San Sebastián de Palmitas — exact RWH budget component

A separate 2025 evaluation document gives the official budget ceiling for a sustainable-households package:

- total: **COP 637,227,746**
- rainwater systems sub-budget: **COP 75,935,360**

Source:  
`https://www.fundacionudea.com/sitio/img/Documentos%20Referencia/Adendas/Evaluaciones/1.%20evaluacio%CC%81n%20a%20participar_c50-%20hogares.pdf`

**Ourea use:** confirms that rainwater systems are budgeted as a distinct local procurement component.

**Critical guardrail:** the document does not state the system quantity in the same evidence record. Do **not** divide COP 75,935,360 by the 130 systems from the Comuna 1 procurement; those are different procurement contexts.

---

### Comuna 8 relevance

Medellín's SEFFIP portal lists a 2025 Comuna 8 activity for **captación de aguas lluvias**, associated with contract **4600105177 of 2025** and Universidad de Antioquia / environmental programming.

Source:  
`https://ppaunclic.medellin.gov.co/reportes/proyectos/`

**Ourea use:** validates that rainwater capture is not an imported intervention idea; it is already present in the target commune's public/community adaptation landscape.

## 2. Drainage / hydraulic / water-management scale

Official Medellín 2026 projects provide contemporary local scale references:

| Reference | Reported scope | Reported budget | Naive normalization* |
|---|---:|---:|---:|
| Altavista | 550 m concrete hydraulic intervention | COP 13.485 B | ~COP 24.5 M/m |
| El Pelón | 98 m stepped cover + inspection chambers | COP 2.681 B | ~COP 27.4 M/m |
| La Cabuyala | 35 m cover + public-space works | COP 1.285 B | ~COP 36.7 M/m |
| La Chorrera | bioengineering + 100 m box culvert + receiving channel + networks | COP 4.961 B | ~COP 49.6 M/reported m |
| La Honda | 298 m hydraulic component | COP 12.000 B hydraulic component | ~COP 40.3 M/m |
| La Aguadita, Comuna 8 | 90 m retaining wall + pedestrian bridge | COP 3.092 B | ~COP 34.4 M/reported m |

\*These ratios are **descriptive scale references only**. They are not comparable engineering unit prices because project scopes differ.

Sources:
- `https://www.medellin.gov.co/es/sala-de-prensa/noticias/medellin-inicia-el-2026-con-seis-nuevas-obras-hidraulicas-en-ejecucion-y-el-reto-de-intervenir-91-quebradas/`
- `https://www.medellin.gov.co/es/sala-de-prensa/noticias/la-alcaldia-de-medellin-acelera-obras-de-mi-rio-mis-quebradas-para-mitigar-inundaciones-y-recuperar-espacio-publico/`
- `https://www.medellin.gov.co/es/sala-de-prensa/noticias/mi-rio-mis-quebradas-avanza-con-el-93-de-ejecucion-de-obras-en-la-quebrada-la-honda-en-el-nororiente-de-la-ciudad/`

Machine-readable descriptive table:  
`data/derived/local_infrastructure_cost_scale.csv`

### What this tells us

The rough normalized figures span approximately **COP 24–50 million per reported metre** even before correcting for radically different scopes. That spread is evidence **against** pretending there is one drainage unit cost.

Ourea therefore does **not** multiply those ratios by 40/60/80 m. Comparable 2026 packages with reported length 35–100 m (La Cabuyala, El Pelón, La Chorrera) are treated as **ROM hillside corridor packages**. Each selected drainage cell is one package. That is a conservative planning scenario, not a bill of quantities: adjacent selected cells may later consolidate into one corridor once the field survey establishes hydraulic continuity. The envelope does not reduce the total by mere spatial adjacency. Length 40/60/80 m remains a named survey scenario, not a bill-of-quantities multiplier. SECOP II BOQ/APU lines comparable to a Llanaditas hillside drain were not recovered; until they are, the envelope stays an order-of-magnitude comparator.

Civil-works amounts use **DANE ICOCIV** (December/December 2021–2025; 2019 uses a one-year IPC bridge because ICOCIV begins December 2020 = 100). Household RWH equipment keeps **DANE IPC** because it is a consumer-goods package, not a civil-works basket. 2026 drainage comparators need no inflation.

## 3. Restoration / bioengineering

### Comuna 8 / DAGRD — local project-scale anchor

A 2019 Comuna 8 DAGRD project sheet reports:

- mitigation works: **COP 380,000,000**
- supervision: **COP 20,000,000**
- total: **COP 400,000,000**

The project explicitly includes improving stability through bioengineering / minor mitigation works.

Source:  
`https://www.medellin.gov.co/ndesarrollo/wp-content/uploads/FICHAS/C8/2019/FP/19_FP_PP_C8_DAGRD.pdf`

**Ourea use:** local project-scale evidence for the bioengineering/mitigation family.

**Do not use as:** COP/m² or COP/cell without installed quantities and scope decomposition.

## 4. Planning credits remain internal

The optimizer still uses **planning credits**, not USD or COP. Heterogeneous drainage packages, a project-scale restoration sheet without installed area, and a RWH procurement ceiling that is not an awarded Comuna 8 price are **not** a fair objective in currency.

Credits compare portfolios. They do not appear in the decision brief.

## 5. Pre-feasibility USD envelope in the decision brief

The exported PDF shows a **US$ implementation envelope** for the selected portfolio. It is generated from `frontend/public/data/cost_context.json`, built offline by `scripts/build_cost_context.py` from this registry and `data/derived/local_infrastructure_cost_scale.csv`. Runtime Ourea does not call price APIs.

Versioned FX (Banco de la República TRM, 2026-08-28, 3,144.28 COP/USD), DANE IPC for household RWH equipment, and DANE ICOCIV for civil works make the conversion reproducible. The dated TRM is a conversion assumption, not a tornado driver: Ourea does not present an unsupported ±1% FX swing as empirical sensitivity. The cost tornado is the low/base/high spread of drainage ROM packages, restoration packages and RWH systems.

| Family | Quantity basis | Low / base / high | Evidence |
|---|---|---|---|
| Rainwater harvesting | Participating systems = max(1, round(buildings × 0.25)) | US$550 / 780 / 1,200 per system | 2023 Santa Elena ceiling, IPC-normalized to 2026 (~US$782/system); not an awarded Comuna 8 price |
| Drainage | One ROM hillside corridor package per selected cell | US$408,679 / 852,659 / 1,577,786 per package | Comparable 2026 Medellín hydraulic works with reported length 35–100 m; not a transferable USD/m rate |
| Restoration | One project-scale package per selected cell | US$120,000 / 177,000 / 270,000 | ICOCIV- and TRM-normalized 2019 DAGRD Comuna 8 COP 400 million sheet; not a USD/m² rate |
| Immediate ask | Visit, survey and co-design procured before fieldwork; 30% design and BOQ priced after the survey | No present lump sum | IDB design-share guidance (5% / 7.5% / 10%) is a later pricing method, not a present lump sum |

The future implementation envelope is equipment plus ROM construction packages. Design percent is not stacked on top of a fourfold ROM spread. Community review remains a decision gate.

No figure is an offer, contract or engineering estimate.

## 6. What would change the optimizer unit

Comparable typologies with quantity, design, logistics, maintenance and uncertainty distributions would be required before replacing planning credits in the objective. The brief can already talk in US$ without pretending that comparison is fair inside the search.


## 7. Santa Elena 1,000 L ceiling (RWH anchor)

A 2023 Fundación Universidad de Antioquia procurement for **Santa Elena, Medellín** is unusually useful because the technical specification and budget align cleanly:

- **50 household rainwater systems**
- **1,000 L tank per system**
- total official budget for the household-sustainable stimuli: **COP 105,972,500**
- the household-stimulus section lists the rainwater system as the product for those 50 households
- included scope: tank, connections, support structure, installation, transport, practical user training and a minimum six-month warranty

This yields a transparent **official budget ceiling** of:

**COP 2,119,450 per installed 1,000 L system**

Sources:
- invitation/specification:  
  `https://www.fundacionudea.com/sitio/img/nvitaci%C3%B3n_2_a_participar_C90_hog.pdf`
- evaluation confirming the same official budget ceiling:  
  `https://www.fundacionudea.com/sitio/img/16.%20evaluaci%C3%B3n%20a%20participar_comuna%2090%20hogares%20y%20sector%20comercio-2023.pdf`

### Important interpretation

This is **not** an awarded market price and should not be inserted directly into the Comuna 8 optimizer.

Reasons:
- it is an official procurement **ceiling**;
- Santa Elena is a different logistical/contextual setting;
- the system is 1,000 L, while another 2025 Medellín procurement archetype uses 250 L systems;
- the current OUREA intervention is still an intervention family rather than one finalized engineering package.

What Ourea can now say defensibly is:

> Medellín procurement evidence establishes a real local order-of-magnitude anchor for installed household rainwater systems, while OUREA keeps the optimizer in planning credits until capacity, location, logistics and project typology are made comparable.

Machine-readable provenance:
`data/derived/cost_reference_registry.json`
