# Capa de IA

Fecha: 2026-10-07. Plan: `AI_AGENTS_PLAN.md` (v2, Python · LangChain · LangGraph).

La IA no decide. El motor (`decision_engine/`) calcula; los agentes leen sus salidas, las explican y las auditan. Todo lo determinista funciona sin llave.

## Capas

| Capa | Ruta | Llave | Qué hace |
|---|---|---|---|
| Herramientas | `POST /api/tools/{name}` | no | Las 10 herramientas del contrato, con el sobre `{ result, evidence_labels, sources, warnings, fingerprint }` |
| Auditoría | `POST /api/audit` | no | Revisa P1, P2 y P3 de la exportación y bloquea con un hallazgo crítico |
| Copiloto | `POST /api/agents/copilot` (SSE) | sí | «Pregúntale a la decisión» |
| Entrevista | `POST /api/agents/interview/{start,answer}` | sí | Demo SINTÉTICA: qué preguntar primero y cuándo dejar de preguntar |
| Auditor LLM | `POST /api/audit?llm=true` | sí | Suma vocabulario (amenaza ≠ vulnerabilidad ≠ riesgo) y competencias por actor |

`GET /api/health` informa `ai_enabled` y las herramientas pendientes.

## Herramientas

`engine/adapter.py` es el único módulo que importa `decision_engine.api`. Si una función del motor falta, la herramienta devuelve `engine_pending:<nombre>` y ninguna cifra.

| Herramienta | Responde |
|---|---|
| `get_context` | municipios, clases, medidas, brechas |
| `search_portfolios` | mejor portafolio en el Mundo 0 o con supuestos cambiados, `force` / `exclude` |
| `explain` | términos del puntaje de una medida y su valor de cambio |
| `compare_portfolios` | dos portafolios: costo, puntaje, arrepentimiento, casi óptimo en X% de los mundos |
| `price_of_constraint` | puntaje perdido al exigir o excluir medidas (`score_loss_pct` lo calcula el motor) |
| `run_robustness` · `breaking_points` · `value_of_information` · `switching_value` | análisis A–D del motor |
| `get_spatial_context` | capas de contexto de una medida; `exact_location` siempre «Por definir», siempre `gap-sites` |

Cada llamada queda en `services/decision_ai/var/logs/calls-<fecha>.jsonl` (`ts, run_id, agent, tool, input, fingerprint, output_sha`). `var/` no se versiona.

## Copiloto

```
guard_input ─┬─ pregunta prohibida ─► rechazo con plantilla (sin herramientas)
             ├─ pedido de escritura ─► rechazo
             ├─ «¿dónde exactamente?» ─► «Por definir» + gap-sites + enfoque del mapa
             └─► agente ⇄ herramientas (máx. 6) → compose → verify ─┬─ pasa ─► respuesta
                                                        ▲          ├─ falla 1 ─► compose con los errores
                                                        └──────────┘─ falla 2 ─► respaldo: solo hechos de las herramientas
```

`agents/shared/verify.py` (sin LangChain, compartido con el auditor) exige:

1. Cada número de `respuesta` (es-CO: `2,81`, `5.000`, `4.800M`, `−15 %`) está declarado en `cifras`.
2. Cada `cifra.valor` está en una salida de herramienta de esta corrida, con la misma `huella`. Una cifra calculada por el modelo falla.
3. Etiquetas permitidas; una cifra de un campo exploratorio exige «Exploratorio».
4. Brechas, fuentes y medidas existen.
5. Ninguna afirmación de `audit/forbidden_claims.json` (lista única con el auditor).
6. Máximo 120 palabras.

La respuesta trae `enfoque_mapa`; la aplicación lo pasa a `focusForMeasure`.

## Entrevista de dependencias

