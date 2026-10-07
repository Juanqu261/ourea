# Metodología de la decisión

Fecha: 2026-10-07. Los parámetros viven en `frontend/public/data/cornare/decision_model.json` y el cálculo en `frontend/src/domain/`.

## Pregunta

Con COP 5.000 millones, qué combinación de medidas priorizar en Rionegro, Guarne y Marinilla, y si esa decisión se sostiene bajo SSP3-7.0 hacia 2060.

## Qué no se calcula

No hay un modelo climático nuevo, ni un porcentaje de vulnerabilidad reducida, ni una pérdida evitada. El resultado es un puntaje de prioridad.

## Evidencia

Cada cifra crítica es dato institucional, inferencia del equipo, supuesto o información faltante.

La clase de vulnerabilidad por municipio y dimensión sale de la diapositiva 12. Se lee como vulnerabilidad, no como riesgo, porque en biodiversidad coincide con las clases del reto y en desastres no coincide con el riesgo Bajo/Medio de Rionegro. Esa lectura es una inferencia. Los números del PDF del reto se guardan tal cual.

## Localización

Cada medida se compra una vez. El costo no se multiplica por municipio.

1. Se asigna al municipio con la clase de vulnerabilidad más alta en su dimensión.
2. Si hay empate y todos tienen capacidad adaptativa numérica, gana la más baja.
3. Si a alguno le falta ese número, no se lo trata como capacidad alta ni baja.
4. Si el empate continúa y todos tienen al menos cinco registros de adaptación, gana la mayor recurrencia de frases del catálogo.
5. Si alguno tiene menos de cinco registros, permanece en el empate. No se convierte la ausencia en cero.
6. Las medidas de corredor (áreas protegidas, SAT y conocimiento) se rotulan como corredor y nombran el municipio que las dispara.

No se inventan predios, quebradas ni puntos de obra.

## Puntaje

Para la medida situada:

- Vulnerabilidad: `0,70 × clase`, con Muy alta 1,00, Alta 0,80, Media 0,60, Baja 0,40 y Muy baja 0,20.
- Recurrencia: `0,15 × conteo / máximo conteo del corredor`, solo si la cobertura alcanza cinco registros. El máximo observado es 4, en agroecología de Guarne.
- Talleres: peso institucional 0,15, sin calificar.
- Cobeneficio: `0,05 × clase de la segunda dimensión`, solo si la unidad funcional del reto nombra esa dimensión. Hoy aplica a cabeceras, suelos, agroecología y espacios verdes.

Dentro de un portafolio, la primera medida de una dimensión conserva el término de vulnerabilidad. Las siguientes conservan 35% en la lente institucional y 15% en la lente multidimensional. Así no se cuenta tres veces la misma clase Muy alta.

## Búsqueda

Hay 15 medidas indivisibles. Se enumeran las 32.768 combinaciones y se descarta toda suma de costos mayor a 5.000. La lente institucional maximiza el puntaje. Si dos combinaciones empatan, se prefiere la que deja más fondo sin usar.

Otras lentes, con la misma búsqueda:

- Naturaleza positiva: mismo puntaje. Solo en un empate exacto pesa cuántas medidas son de naturaleza, luego híbridas, y menos gasto gris.
- Multidimensional: el penal de la segunda medida en la dimensión baja a 15%.
- Bajo arrepentimiento: el aporte se divide por el costo. Las clases Alta y Muy alta conservan el peso completo. Las demás conservan la mitad.
- Máximo número de medidas: primero la mayor cantidad, después el puntaje institucional.
- Infraestructura gris: obliga la medida de 2.500 millones y completa con el mejor puntaje.

La decisión que se presenta es la institucional. En los datos actuales, naturaleza positiva, multidimensional y máximo número producen el mismo conjunto, porque no hay una segunda medida de la misma dimensión que el penal pueda expulsar. El contraste que sí cambia la decisión es la obra gris.

## SSP3-7.0

El reto solo cuantifica un cambio: el riesgo de desastres de Rionegro pasa de 0,28 Bajo a 0,32 Medio hacia 2060. Ese escalón, de la clase Baja a la Media en la escala interna, se suma a la clase de vulnerabilidad de las medidas de riesgo de desastres y se vuelve a resolver. Aplicar el cambio de riesgo como un escalón de clase es una inferencia. No se simula el clima.

El estado es Robusta solo si el conjunto no cambia y cada dimensión del portafolio tiene evidencia de escenario. Con una sola serie, un conjunto estable que incluye otras dimensiones queda Mayormente robusta. Si el conjunto cambia, Requiere ajuste. Si no hay ningún cambio documentado, Evidencia insuficiente.

## Portafolio que produce esta regla

Medidas, en orden de aporte al puntaje: fortalecimiento de áreas protegidas (700, corredor), conocimiento del riesgo (600, corredor), uso eficiente del agua (900, Marinilla), agroecología (800, Guarne), espacios verdes (1.000, Guarne o Marinilla) y salud (800, Guarne o Marinilla).

Costo: 4.800 millones. Disponible: 200 millones. Puntaje de prioridad: 2,87.

La restauración de ecosistemas queda fuera. Su puntaje unitario es mayor que el de áreas protegidas, pero cuesta 800 millones más y ese margen cubre otra dimensión con más aporte que la diferencia entre ambas medidas de biodiversidad. La infraestructura de Guarne, en clase Alta, también queda fuera: meter la obra de 2.500 millones baja el puntaje a 2,38.

La prueba SSP3-7.0 no cambia el conjunto. El estado es Mayormente robusta, porque las demás dimensiones no tienen serie.

## Residual

Infraestructura en Guarne sigue en clase Alta y sin medida. Biodiversidad y agua tienen medida, y aun así la vulnerabilidad no se declara resuelta. Hábitat y salud entran con clases bajas porque el fondo restante no compra otra medida de clase alta y su aporte marginal es positivo.
