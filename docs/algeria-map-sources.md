# Algeria Map Sources

This note records the checked-in geography sources for the `algerian_war_of_independence` scenario.

## Algeria ADM1 source

- Dataset: `geoBoundaries-DZA-ADM1.geojson`
- Local path: `data/geojson/algeria-adm1/geoBoundaries-DZA-ADM1_simplified.geojson`
- Download URL: `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbHumanitarian/DZA/ADM1/geoBoundaries-DZA-ADM1.geojson`
- Retrieved: March 4, 2026
- Source family: geoBoundaries `gbHumanitarian`
- Source metadata:
  - Boundary year represented: `2020`
  - Boundary source: `UNHCR (from GAUL), HDX`
  - License: `Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)`
  - Metadata endpoint used: `https://www.geoboundaries.org/api/current/gbHumanitarian/DZA/ADM1/`

## France inset source

- Dataset: `geoBoundaries-FRA-ADM0.geojson`
- Local path: `data/geojson/france-adm0/geoBoundaries-FRA-ADM0.geojson`
- Download URL: `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/FRA/ADM0/geoBoundaries-FRA-ADM0.geojson`
- Retrieved: March 4, 2026
- Source family: geoBoundaries `gbOpen`
- Source metadata:
  - Boundary year represented: `2016`
  - Boundary source: `geoBoundaries, Wikipedia`
  - License: `CC0 1.0 Universal (CC0 1.0) Public Domain Dedication`
  - Metadata endpoint used: `https://www.geoboundaries.org/api/current/gbOpen/FRA/ADM0/`

## Historical reconstruction method

The scenario does not treat modern wilayas as one-to-one gameplay regions. Instead, it aggregates real modern ADM1 polygons into historically informed theaters:

- `Algiers`: Alger, Blida, Tipaza
- `KabylieMountains`: Tizi Ouzou, Bejaia, Bouira, Boumerdes, Jijel
- `Oran`: Oran, Ain-Temouchent, Tlemcen, Sidi Bel Abbes, Mostaganem, Mascara, Relizane
- `SaharaSouth`: Adrar, Bechar, Tindouf, Ghardaia, Ouargla, El Oued, Laghouat, Tamanrasset, Illizi, Biskra, Djelfa
- `TunisianBorder`: Tebessa, Souk-Ahras, El-Tarf, Guelma, Annaba, Khenchela, Batna, Oum El Bouaghi, Skikda, Constantine

These unions are scenario fronts, not claims about official historical borders. They were chosen to keep anti-colonial theaters legible while staying grounded in real geometry.
