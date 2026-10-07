# Ourea

Soporte de decisión para la adaptación climática territorial.

Ourea ayuda a CORNARE a elegir un portafolio de medidas para Rionegro, Guarne y Marinilla con un fondo simulado de **COP 5.000 millones**, y a revisar si esa elección se sostiene bajo el escenario **SSP3-7.0 hacia 2060**.

La pregunta del reto es dónde intervenir primero, con qué medida, a qué costo, qué queda por fuera y qué dato faltante cambiaría la decisión.

## Qué es, y qué no calcula

Ourea es un prototipo de priorización, asignación de presupuesto, prueba de robustez y seguimiento. Usa el estudio de riesgo que CORNARE ya tiene.

No es un modelo climático, un modelo de inundación, un sistema de alerta ni un cálculo nuevo de riesgo. No informa un porcentaje de riesgo evitado, pérdidas evitadas ni dependencias entre empresas, vías, fuentes o proveedores. Esas dependencias aparecen como brechas de información.

## Alcance

- Municipios: Rionegro, Guarne y Marinilla.
- Región: Valles de San Nicolás, jurisdicción de CORNARE, Antioquia.
- Fondo: 5.000 millones de pesos. Cada medida del catálogo es indivisible. No es obligatorio gastar todo el fondo.
- Catálogo: 15 medidas tomadas del reto, con un costo de referencia que suma 18.900 millones.

## Tres productos

1. Tablero de decisión territorial, con cinco hallazgos.
2. Portafolio priorizado, con municipio o corredor, costo, actores, orden, clase de solución basada en la naturaleza y comportamiento bajo SSP3-7.0.
3. Riesgo residual, brechas de información e indicadores de monitoreo, evaluación y aprendizaje.

## Cómo decide

La regla institucional, visible en la aplicación:

- 70% clase de vulnerabilidad de la dimensión y del municipio donde se sitúa la medida.
- 15% recurrencia de la medida en el reporte municipal, solo si ese municipio tiene al menos cinco registros.
- 15% de talleres municipales queda sin calificar: el paquete no trae esos conteos.
- La segunda medida en la misma dimensión conserva 35% del término de vulnerabilidad, para no contar varias veces la misma clase.
- Se enumeran las combinaciones y se rechaza cualquiera que pase de 5.000 millones.

La lente de naturaleza positiva no vuelve óptima una medida por ser de naturaleza. Solo desempataría portafolios con el mismo puntaje. La obra gris de 2.500 millones se muestra como alternativa para ver qué desplaza.

El detalle, los pesos y el portafolio que produce la regla están en [docs/climaterisk/decision_methodology.md](docs/climaterisk/decision_methodology.md).

## Soluciones basadas en la naturaleza

Las medidas se clasifican como naturaleza, híbrida, habilitadora o gris, con el Estándar Global de la UICN como guía conceptual y sin certificar proyectos. Ver [docs/climaterisk/nature_based_solutions.md](docs/climaterisk/nature_based_solutions.md).

## SSP3-7.0

No se simula el clima. El reto cuantifica un solo cambio: el riesgo de desastres de Rionegro pasa de 0,28 (Bajo) a 0,32 (Medio) hacia 2060. Ourea vuelve a resolver el portafolio con ese escalón. Si el conjunto no cambia, el estado es **mayormente robusta**, porque las demás dimensiones no tienen serie de escenario.

## Evidencia

Cada valor crítico se marca como dato institucional, inferencia del equipo, supuesto o información faltante. Un registro ausente no se convierte en cero. Las toneladas de CO2e de los reportes de mitigación no entran al puntaje.

## Datos

Los archivos crudos de CORNARE permanecen en `CLIMATERISK/` en la máquina local y no se modifican. El preprocesamiento escribe JSON en `frontend/public/data/cornare/`.

```bash
python scripts/climaterisk/build_cornare_dataset.py
python scripts/climaterisk/validate_inputs.py
```

La auditoría de hojas, duplicados y límites está en [docs/climaterisk/data_audit.md](docs/climaterisk/data_audit.md). Las fuentes externas usadas, con fecha de acceso, están en [docs/climaterisk/source_registry.md](docs/climaterisk/source_registry.md).

Los límites municipales salen del Marco Geoestadístico Nacional 2025 del DANE y se guardan en el repositorio. El demo no llama un servicio de mapas.

## Motor de robustez (`decision_engine/`)

Paquete Python (solo numpy) que vuelve a calcular el mundo 0 del navegador y lo prueba en 4.000 mundos (hipercubo latino con semilla, 2.000 por escenario):
aceptabilidad de cada portafolio, puntos de quiebre (PRIM), ruta adaptativa y valor de la información. El navegador no simula: lee el JSON precalculado.

```bash
pip install -r requirements.txt          # o: uv venv && uv pip install -r requirements.txt
python -m decision_engine.build          # escribe uncertainty_ranges, lever_profiles, robustness, breaking_points y value_of_information
python -m decision_engine.build --check  # falla si el JSON versionado no coincide con una corrida nueva
```

La paridad con el motor JS (2,87 · 2,38 · 3,01 · `ourea-f92bd48d`) se prueba en `tests/test_engine_parity.py`. La capa de IA usa `decision_engine/api.py`.

## Arquitectura

Aplicación React y Vite. El cálculo del portafolio corre en el navegador, sin un servicio de inteligencia artificial. El mapa usa MapLibre solo para los tres municipios.

Recorrido: Panorama, Diagnóstico, Priorizar, Portafolio, SSP3-7.0, Riesgo residual, MEA y Exportar.

## Ejecutar

Requiere Node.js 20.19 o superior.

```bash
cd frontend
npm install
npm run dev
```

Pruebas y build:

```bash
cd frontend
npm test
npm run build
```

Python 3.12:

```bash
pip install -r requirements.txt
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/climaterisk/validate_inputs.py
```

En Windows, `qa_windows.bat` recorre esas comprobaciones.
