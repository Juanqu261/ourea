# Auditoría de fuentes CLIMATERISK

Fecha de lectura: 2026-10-07. Los archivos crudos no se modifican.
Herramientas: pandas, openpyxl y PyMuPDF. No se usó OCR: el texto del reto y de las diapositivas con texto estaba en el archivo.

## Alcance de la decisión

El único corredor de decisión es Rionegro, Guarne y Marinilla, en Valles de San Nicolás, jurisdicción de CORNARE, Antioquia.
Mitigación y reducción de emisiones no miden desempeño de adaptación. No entran al puntaje.

## Archivos

- `ACCIONES DE ADAPTACIÓN SECTORES (1).xlsx` — 13099 bytes — `085da6b14bb30413`
- `ACCIONES DE ADAPTACIÓN SECTORES.xlsx` — 13099 bytes — `085da6b14bb30413`
- `EMISIONES POR ALCANCE SECTORES.xlsx` — 13485 bytes — `aed007fdfbe9cf2a`
- `HACKATHON RETO CORNARE.pdf` — 9235620 bytes — `b9eafc137f1c8d1f`
- `HACKATHON RETO CORNARE.pptx` — 105157128 bytes — `2768c29617022090`
- `INDICADORES POR UNIDAD DE PRODUCCIÓN SECTORES.xlsx` — 13309 bytes — `068214d790331b3d`
- `MEDIDAS DE MITIGACIÓN REGIONALES.xlsx` — 24898 bytes — `5ff9c731fae564bd`
- `REDUCCIÓN DE EMISIONES SECTORES.xlsx` — 12304 bytes — `abf46028a9b5c232`
- `REPORTE MEDIDAS DE ADAPTACIÓN MUNICIPIOS.xlsx` — 32186 bytes — `7d619f13571532b8`
- `REPORTE MITIGACIÓN.xlsx` — 12657 bytes — `b0e5c32ee47a5a0c`
- `RETO CLIMATE WEEK HACKATHON (1).pdf` — 378523 bytes — `ce8901194241e006`
- `RETO CLIMATE WEEK HACKATHON.pdf` — 391891 bytes — `3dc49d0290487b0d`

## Duplicados

- Mismo SHA-256 `085da6b14bb30413`: ACCIONES DE ADAPTACIÓN SECTORES (1).xlsx, ACCIONES DE ADAPTACIÓN SECTORES.xlsx
- `Paquete CRH . Medellín Reto Cornare.zip` (101069004 bytes) repite el paquete descomprimido y supera el límite de archivo de GitHub. No se versiona.

Los dos PDF del reto tienen distinto hash, pero PyMuPDF extrajo el mismo texto en las ocho páginas. Se trata como un duplicado de contenido.
La carpeta `__MACOSX` solo contiene metadatos de macOS. Se ignora.

## Relevancia

- Directa: el PDF del reto, la presentación y el reporte de medidas de adaptación municipales.
- Indirecta: mitigación regional, emisiones por alcance, reducción de emisiones e indicadores por unidad de producción. Sirven para contexto productivo y para no confundir MRV de carbono con adaptación.
- Acciones de adaptación por sector: no tienen municipio. No se usan para localizar medidas ni para calificar recurrencia del corredor.

## Hallazgos del reto que sí se codifican

Tomados del PDF del reto, no de una estimación nueva:

- Fondo simulado: COP 5.000 millones. Costos indivisibles. No es obligatorio gastar todo.
- Catálogo de 15 medidas. La suma de referencia es 18.900 millones.
- Vulnerabilidad en biodiversidad: Rionegro 0,75 Muy alta; Marinilla 0,72 Muy alta.
- Promedios regionales: biodiversidad 0,55; recurso hídrico 0,53. No son valores municipales.
- Capacidad adaptativa en biodiversidad: Rionegro 0,22; Marinilla 0,24; Guarne 0,33 Baja.
- Capacidad adaptativa en gestión del riesgo: Rionegro 0,56; Marinilla 0,61.
- Amenaza de desastres en Marinilla: 0,66–0,73 Alta. Es amenaza, no vulnerabilidad.
- Sensibilidad de desastres en Rionegro: 0,40. Sin clase publicada.
- Riesgo de desastres en Rionegro: 0,28 Bajo hacia 0,32 Medio en 2060.

La diapositiva 12 trae clases para 26 municipios y siete dimensiones. En el corredor:

- Rionegro: desastres Alta, hábitat Muy baja, agua Media, infraestructura Media, salud Muy baja, biodiversidad Muy alta, seguridad alimentaria Baja.
- Guarne: Alta, Baja, Media, Alta, Baja, Media, Baja.
- Marinilla: Muy baja, Baja, Alta, Muy baja, Baja, Muy alta, Muy baja.

Esas celdas se guardan como clase de vulnerabilidad. La columna se llama Riesgo de desastres porque así se llama la dimensión. No coincide con el riesgo Bajo/Medio de Rionegro, así que no se lee como la métrica de riesgo.
No hay un cubo numérico municipio × dimensión × escenario en los libros. Lo que falta queda nulo.

Pesos de priorización en la presentación: vulnerabilidad 70%, recurrencia de acciones 15%, recurrencia en talleres 15%. Los talleres no traen conteos.

## Libros Excel

