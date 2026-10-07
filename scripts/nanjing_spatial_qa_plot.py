#!/usr/bin/env python3
"""Developer spatial-alignment diagnostic figure for Nanjing layers."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "derived" / "nanjing"
BBOX = (118.88, 32.075, 118.97, 32.145)


def main() -> int:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.patches import Rectangle
    except ImportError:
        print("matplotlib unavailable; writing text QA only")
        return 0

    cells = json.loads((ROOT / "frontend/public/data/nanjing/planning_cells.geojson").read_text(encoding="utf-8"))
    qa = json.loads((OUT / "spatial_alignment_qa.json").read_text(encoding="utf-8"))
    features = cells["features"]
    lons = [f["properties"].get("mean_elevation_m") for f in features]  # placeholder
    xs = [f["geometry"]["coordinates"][0][0][0] + 0.005 for f in features]
    ys = [f["geometry"]["coordinates"][0][0][1] + 0.005 for f in features]
    pop = [f["properties"]["population_proxy"] for f in features]
    built = [f["properties"].get("built_up_fraction") or f["properties"].get("built_up_share") or 0 for f in features]
    stress = [f["properties"]["drainage_stress_proxy"] for f in features]
    elev = [f["properties"]["mean_elevation_m"] for f in features]

    fig, axes = plt.subplots(2, 2, figsize=(10, 9), constrained_layout=True)
    panels = [
        (axes[0, 0], elev, "Mean elevation (m) — Skadi", "viridis"),
        (axes[0, 1], pop, "WorldPop 2026 population estimate", "YlOrRd"),
        (axes[1, 0], built, "Built-up fraction — WorldCover", "Greys"),
        (axes[1, 1], stress, "Drainage-stress screening proxy", "RdYlBu_r"),
    ]
    west, south, east, north = BBOX
    for ax, vals, title, cmap in panels:
        sc = ax.scatter(xs, ys, c=vals, s=70, cmap=cmap, edgecolors="k", linewidths=0.3)
        ax.add_patch(Rectangle((west, south), east - west, north - south, fill=False, edgecolor="navy", lw=1.2))
        ax.set_xlim(west - 0.005, east + 0.005)
        ax.set_ylim(south - 0.005, north + 0.005)
        ax.set_aspect("equal")
        ax.set_title(title, fontsize=10)
        ax.set_xlabel("lon")
        ax.set_ylabel("lat")
        fig.colorbar(sc, ax=ax, shrink=0.8)

    fig.suptitle(
        "Nanjing / Xianlin spatial alignment QA (developer evidence)\n"
        f"CRS EPSG:4326 · AOI {BBOX} · qa_all_pass={qa.get('all_pass')}",
        fontsize=11,
    )
    out_path = OUT / "spatial_alignment_qa.png"
    fig.savefig(out_path, dpi=140)
    plt.close(fig)
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
