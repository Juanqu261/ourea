# Cross-city evidence matrix

| Theme | Medellín | Nanjing |
|-------|----------|---------|
| Case role | Primary proving ground | Portability demonstration |
| Hazard / stress | Official mass-movement hazard | Terrain-derived drainage-stress **screening proxy** |
| Terrain | Municipal 1 m DEM | Mapzen Skadi ~30 m SRTM-style |
| Climate | CHIRPS v3 Final 0.05° | NASA POWER Daily (IMERG preferred when credentialed) |
| Population | DANE census-based planning proxy | WorldPop 2026 **population estimate** |
| Socioeconomic / equity | IMCV/AMPI + stratum | **Not fabricated — lens disabled** |
| Built environment | Cadastral buildings | WorldCover built-up proxy (OSM counts avoided if sparse) |
| Official local projects | Plan alignment / cost evidence | Retrospective validation only (`optimizer_input: false`) |
| Optimizer | Shared | Shared (no China fork) |

## Evidence labels used in Nanjing UI/docs

- OFFICIAL MUNICIPAL EVIDENCE  
- OBSERVED / REMOTE-SENSING DATA  
- POPULATION ESTIMATE  
- DERIVED SCREENING PROXY  
- EXPLICIT PLANNING ASSUMPTION  
- RETROSPECTIVE COMPARISON  

Never label remotely sensed variables as official municipal data.
