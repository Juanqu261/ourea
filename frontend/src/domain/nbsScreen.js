const CRITERIA = [
  ['societal', 'Reto social'],
  ['scale', 'Escala'],
  ['biodiversity', 'Biodiversidad'],
  ['feasibility', 'Viabilidad económica'],
  ['governance', 'Gobernanza'],
  ['tradeoffs', 'Compensaciones'],
  ['adaptive', 'Gestión adaptativa'],
  ['mainstreaming', 'Arreglo institucional'],
];

const SCREENS = {
  bio_pa: {
    societal: ['SUPPORTED', 'La clase de biodiversidad del corredor es Muy alta.'],
    scale: ['PARTIAL', 'El ámbito es el corredor. El predio no está seleccionado.'],
    biodiversity: ['PARTIAL', 'La medida protege ecosistemas. No hay un resultado de biodiversidad medido.'],
    feasibility: ['PARTIAL', 'COP 700 millones caben en el fondo. El costo es un supuesto del ejercicio.'],
    governance: ['PARTIAL', 'La ficha regional reporta un SIRAP consolidado. El arreglo del corredor sigue por validar.'],
    tradeoffs: ['SUPPORTED', 'La matriz muestra qué queda por fuera al comprarla.'],
    adaptive: ['TO VALIDATE', 'El indicador histórico es de producto. Umbral por acordar con CORNARE.'],
    mainstreaming: ['PARTIAL', 'Existe precedente institucional. No es una certificación IUCN.'],
  },
  bio_psa: {
    societal: ['SUPPORTED', 'Atiende biodiversidad, la presión común más alta del corredor.'],
    scale: ['PARTIAL', 'Es la segunda medida de la misma dimensión. El sitio no está seleccionado.'],
    biodiversity: ['PARTIAL', 'El pago sostiene conservación. El resultado ecológico no está medido aquí.'],
    feasibility: ['PARTIAL', 'COP 1.200 millones. El esquema regional ya tiene implementación en otros municipios.'],
    governance: ['PARTIAL', 'La ficha nombra esquemas activos fuera del corredor. El arreglo local sigue por validar.'],
    tradeoffs: ['SUPPORTED', 'Entra al puntaje institucional y desplaza espacios verdes, cuyo cobeneficio ya no suma.'],
    adaptive: ['TO VALIDATE', 'El indicador histórico cuenta beneficiarios. Umbral por acordar con CORNARE.'],
    mainstreaming: ['SUPPORTED', 'CORNARE reporta PSA en implementación consolidada a escala regional.'],
  },
  bio_restore: {
    societal: ['SUPPORTED', 'La dimensión está en clase Muy alta.'],
    scale: ['TO VALIDATE', 'La unidad de 100 ha es del ejercicio, no un polígono entregado.'],
    biodiversity: ['PARTIAL', 'Restaura cobertura. El resultado no está medido.'],
    feasibility: ['PARTIAL', 'COP 1.500 millones no entran sin sacar otra medida de mayor aporte verificado.'],
    governance: ['PARTIAL', 'Hay convocatorias regionales de restauración. El predio no está acordado.'],
    tradeoffs: ['SUPPORTED', 'Su aporte unitario es alto y su costo deja fuera otra dimensión.'],
    adaptive: ['TO VALIDATE', 'Umbral por acordar con CORNARE.'],
    mainstreaming: ['PARTIAL', 'La ficha la describe como avance intermedio.'],
  },
  food_agro: {
    societal: ['PARTIAL', 'La clase de seguridad alimentaria en el corredor es Baja. Entra por recurrencia observada.'],
    scale: ['PARTIAL', 'El ámbito es municipal. La finca no está seleccionada.'],
    biodiversity: ['PARTIAL', 'El manejo agroecológico puede sostener suelo y hábitat. No hay un resultado medido.'],
    feasibility: ['PARTIAL', 'COP 800 millones. El costo es un supuesto del ejercicio.'],
    governance: ['TO VALIDATE', 'Requiere caracterización de los productores del municipio asignado.'],
    tradeoffs: ['SUPPORTED', 'La recurrencia documentada es la más alta del corredor y por eso entra.'],
    adaptive: ['TO VALIDATE', 'Umbral por acordar con CORNARE.'],
    mainstreaming: ['PARTIAL', 'Hay registros de la medida en el reporte municipal.'],
  },
  water_riparian: {
    societal: ['SUPPORTED', 'El recurso hídrico está en clase Alta.'],
    scale: ['PARTIAL', 'Hay rondas de Río Negro y de La Marinilla como área candidata, no como obra.'],
    biodiversity: ['PARTIAL', 'La ronda es contexto espacial. No demuestra ganancia de biodiversidad.'],
    feasibility: ['PARTIAL', 'COP 1.300 millones. No entra al conjunto verificado.'],
    governance: ['TO VALIDATE', 'La dependencia de cada usuario sobre la fuente no está caracterizada.'],
    tradeoffs: ['SUPPORTED', 'Queda fuera porque otra combinación verifica más aporte con el mismo fondo.'],
    adaptive: ['TO VALIDATE', 'Umbral por acordar con CORNARE.'],
    mainstreaming: ['PARTIAL', 'La delimitación de ronda es un determinante existente, no un proyecto seleccionado.'],
  },
  hab_green: {
    societal: ['PARTIAL', 'Hábitat está en clase Baja.'],
    scale: ['TO VALIDATE', 'No hay barrio ni polígono de intervención.'],
    biodiversity: ['PARTIAL', 'Puede aportar sombra y regulación. El resultado no está medido.'],
    feasibility: ['PARTIAL', 'COP 1.000 millones. Entraba solo cuando el cobeneficio sumaba al puntaje institucional.'],
    governance: ['TO VALIDATE', 'El arreglo municipal de espacio público no está caracterizado.'],
    tradeoffs: ['SUPPORTED', 'Sale del portafolio institucional al retirar el cobeneficio del objetivo.'],
    adaptive: ['TO VALIDATE', 'Umbral por acordar con CORNARE.'],
    mainstreaming: ['TO VALIDATE', 'No hay un programa local verificado que la escale.'],
  },
};

export function screenNbs(measures) {
  return measures
    .filter((measure) => measure.nbsClass === 'NBS_DIRECT' || measure.nbsClass === 'NBS_HYBRID')
    .filter((measure) => SCREENS[measure.id])
    .map((measure) => ({
      id: measure.id,
      name: measure.name,
      nbsClass: measure.nbsClass,
      selected: true,
      standard: 'Screening contra los ocho criterios del Estándar Global de NbS de la UICN. No es una certificación.',
      criteria: CRITERIA.map(([id, label]) => {
        const [status, evidence] = SCREENS[measure.id][id];
        return { id, label, status, evidence };
      }),
    }));
}

export function screenCatalogueNbs(prepared, selectedIds) {
  const selected = new Set(selectedIds);
  return screenNbs(prepared.filter((measure) => selected.has(measure.id)));
}
