# Ourea — final local QA checklist

The automated tests cover model/data consistency. This checklist covers browser/build behavior that the container cannot fully verify.

## 1. Install / test / build

On Windows, extract the final ZIP and run:

```bat
run_windows.bat
```

Expected sequence:
1. `npm install`
2. `npm test`
3. `npm run build`
4. `npm run dev`

Any failure before `npm run dev` is blocking.

## 2. Browser console

Open DevTools.

- [ ] no uncaught exceptions;
- [ ] no failed required GeoJSON/JSON requests;
- [ ] no MapLibre layer/source errors;
- [ ] terrain tile requests succeed;
- [ ] climate_context.json loads locally; the app does not fetch CHIRPS at runtime.

## 3. Guided decision — area

On first load:
- [ ] city map appears;
- [ ] special/unmatched polygons appear subdued/gray;
- [ ] Balanced is the default city lens;
- [ ] 271 polygons / 248 population-matched figure appears.
- [ ] only the Area step is expanded.

Switch:
- [ ] Exposure;
- [ ] Balanced;
- [ ] Equity.

Click **Analyze Llanaditas**.

## 4. Detailed proving ground

After Analyze Llanaditas:
- [ ] true 3D terrain appears;
- [ ] buildings extrude correctly;
- [ ] Map layers popover works;
- [ ] map remains responsive.

## 5. Climate context and explore

- [ ] Observed climate context shows CHIRPS v3 Final and 1991–2020;
- [ ] Typical wet / high rainfall / extreme observed presets are selectable;
- [ ] each preset shows window, millimetres, percentile, period and source;
- [ ] Explore still lets you vary rainfall and antecedent rainfall percentile by hand;
- [ ] no text calls the metric landslide probability or soil wetness.

## 6. Manual plan

- [ ] click a planning cell;
- [ ] add RWH;
- [ ] add another valid intervention;
- [ ] duplicate project cannot be added;
- [ ] max projects/cell enforced;
- [ ] budget cannot be exceeded;
- [ ] remove a project;
- [ ] clear plan.

## 7. Robust policy options

Click **Generate robust options**.

Expected:
- [ ] four cards appear: Balanced / Equity-first / Access-first / Low-regret;
- [ ] one card has `highest P10` badge;
- [ ] current checkpoint should highlight Low-regret unless dependencies/code changed;
- [ ] policy-consensus block appears;
- [ ] cell 35 RWH and cell 35 drainage show 4/4 policy membership in current checkpoint.

Click each policy card:
- [ ] active map portfolio updates;
- [ ] TopBar policy label updates;
- [ ] P10/median/P90 align with selected plan;
- [ ] explainability diagnostics remain populated.

## 8. “Why here?”

Expand at least two selected projects.

- [ ] opportunity displayed;
- [ ] equity share displayed;
- [ ] access relevance displayed;
- [ ] mean/P10 marginal benefit displayed;
- [ ] robust value/credit displayed;
- [ ] text states recommendations can change with assumptions.

## 9. Robustness analysis

### Budget frontier
- [ ] Analyze frontier works;
- [ ] chart renders;
- [ ] no NaN/undefined;
- [ ] P10 ≤ median ≤ P90.

### Selection stability
- [ ] Analyze stability works;
- [ ] bars/frequencies render;
- [ ] wording says uncertainty-resample selection stability, not probability of optimality.

### Sampled trade-offs
- [ ] Analyze trade-offs works;
- [ ] plot renders;
- [ ] labels/rows fit within panel;
- [ ] wording says sampled non-dominated, not exact Pareto frontier.

## 10. Observed climate context

- [ ] panel shows CHIRPS v3 Final and 1991–2020;
- [ ] three observational presets are selectable;
- [ ] source link uses a title, not a raw URL;
- [ ] method disclosure is collapsed by default;
- [ ] no empty “waiting for data” panel.

## 11. Evidence panel

- [ ] official / projection / proxy / prior statuses are visually distinguishable;
- [ ] city population / IMCV / city-screen entries appear;
- [ ] guardrails remain readable.

## 12. Decision export

Click **Download PDF**.

Open the PDF and verify:
- [ ] 6–8 pages;
- [ ] US$ envelope, not planning credits;
- [ ] cell links (Ourea / Maps / Earth);
- [ ] an illustrative early-action mechanism animation, not a site-specific collapse forecast;

## 13. Responsive/browser smoke test

At minimum:
- [ ] Chrome/Chromium desktop;
- [ ] one narrower viewport;
- [ ] panel scroll works;
- [ ] no critical buttons hidden;
- [ ] map remains usable.

## 14. Demo rehearsal

Run `docs/competition/demo-script.md` with a timer.

- [ ] ≤3 minutes;
- [ ] city-scale value clear in first 30 sec;
- [ ] AI visible by ~2 minutes;
- [ ] scientific limitations mentioned once, not repeatedly;
- [ ] close with the one-line value proposition.
