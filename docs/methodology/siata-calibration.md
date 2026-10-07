# Ourea — optional SIATA station comparison

Ourea’s shipped climate context is CHIRPS v3 Final. See `docs/methodology/climate-context.md`.

This page documents an **optional** local rain-gauge comparison. It is not a missing product feature and not a real-time warning pipeline.

## What the adapter does

```bash
python scripts/siata_ingest.py <raw.csv>
```

The adapter:
- auto-detects common timestamp/rain/station columns or accepts explicit mappings;
- supports explicit incremental or cumulative rain-gauge mode;
- does not guess gauge semantics;
- preserves missing rain as missing rather than false zero;
- rejects/records physically invalid negative increments;
- regularizes the time axis;
- calculates rolling-window data coverage;
- writes `siata_quality_report.json`.

Target features, when a series is supplied:
- rain increment;
- 1 h / 6 h / 24 h / 3 d / 7 d / 15 d accumulations, with coverage fields.

`siata_event_diagnostics.py` summarizes observed rainfall around a caller-supplied verified event timestamp. It does not calibrate a landslide predictor.

## Why this stays optional

Station intensity can complement a 0.05° gridded climatology. It cannot replace the need to keep CHIRPS uses honest: planning contexts, not parcel-level triggering thresholds.
