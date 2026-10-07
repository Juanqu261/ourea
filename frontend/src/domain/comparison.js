function measuresOf(portfolio) {
  return portfolio.measures.map((measure) => measure.name);
}

// What changes against the recommended portfolio: measures that enter and leave.
function difference(portfolio, recommended) {
  const names = new Map([...portfolio.measures, ...recommended.measures].map((measure) => [measure.id, measure.name]));
  return {
    enter: portfolio.ids.filter((id) => !recommended.ids.includes(id)).map((id) => names.get(id)),
    leave: recommended.ids.filter((id) => !portfolio.ids.includes(id)).map((id) => names.get(id)),
  };
}

export function comparisonCards(analysis) {
  const recommended = analysis.lenses.institucional;
  const nature = analysis.lenses.naturaleza;
  const regret = analysis.lenses.bajo_arrepentimiento;
  const grey = analysis.baselines.grey;
  return [
    {
      id: 'recommended',
      title: 'Recomendado: pesos de CORNARE',
      cost: recommended.cost,
      measures: measuresOf(recommended),
      institutional: recommended.institucional.objective,
      lens: null,
      difference: null,
    },
    {
      id: 'cobenefit',
      title: 'Con cobeneficio',
      cost: nature.cost,
      measures: measuresOf(nature),
      institutional: nature.institucional.objective,
      lens: {
        label: 'Lente de naturaleza',
        value: nature.withCobenefit.objective,
        note: 'Este objetivo suma el cobeneficio nombrado. No es el puntaje institucional verificado.',
      },
      difference: difference(nature, recommended),
    },
    {
      id: 'regret',
      title: 'Bajo arrepentimiento',
      cost: regret.cost,
      measures: measuresOf(regret),
      institutional: regret.institucional.objective,
      lens: {
        label: 'Índice de bajo arrepentimiento',
        value: regret.regret.objective,
        note: 'Es un índice, no un puntaje de vulnerabilidad.',
      },
      difference: difference(regret, recommended),
    },
    {
      id: 'grey',
      title: 'Infraestructura gris',
      cost: grey.cost,
      measures: measuresOf(grey),
      institutional: grey.institucional.objective,
      lens: null,
      note: 'Elegido con el mismo puntaje institucional verificado, entre los conjuntos que incluyen la obra gris.',
      difference: difference(grey, recommended),
    },
  ];
}
