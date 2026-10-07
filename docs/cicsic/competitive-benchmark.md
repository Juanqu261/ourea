# Competitive benchmark (legacy pointer)

The 12-trial artifact `data/derived/competitive_benchmark.json` is **superseded** for CICSIC headlines.

Use instead:

- Protocol: `docs/cicsic/benchmark-protocol.md`
- Audit: `docs/cicsic/benchmark-audit.md`
- Results: `data/derived/cicsic_redteam_benchmark.json`
- Headlines: `docs/cicsic/headline-metrics.md`
- Freeze: `docs/cicsic/evidence-freeze.md`

```bash
node scripts/run_cicsic_redteam.mjs --mode smoke   # 100 trials
node scripts/run_cicsic_redteam.mjs --mode full    # 500 trials
node scripts/plot_cicsic_figures.mjs
```

Paired evaluation is mandatory: within each trial, all strategies share one evaluation ensemble seed.