### ACCIONES DE ADAPTACIÓN SECTORES (1).xlsx

- Bytes: 13099
- SHA-256: `085da6b14bb304130376a86b5b0f0396bafc0ab5115d28c7f090b76831090266`

#### Hoja `Reporte_Acciones_Adaptación_Sec`

- Filas: 58
- Columnas: Vigencia, Sector, Ecosistema, Valor Inversion
- Nulos: ninguno

### ACCIONES DE ADAPTACIÓN SECTORES.xlsx

- Bytes: 13099
- SHA-256: `085da6b14bb304130376a86b5b0f0396bafc0ab5115d28c7f090b76831090266`

#### Hoja `Reporte_Acciones_Adaptación_Sec`

- Filas: 58
- Columnas: Vigencia, Sector, Ecosistema, Valor Inversion
- Nulos: ninguno

### EMISIONES POR ALCANCE SECTORES.xlsx

- Bytes: 13485
- SHA-256: `aed007fdfbe9cf2a0ecdb0c5cf26805c333bb48b6889bfe7c12d9d0710fd741f`

#### Hoja `Reporte_Emisiones_Discriminadas`

- Filas: 72
- Columnas: Sector, Vigencia, Alcance, Huella Carbono
- Nulos: ninguno

### INDICADORES POR UNIDAD DE PRODUCCIÓN SECTORES.xlsx

- Bytes: 13309
- SHA-256: `068214d790331b3d69bc9d7a222bde046422e67418ff3f500474eff1f730fa63`

#### Hoja `Reporte_Indicadores_Sectores_Un`

- Filas: 25
- Columnas: Vigencia Actual, Sector, Agua Unidad Produccion, Energia Unidad Produccion, Residuos Unidad Produccion, Aprovechamiento Residuos, Huella Unidad Produccion
- Nulos: ninguno

### MEDIDAS DE MITIGACIÓN REGIONALES.xlsx

- Bytes: 24898
- SHA-256: `5ff9c731fae564bd7846dd74a734cb1196806a981bb51dfb565a6720de9c01fd`

#### Hoja `Reporte_Mitigación_Medidas_2026`

- Filas: 296
- Columnas: Subregion, Vigencia, Medida, Inversion, Reduccion Emisiones Total
- Nulos: Inversion=47, Reduccion Emisiones Total=9

### REDUCCIÓN DE EMISIONES SECTORES.xlsx

- Bytes: 12304
- SHA-256: `abf46028a9b5c23282a872ea984e12d85f4a17b59e3d18850237d62ee569b16b`

#### Hoja `Reporte_Reduccion_Emisiones_Sec`

- Filas: 20
- Columnas: Sector, Vigencia, Inversion, Reduccion Emisiones Total
- Nulos: ninguno

### REPORTE MEDIDAS DE ADAPTACIÓN MUNICIPIOS.xlsx

- Bytes: 32186
- SHA-256: `7d619f13571532b8be8d1c05592aeba150576c0a6bb8af67056a38a7f52908c7`

#### Hoja `Reporte_Adaptacion_General_2026`

- Filas: 300
- Columnas: Municipio, Subregion, Vigencia, Plan, Linea, Medida, Indicador, Ecosistema, Vulnerabilidad, Valor Inversion
- Nulos: Valor Inversion=4

### REPORTE MITIGACIÓN.xlsx

- Bytes: 12657
- SHA-256: `b0e5c32ee47a5a0c45eebffbbd9025a2421cd52cb0903e3662901f4497f2d9fa`

#### Hoja `Reporte_Mitigación_Subregiones_`

- Filas: 29
- Columnas: Subregion, Vigencia, Inversion, Reduccion Emisiones Total
- Nulos: ninguno

## Lectura del reporte de adaptación

La columna `Vulnerabilidad` contiene etiquetas de amenaza (inundaciones, movimiento en masa, incendios) o `No Aplica`. No es el índice de vulnerabilidad climática.
El Carmen de Viboral concentra muchos más registros que Marinilla. Esa asimetría es cobertura del dataset, no capacidad adaptativa.
Hay inversiones nulas y algunas en cero. Un cero contable no se convierte en capacidad adaptativa cero.
Guarne tiene una línea de infraestructura de movilidad en 2022 de gran magnitud. No se homologa a la medida del reto «infraestructura resiliente al cambio climático».
Aparece el ecosistema `prueba2` en el libro completo. Es un problema de calidad y no está en el corredor de decisión.

## Mitigación y emisiones

Los libros de mitigación están por subregión, incluida Valles. Los de emisiones, reducción e indicadores están por sector productivo (aguacate, construcción, flores, industrias), sin municipio.
Hay indicadores de aprovechamiento con valores negativos. No se corrigen ni se usan.
Varias medidas de adaptación también aparecen en el libro de mitigación porque algunas acciones tienen cobeneficio de carbono. Esa tonelada de CO2e no es un puntaje de vulnerabilidad.

## Límites

- Varias diapositivas de la presentación son imagen y no aportaron tablas adicionales en el texto extraído.
- No se publicó la ficha numérica completa por municipio y dimensión.
- Los costos del catálogo son supuestos homogéneos del ejercicio, no disponibilidades presupuestales de CORNARE.
- La meta regional de reducir 30% la vulnerabilidad a 2035 es un objetivo de plan, no una efectividad por medida.