El orden lo pone el valor de la información (`gaps.dependency`, por distancia de cambio). Una brecha se pregunta mientras su razón de cambio (1 + distancia) sea a lo sumo `OUREA_FLIP_THRESHOLD` (supuesto, 2,0×). Con los datos actuales se preguntan agua (×1,35) y proveedores (×1,43); trabajadores (×2,25), energía (×2,75) y vía (×3,75) quedan fuera con la frase «Ninguna brecha restante puede cambiar la decisión».

- La pregunta no lleva números ni nombres de empresa; si el modelo los pone, se usa una plantilla. Siempre dice «solo datos agregados».
- Un valor extraído que no está literalmente en la respuesta queda en `null`.
- Organización sintética → `provenance: synthetic_demo`. Una respuesta con `S.A.S.`, `S.A.`, `Ltda` o NIT no se guarda.
- Las respuestas **no** vuelven a puntuar el portafolio.

## Auditor

`frontend/src/cornare/products.js` arma P1 (tablero y cinco hallazgos), P2 (portafolio, SSP3-7.0, infraestructura gris, s\*) y P3 (riesgo residual y brechas) como afirmaciones `{ text, numbers, label, source_id | fingerprint }`. La exportación JSON las lleva en `audit_bundle`.

Crítico (bloquea la exportación): cifra no verificable, cifra sin etiqueta, afirmación prohibida, fuga de la demo sintética, empresa identificable, huella `fixture-`. Mayor: «Dato institucional» con fuente no oficial, capa de mapa usada como sitio, confusión de vocabulario (LLM). Menor: competencia de actor (LLM, `actor_competencies.json`, inferencia del equipo). El código descarta un hallazgo del LLM cuya cita no sea literal.

En el paso de Seguimiento, la insignia dice «0 hallazgos críticos · N afirmaciones verificadas». En Pages: «Auditoría disponible con el servicio local».

## Ejecutar

```bash
uv venv .venv --python 3.12
uv pip install -r requirements.txt -r requirements-ai.txt   # CI también usa uv
cp .env.example .env            # OUREA_AI_ENABLED=1 y OPENAI_API_KEY para los agentes
uv run uvicorn services.decision_ai.app:app --port 8787 --env-file .env
cd frontend && npm run dev      # VITE_OUREA_AI_API_URL=http://127.0.0.1:8787/api
```

- `uv run python -m services.decision_ai.audit <export.json>`: QA sin llave; sale con 1 si hay un crítico.
- `uv run python -m services.decision_ai.ask "pregunta" ["seguimiento"]`: copiloto por consola.
- `uv run python -m services.decision_ai.eval`: evaluación en vivo con las 20 preguntas de `tests/fixtures/ai/copilot_questions.jsonl` (trampas incluidas). Pasa si verifica en dos intentos, llama la herramienta esperada y rechaza las trampas.

Las pruebas (`tests/test_ai_*.py`) usan un modelo con guion y no necesitan red ni llave.

## Diferencias con el plan

- **El motor ya está en `main`.** `decision_engine/api.py` expone las nueve funciones, así que no hay `bridge.mjs` ni herramientas pendientes. La paridad JS ↔ Python del Mundo 0 ya la cubre `tests/test_engine_parity.py`.
- **Cifras del Mundo 0:** el puntaje institucional es 2,8125 (antes 2,87) con costo 5.000 (antes 4.800), por los pesos publicados de CORNARE. Con infraestructura gris forzada sigue en 2,38.
- **`affected_intervention_ids` y la etiqueta Exploratorio** ya existían; no hubo que añadirlos.
- **`MEASURE_LAYERS`** sigue en `cornare/map/focus.js`. El adaptador tiene una copia y una prueba falla si se separan. Moverla a `catalog.json` exige volver a descargar las capas con `build_spatial_context.py`.
- **Productos P1–P3:** se tomaron de «Tres productos» del README, porque `SOLUTION_GUIDE.md` no está en el repositorio.
- No se hizo lo marcado *Could*: servidor MCP y extractor de documentos.
