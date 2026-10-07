# CICSIC frontend UX audit

Audit date: 2026-09-13. Scope: Medellín + Nanjing guided six-step flow. Science/optimizer untouched.

## Product friction (both cities)

| Issue | Impact |
|-------|--------|
| Methodology visible before decisions (engine counts, P10 essay, provenance) | Judges decode jargon first |
| Long step instructions + card captions + hints stack | Map loses attention |
| Planning credits explained late and densely | Budget feels like finance |
| Generate vs manual equal visual weight | Primary path unclear |
| Review leads with footprint + engine | Robustness story buried |
| Legend / area notices repeat caveats | Warning fatigue |
| City switcher opens with research prose | Entry feels academic |

## Step classification

### Entry / city switcher
| Content | Class |
|---------|-------|
| Brand + one-line purpose | ESSENTIAL |
| Medellín / Nanjing cards + role | ESSENTIAL |
| Hierarchy blurb (1 line) | SECONDARY |
| Portability comparison table | ADVANCED |
| Full dataset essay | REMOVE from default |

### Step 1 — Where
| Content | Class |
|---------|-------|
| Question + analyze CTA | ESSENTIAL |
| Screening lens cards (short) | ESSENTIAL |
| Top list + map highlight | ESSENTIAL |
| Lens weight formula | ADVANCED |
| Intro notice / grid discretization essay | SECONDARY → details |
| Population match metrics | SECONDARY |

### Step 2 — Conditions
| Content | Class |
|---------|-------|
| Three rainfall cards (short) | ESSENTIAL |
| Budget slider + “relative budget” | ESSENTIAL |
| Percentile / CHIRPS / method | ADVANCED |
| Adjust manually | SECONDARY |

### Step 3 — Priorities
| Content | Class |
|---------|-------|
| Policy cards (what it prioritizes) | ESSENTIAL |
| Weight math (`how`) | ADVANCED |

### Step 4 — Plan
| Content | Class |
|---------|-------|
| Generate plan (primary) | ESSENTIAL |
| Build manually (secondary) | ESSENTIAL |
| Candidate / scenario counts | ADVANCED |

### Step 5 — Compare / Review
| Content | Class |
|---------|-------|
| Recommended plan + Expected / Downside / Robustness | ESSENTIAL |
| Baseline ↔ With plan map control | ESSENTIAL |
| Numeric P10/Median/P90 | SECONDARY (labels plain + technical) |
| Decision-engine bullets | ADVANCED |
| Footprint proxy disclaimer | ADVANCED |
| Advanced analysis / AI review | ADVANCED |

### Step 6 — Review / next
| Content | Class |
|---------|-------|
| Download briefing CTA | ESSENTIAL |
| Evidence / community / alignment | SECONDARY → drawers |
| Mechanism animation essay | SECONDARY |

## Mental model target

```text
RISK / CONDITIONS → WHERE → WHAT TO BUILD → ROBUST PLAN → WHAT CHANGES
```

Default UI = decisions. Methodology = How was this calculated? / Evidence / Advanced.
