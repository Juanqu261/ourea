# Auditoría del puntaje institucional

Fecha: 2026-10-07. El cálculo vive en `frontend/src/domain/portfolioSearch.js`. Esta nota no cambia los datos crudos de CLIMATERISK.

## Hallazgo

La regla institucional de CORNARE es 70% vulnerabilidad, 15% recurrencia de acciones y 15% recurrencia en talleres. Esos tres pesos suman 1.

El optimizador sumaba además `cobenefit_weight = 0,05` dentro del objetivo etiquetado como institucional. Ese 5% es un criterio del equipo, no de la regla publicada. Aplicaba a cabeceras, suelos, agroecología y espacios verdes.

## A. Puntaje anterior

Objetivo con cobeneficio incluido: 2,87. Costo 4.800 de 5.000.

`bio_pa`, `food_agro`, `hab_green`, `health`, `risk_knowledge`, `water_eff`.

## B. Puntaje institucional puro

Objetivo sin cobeneficio y sin imputar talleres: 2,8125. Costo 5.000.

`bio_pa`, `bio_psa`, `food_agro`, `health`, `risk_knowledge`, `water_eff`.

## C y D. Qué conjunto cambia

Sale `hab_green` (COP 1.000 M, clase Baja, cobeneficio 0,03, recurrencia no observada).

Entra `bio_psa` (COP 1.200 M), segunda medida de biodiversidad. Su vulnerabilidad se cuenta al 35% y conserva una recurrencia observada de 0,037.

La diferencia verificada entre el conjunto nuevo y el anterior, ya sin cobeneficio, es de 0,0025 a favor del nuevo. El cobeneficio de 0,03 era lo que mantenía los espacios verdes dentro.

La lente de naturaleza sí puede usar ese cobeneficio. Con él, el conjunto vuelve a ser el anterior: espacios verdes dentro y PSA fuera, a COP 4.800 M.

## E. Decisión

El portafolio recomendado pasa a ser el institucional puro. Huella nueva: `ourea-42aeaba8`.

SSP3-7.0 no cambia ese conjunto. El estado sigue siendo Mayormente robusta, porque solo el riesgo de desastres de Rionegro tiene serie.

## Evidencia no observada

Tratar una recurrencia no observada como cero hace que, en el puntaje verificado, se parezca a una recurrencia observada de cero. No lo es.

Para cada medida el término verificado es vulnerabilidad más recurrencia observada. El componente de talleres queda fuera y se muestra como “Por integrar”. Si la recurrencia está retenida por cobertura, también se muestra “Por integrar”, no como 0.

El intervalo institucional, que no es una probabilidad, permite 0 a 0,15 en talleres y 0 a 0,15 en una recurrencia no observada.

Prueba conservadora: el portafolio recomendado recibe el mínimo de esos términos y cada alternativa factible recibe el máximo. Hay combinaciones que superan al recomendado. El resultado es **Sensible a evidencia no observada**.

Eso no autoriza a imputar el 15% de talleres. Autoriza a decir que la decisión verificada no es dominante en todo el intervalo.

## Alternativas más cercanas, con evidencia verificada

| Medida | Brecha | Costo |
| --- | --- | --- |
| Espacios verdes | 0,0025 | 1.000 |
| Servicios públicos | 0,0025 | 2.000 |
| SAT | 0,0865 | 1.200 |

La restauración de ecosistemas sigue fuera: su aporte unitario es alto y su costo de 1.500 desplaza otra dimensión.
