# Contexto espacial

Fecha: 2026-10-07.

El mapa muestra dónde tiene sentido mirar la decisión. No calcula el puntaje y no ubica la obra.

## Qué hace

Enmarca Rionegro, Guarne y Marinilla con un mapa vectorial, relieve y capas oficiales de contexto. El color del municipio sigue la métrica y la dimensión que la persona está leyendo. Al elegir una medida, el mapa resalta el municipio o el corredor que el optimizador ya había asignado y enciende las capas relacionadas.

## Qué no hace

- No convierte un polígono de área protegida, humedal o ronda en un sitio de intervención.
- No cambia el portafolio de COP 5.000 millones.
- No fabrica una superficie continua a partir de tres valores municipales.
- No usa la amenaza por movimiento en masa ni el ráster de inundación como la vulnerabilidad climática del reto.
- Estar dentro del POMCA Río Negro no es un puntaje de riesgo.

La ubicación exacta de cada medida queda en **Por definir**.

## Jerarquía de fuentes

1. Límites municipales: DANE, Marco Geoestadístico Nacional 2025. Archivo local.
2. Contexto ambiental y de amenaza: servicios públicos de CORNARE en `https://mapas.cornare.gov.co/arcgis/rest/services`. Se descargan en el preproceso y se recortan al corredor.
3. Mapa base: OpenFreeMap Dark, esquema OpenMapTiles, sin llave. Si no responde, se intenta Liberty y luego un fondo oscuro local. El build copia el worker de MapLibre a `vendor/maplibre/` porque, si ese archivo no está junto al paquete, el mapa no pide teselas vectoriales y se queda en el fondo.
4. Relieve: AWS Open Data Terrain Tiles, codificación Terrarium, exageración 1.0. El control puede subir hasta 1.3.

## MDT de CORNARE

`BASE_CARTOGRAFIA/Bg_Cornare_Mdt_22` publica `Mdt_Marinilla`, `Mdt_Rionegro`, `DTM_Cornare_.img` y `HILL_DTM_30M_L` como capas ráster. Una consulta `identify` en Rionegro devolvió un valor de píxel de unos 2.079–2.085 metros. El servicio no ofrece ImageServer ni un GeoTIFF numérico, y no hay un MDT municipal de Guarne. El color de un hillshade no se usa como elevación. Por eso el terreno del mapa es el de AWS.

## Capas cacheadas

El script `scripts/climaterisk/build_spatial_context.py` recorta con un buffer de 0.02 grados, repara geometrías y simplifica solo para la visualización. La ronda del Río Negro y la de La Marinilla usan una tolerancia más fina que el movimiento en masa.

| Capa | Servicio | Uso |
|---|---|---|
| Humedales | Determinantes/humedales/MapServer/0 | Contexto de naturaleza |
| Áreas protegidas | Areas_Protegidas/Areas_Protegidas_2022/MapServer/0 | Contexto de la medida de áreas protegidas |
| Ronda Río Negro | Rondas/Rondas_251_Q_Rio_Negro/FeatureServer/0 | Contexto de rondas |
| Ecosistema La Marinilla | Rondas/Rondas_La_Marinilla_Ecosistemico/FeatureServer/0 | Contexto de la quebrada |
| Zonificación La Marinilla | Rondas/Rondas_La_Marinilla_Zonificacion/FeatureServer/0 | Usos de la ronda |
| Ríos principales | RECURSO_HIDRICO/Hidrologia/MapServer/10 | Red hídrica |
| POMCA Río Negro | POMCAS/pomca_rio_negro/MapServer/1 | Contorno de la cobertura municipal del POMCA |
| Movimiento en masa | OAT_Y_GR/Cornare_Movimiento_Masa2/MapServer/0 | Amenaza, disuelta por clase y simplificada a 0,0035 grados. Apagada por defecto |

La inundación (`OAT_Y_GR/Cornare_Inundacion_22/MapServer/0`) es un ráster. Se pide en tiempo de ejecución y, si el servicio falla, el mapa la apaga. No es necesaria para abrir la decisión.

## Edificios

La extrusión usa `render_height` y `render_min_height` del esquema OpenMapTiles, desde el zoom 14 y solo en modo 3D. Si el dato no trae altura, la extrusión queda en cero y sigue viéndose el edificio plano del mapa base. No se inventan pisos.

## Atribución

OpenStreetMap y OpenFreeMap quedan en el control del mapa. El terreno cita Terrain Tiles de AWS Open Data y la nota de atribución de Tilezen/Joerd. Las capas locales citan a CORNARE o al DANE en la ficha del elemento.
