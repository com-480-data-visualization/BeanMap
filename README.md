# BeanMap

Interactive 3D dashboard visualising the global coffee trade from 1986 to 2024.

Countries are extruded and coloured by their **Transformation Index** — a measure of how much raw coffee a country imports versus exports, indicating whether it acts as a raw producer or a processing hub. A Sankey flow chart, price timeline, and country side panel complete the picture.

**Live demo:** https://beanmap.vercel.app

---

## Authors

| Name | SCIPER |
|---|---|
| Massimo Berardi | 345943 |
| Noam Ifergan | 341405 |
| Victor Nahoul | 339407 |

---

## Features

- **3D map** — country depth and colour driven by Transformation Index (Three.js)
- **Trade flow arcs** — top import/export arrows per selected country
- **Sankey chart** — producers → processors → consumers flow (D3)
- **Price timeline** — global weighted average raw vs. processed price per tonne (D3)
- **Side panel** — per-country trade volumes, prices, value added, and top flows
- **Year slider** — scrub or play through 1986–2024

---

## Data

Source: **FAO** (Food and Agriculture Organization) raw trade matrices ([data](https://www.fao.org/faostat/en/#data/TM)).
- Item 656 — green bean (raw) exports
- Item 657 — roasted/processed coffee exports

The Transformation Index is computed as: `raw imports − raw exports` per country per year. A positive value indicates a processing hub; a negative value indicates a raw producer.

---

## Project Structure

```
BeanMap/
├── index.html              # Single-page app entry point
├── css/
│   └── styles.css          # All styling
├── js/
│   ├── app.js              # Boot, wiring, top-level event callbacks
│   ├── config.js           # Constants, colour maps, country name aliases
│   ├── dataService.js      # Data fetching, TI calculation, shared state
│   ├── map3D.js            # Three.js 3D map, arc flows, country selection
│   ├── uiController.js     # Side panel, year slider, flow-mode toggle
│   ├── visualizations.js   # D3 Sankey chart and price timeline
│   ├── utils.js            # Pure helpers (number formatting, geometry)
│   └── build_data.js       # Node.js script — builds data_layer.json from CSVs
├── data/
│   └── FAO/         # Raw CSV trade matrices (quantity + value)
├── report/
│   ├── milestone1_BeanMap.pdf
│   └── Milestone2_BeanMap.pdf
├── data_layer.json         # Pre-built data payload loaded at runtime
└── EDA.ipynb               # Exploratory data analysis notebook
```

---

## Running

The frontend is a static site — no build step or dependencies required.

**Serve locally:**
```bash
python3 -m http.server 8080
```
Then open http://localhost:8080.

**Rebuild `data_layer.json`** (only needed when the raw CSVs change):
```bash
node js/build_data.js
```
Requires `Trade_Matrix_Quantity.csv` and `Trade_Matrix_Value.csv` in `data/FAO/`.

---

## Milestones

| Milestone | Deadline | Report | 
|---|---|---|
| 1 | 20 March 2026 | [Report](report/milestone1_BeanMap.pdf) |
| 2 | 17 April 2026 | [Report](report/Milestone2_BeanMap.pdf) |
| 3 | 29 May 2026 | [Process Book](report/Milestone3_BeanMap.pdf) |
