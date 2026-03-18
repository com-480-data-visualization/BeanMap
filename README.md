# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
|Massimo Berardi|345943|
|Noam Ifergan|341405|
|Victor Nahoul|339407|

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (20th March, 5pm)

**10% of the final grade**

This is a preliminary milestone to let you set up goals for your final project and assess the feasibility of your ideas.
Please, fill the following sections about your project.

*(max. 2000 characters per section)*

### Dataset

> Find a dataset (or multiple) that you will explore. Assess the quality of the data it contains and how much preprocessing / data-cleaning it will require before tackling visualization. We recommend using a standard dataset as this course is not about scraping nor data processing.
>
> Hint: some good pointers for finding quality publicly available datasets ([Google dataset search](https://datasetsearch.research.google.com/), [Kaggle](https://www.kaggle.com/datasets), [OpenSwissData](https://opendata.swiss/en/), [SNAP](https://snap.stanford.edu/data/) and [FiveThirtyEight](https://data.fivethirtyeight.com/)).

### Problematic

> Frame the general topic of your visualization and the main axis that you want to develop.
> - What am I trying to show with my visualization?
> - Think of an overview for the project, your motivation, and the target audience.

### Exploratory Data Analysis

> Pre-processing of the data set you chose
> - Show some basic statistics and get insights about the data

### Related work


> - What others have already done with the data?
> - Why is your approach original?
> - What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data).
> - In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class.

## Related work

Several existing projects already visualize global coffee data, but most stop at country-level summaries rather than modeling coffee as a trade network. The GitHub project **[Cartogcoffee](https://github.com/MistaRae/Cartogcoffee)** is a full-stack educational app built around an interactive map with points of interest, regional filters, tooltips, and a possible choropleth of coffee production/consumption. Its focus is mainly educational and descriptive, centered on where coffee is produced or consumed, not on directional trade flows between countries.

A second useful reference is **[coffee_worldwide_ETL](https://github.com/datng87/coffee_worldwide_ETL)**, a Flask/Postgres web app that combines choropleths, line charts, and bar charts for worldwide coffee production, consumption, and import/export. It highlights several important patterns, such as the gap between producing and consuming countries and the role of European countries as importers and re-exporters, but it still treats geography mostly as a dashboard of indicators rather than as a flow system.

Beyond GitHub, academic work has analyzed coffee trade as a **network**. [Utrilla-Catalan et al.](https://www.mdpi.com/2071-1050/14/2/672) study the global green coffee market using weighted exporter-importer networks based on UN Comtrade data and explicitly note that preliminary visualizations can be built with the Observatory of Economic Complexity (OEC). Their work is strong analytically, but it is aimed more at economic-complexity and inequality analysis than at an audience-facing interactive narrative.

In practice, the closest visual inspiration comes from **flow maps** and **Sankey-style trade graphics**. [OEC](https://oec.world/en/visualize/tree_map/hs92/export/show/all/20901/2017) already offers treemaps and trade-over-time views for coffee, and recent media graphics such as Visual Capitalist’s coffee trade flow graphic show that coffee is well suited to flow-based storytelling.

Our approach is original because it combines these strands: we want to move beyond static country rankings and build an interactive **geographic flow map of coffee**, showing producer countries, maritime/re-export hubs, and the divide between origin, processing, and final consumption markets. The main inspiration is therefore a mix of modern trade dashboards and the classical Minard-style flow map tradition, as illustrated by [The Library of Congress](https://blogs.loc.gov/maps/2021/06/19th-century-colonization-and-slavery-in-charles-minards-flow-maps/).

**Note.** This dataset has **not** been used by our team in any previous course project or external context.

## Milestone 2 (17th April, 5pm)

**10% of the final grade**


## Milestone 3 (29th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

