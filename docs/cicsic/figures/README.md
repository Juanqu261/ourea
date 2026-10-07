# CICSIC figures

Reproducible HTML charts from `scripts/plot_cicsic_figures.mjs`.

Regenerate after updating `data/derived/cicsic_*.json`:

```bash
node scripts/plot_cicsic_figures.mjs
```

All values are **planning-proxy benefit units**, not physical flood-risk reduction.

## Map UX visual QA (`map-ux/`)

Captured from the production build preview for Nanjing overview coverage + 3D detail:

| File | Capture |
|------|---------|
| `map-ux/medellin-step1.png` | Medellín Step 1 (barrio choropleth; regression) |
| `map-ux/nanjing-step1.png` | Nanjing Step 1 (full-AOI hybrid overview) |
| `map-ux/medellin-detail.png` | Medellín detailed / sandbox view |
| `map-ux/nanjing-detail-topdown.png` | Nanjing detailed top-down (buildings + cells) |
| `map-ux/nanjing-detail-3d.png` | Nanjing detailed pitched 3D massing (priority-colored) |
| `map-ux/nanjing-typical-before-plan.png` | Nanjing Typical · baseline (no plan) |
| `map-ux/nanjing-high-before-plan.png` | Nanjing High rainfall · baseline |
| `map-ux/nanjing-extreme-before-plan.png` | Nanjing Extreme · baseline |
| `map-ux/nanjing-high-after-plan.png` | Nanjing High rainfall · residual after plan |
| `map-ux/medellin-before-plan.png` | Medellín baseline |
| `map-ux/medellin-after-plan.png` | Medellín residual after plan |
