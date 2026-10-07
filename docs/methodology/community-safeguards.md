# Community evidence and safeguards

Community Evidence & Safeguards is a visible evidence layer. It does **not** score social acceptance and does **not** enter the optimizer.

## Purpose

Show whether a technically robust portfolio has enough community evidence to advance.

Technically robust does not mean community-validated.

## Contract

Optional file: `frontend/public/data/community_evidence.json`

Shipped demonstration file: empty `records` and `status: "absent"`. This avoids a 404 and does **not** assert community review.

Shipped template: `frontend/public/data/community_evidence.template.json`

The template is marked `"template": true` and is **not** observed data. Empty `records` in the demonstration file means every project is `not_assessed`.

Allowed fields per cell or project:

| Field | Allowed values |
|---|---|
| `cell_id` | planning-cell integer |
| `intervention_type` | `rwh`, `drainage`, `restoration`, or omitted for cell-level notes |
| `consultation_status` | `not_assessed`, `planned`, `in_progress`, `validated` |
| `community_position` | `unknown`, `support`, `mixed`, `oppose` |
| `livelihood_disruption` | `unknown`, `low`, `medium`, `high` |
| `maintenance_capacity` | `unknown`, `low`, `medium`, `high` |
| `displacement_risk` | `unknown`, `none`, `possible`, `required` |
| `accessibility_concern` | `unknown`, `none`, `possible`, `confirmed` |
| `evidence_type` | `none`, `participatory_input`, `official_record`, `field_observation`, `research` |
| `source` | text or null |
| `as_of` | ISO date `YYYY-MM-DD` or null |
| `process_reference` | optional process or source reference; not personal data |
| `notes` | text or null |

Invalid categories in a session draft fall back to `not_assessed` / `unknown` / `none`. A **file** with the wrong schema, unknown `cell_id`, unknown intervention type, or a non-ISO `as_of` is **invalid**, not absent.

Do not record names, phone numbers, identity documents, exact addresses or other personal data.

There is no composite social score.

## Status transitions

| Condition | Portfolio status |
|---|---|
| File missing or empty `absent` sentinel | `not_assessed` |
| File malformed or schema-invalid | `invalid` |
| Any selected project has an unresolved safeguard | `requires_deliberation` |
| Every selected project is a documented `validated` review | `community_reviewed` |
| Any selected project is `planned`, `in_progress`, or `validated` without required fields | `incomplete` |
| Otherwise | `not_assessed` |

`planned` and `in_progress` never count as a completed community review.

Only `consultation_status: validated` can become “Community review recorded”, and only when:

- `evidence_type` is not `none`;
- `source` is present;
- `as_of` is a valid ISO date;
- every substantive field is other than `unknown`.

Absence of data is never treated as support, low risk or acceptance.

## Safeguards

A portfolio is marked **requires deliberation** when any selected project has:
- high livelihood disruption;
- possible or required displacement;
- possible or confirmed accessibility concern;
- recorded opposition;
- low maintenance capacity.

Ourea does not discard the project, convert opposition into a cost, or recommend resettlement.

## Relation to the optimizer

In this version:
- community categories are not weights;
- there is no “Community-first” objective profile;
- rankings are not silently filtered;
- session inputs cannot change selected projects unless a person edits the plan.

During a later pilot, **only criteria that residents and authorities have agreed in public** may become explicit constraints or deliberative filters. Disagreements stay visible instead of being averaged.

## Decision package

Export schema:

```json
{
  "schema": "ourea-decision-package",
  "schema_version": 1
}
```

The package includes community validation status, file errors, participatory records for the **active portfolio only**, separate `session_history`, a privacy warning, unassessed projects, activated safeguards, unresolved concerns, provenance dates, and the guardrail that community evidence is not a prediction of acceptance.

Canonical scientific guardrails live in `frontend/src/config/scientificGuardrails.json`.
