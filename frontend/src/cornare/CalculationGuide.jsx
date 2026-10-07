import { useState } from 'react';

function dec(value, digits = 2) {
  return Number(value).toFixed(digits).replace('.', ',');
}

function grouped(value) {
  return Math.round(Number(value)).toLocaleString('es-CO');
}

export function CalculationGuide({ analysis }) {
  const weights = analysis.parameters.weights;
  const budget = analysis.parameters.budget_million_cop;
  const diminish = analysis.parameters.diminishing_second_measure.institucional;
  const candidates = analysis.prepared.length;
  const selected = analysis.portfolio.measures.length;
  const hinge = analysis.hinges[0];
  const combinations = 2 ** candidates;
  const [tab, setTab] = useState('formula');

  return (
    <div className="calc-guide" data-testid="calc-guide">
      <h2>Modelo determinístico de decisión</h2>
      <p>
        Ourea evalúa medidas discretas bajo un presupuesto fijo.
        No usa simulación ni probabilidades para seleccionar el portafolio institucional.
      </p>
      <div className="calc-tabs" role="tablist" aria-label="Explicación del modelo">
        <button type="button" role="tab" aria-selected={tab === 'formula'} onClick={() => setTab('formula')}>Fórmula</button>
        <button type="button" role="tab" data-testid="calc-tab-path" aria-selected={tab === 'path'} onClick={() => setTab('path')}>Cómo se llegó a esta decisión</button>
      </div>

      {tab === 'formula' && <section id="calc-formula">
        <h3>Qué se optimiza</h3>
        <p>
          El objetivo es el conjunto de medidas que maximiza el puntaje institucional verificado
          y cabe en el fondo. Cada medida entra completa o no entra.
        </p>

        <h3>Puntaje verificado de una medida</h3>
        <p className="equation" data-testid="calc-equation">
          S<sub>i</sub><sup>ver</sup> = {dec(weights.vulnerability)} · V<sub>i</sub> + {dec(weights.recurrence)} · R<sub>i</sub><sup>obs</sup>
        </p>
        <ul>
          <li>V<sub>i</sub> es el puntaje de la clase de vulnerabilidad: muy baja {dec(analysis.parameters.class_scores.muy_baja)} hasta muy alta {dec(analysis.parameters.class_scores.muy_alta)}.</li>
          <li>R<sub>i</sub><sup>obs</sup> es la recurrencia documentada, normalizada por el máximo de coincidencias con cobertura suficiente.</li>
          <li>El término participativo, peso {dec(weights.workshops)}, no se calcula: el paquete no trae esos conteos. No se escribe como cero observado.</li>
          <li>El cobeneficio no entra en esta lente. Puede verse en la matriz y en la lente de naturaleza.</li>
        </ul>

        <h3>Restricción presupuestal</h3>
        <p className="equation">
          x<sub>i</sub> ∈ {'{0, 1}'}
          <br />
          Σ c<sub>i</sub> x<sub>i</sub> ≤ {grouped(budget)}
        </p>
        <ul>
          <li>x<sub>i</sub> = 1 si la medida i entra al portafolio.</li>
          <li>c<sub>i</sub> es el costo en COP millones. No se fracciona.</li>
        </ul>

        <h3>Aporte del portafolio</h3>
        <p className="equation">
          maximizar Σ A<sub>i</sub>(x)
        </p>
        <p>
          A<sub>i</sub> es el aporte auditable de la medida dentro del conjunto.
          La primera medida de una dimensión aporta su término de vulnerabilidad completo.
          La segunda conserva el {dec(diminish * 100, 0)}% de ese término.
          La recurrencia documentada no se reduce.
        </p>
        <p>
          Cuando dos medidas cubren la misma dimensión prioritaria, la segunda puede aportar menos
          al puntaje del conjunto que al puntaje de la medida por sí sola.
        </p>

        <h3>Datos que afectan la decisión</h3>
        <ul>
          <li>Vulnerabilidad municipal, con peso {dec(weights.vulnerability * 100, 0)}%.</li>
          <li>Recurrencia documentada, con peso {dec(weights.recurrence * 100, 0)}%, si el reporte alcanza {analysis.parameters.recurrence_coverage_min_records} registros.</li>
          <li>Costos del catálogo y el presupuesto de COP {grouped(budget)} M.</li>
          <li>El cambio SSP3-7.0 disponible, solo como prueba del conjunto ya elegido.</li>
        </ul>

        <h3>Contexto, sin puntaje</h3>
        <p>SIG, hidrografía, humedales, áreas protegidas, cobeneficios y mitigación o emisiones quedan fuera de S<sub>i</sub><sup>ver</sup>.</p>

        <h3>Qué no hace este modelo</h3>
        <ul>
          <li>No recalcula el riesgo climático publicado por CORNARE.</li>
          <li>No inventa probabilidades.</li>
          <li>No imputa el componente participativo como cero observado.</li>
          <li>No usa mitigación ni emisiones como sustituto de adaptación.</li>
          <li>No convierte capas GIS en puntaje.</li>
        </ul>

        <h3>Trazabilidad</h3>
        <ol className="calc-flow">
          <li>Datos</li>
          <li>Puntaje verificado</li>
          <li>Restricción</li>
          <li>Búsqueda de combinaciones</li>
          <li>Portafolio</li>
          <li>Stress test</li>
          <li>Riesgo residual</li>
        </ol>
      </section>}

      {tab === 'path' && <section id="calc-path">
        <h3>Cómo se llegó a esta decisión</h3>
        <ul data-testid="calc-path-facts">
          <li>{grouped(candidates)} medidas candidatas.</li>
          <li>Presupuesto: COP {grouped(budget)} M.</li>
          <li>Combinaciones evaluadas: {grouped(combinations)}.</li>
          <li>Portafolio recomendado: {grouped(selected)} medidas, por COP {grouped(analysis.portfolio.cost)} M.</li>
          {hinge && <li>Brecha con la alternativa más cercana, {hinge.name}: {hinge.gapDisplay}.</li>}
          <li>La decisión es sensible a la evidencia participativa todavía por integrar.</li>
        </ul>
        <p>
          El resultado se puede reconstruir con los mismos pesos, costos y restricción.
          Huella {analysis.fingerprint}.
        </p>
      </section>}
    </div>
  );
}
