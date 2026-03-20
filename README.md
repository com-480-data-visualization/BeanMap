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


We base our analysis on the **UN Comtrade Detailed Trade Matrix dataset (1986–2020)**, which provides bilateral trade flows between countries for a wide range of commodities. It includes both **trade values (USD)** and **quantities (tons)**, along with metadata such as reporting reliability flags. From this dataset, we extract only the relevant coffee categories: **“Coffee, green” (raw beans)** and **“Coffee, decaffeinated or roasted” (processed coffee)**.

To make the data suitable for our analysis, we perform several preprocessing steps. First, we filter the dataset to retain only coffee-related entries and remove redundant country-code columns. We then separate the data into two consistent tables: one for **trade values** and one for **trade quantities**, keeping only import and export flows. Rows and columns with no meaningful data (all missing or zero values) are removed to avoid structural noise, and both tables are aligned to ensure they contain the same set of observations.

We also assess data quality. Coverage is relatively sparse (generally below 45% non-missing values), which reflects the presence of many rare country-to-country trade flows. However, the dataset is highly reliable: the vast majority of entries come from **official national statistics**, with non-official estimates representing only a small fraction (around 1–2%). Based on this, we retain the main data while discarding auxiliary source flags.

The final result consists of two clean datasets—one for values and one for quantities—that capture global coffee trade over time and form the basis for our analysis of transformation and value creation along the supply chain.

### Problematic

> Frame the general topic of your visualization and the main axis that you want to develop.
> - What am I trying to show with my visualization?
> - Think of an overview for the project, your motivation, and the target audience.

#### The Hidden Coffee Chain. Who Really Transforms the Bean?
Coffee is one of the most traded commodities in the world, yet its supply chain remains deeply misunderstood. When observing only bilateral trade flows between countries, the picture becomes misleading.

Our visualization aims to reveal which countries are the true coffee transformers, those that import raw beans, process them through roasting, encapsulating and packaging, and re-export them as higher-value products. To measure this, we use a composite indicator: roasted coffee exports minus the net of roasted coffee imports and raw coffee exports, which isolates the value genuinely added by each country.
The central axis is transformation: tracing the journey from raw beans to finished products. Rather than simply mapping who sells to whom, we want to show where economic value is actually captured along the chain.

Our target audience is the general public and students interested in economics or sustainability, who question the North-South inequalities embedded in global value chains. The motivation is straightforward: behind every cup of coffee lies an economic geography.

### Exploratory Data Analysis

> Pre-processing of the data set you chose
> - Show some basic statistics and get insights about the data

We focused our EDA on the UN Comtrade “Detailed Trade Matrix” for merchandise trade (1986–2020). Starting from the full table, we first removed non-coffee products and kept only the two relevant items: “Coffee, green” and “Coffee, decaffeinated or roasted”. We also dropped redundant country-code columns and separated the dataset into two clean tables: one for trade values and one for trade quantities, keeping only import/export elements.

We then assessed data completeness over time by computing, for each year, the share of non-missing entries in the value and quantity tables. This showed that coverage is comparable across both datasets, but generally low (\<45%). This can be attributed to rare country-combination flows. Next, we inspected the source quality flags (E, X, A, I) associated with each data point. Official statistics (flag A) account for the overwhelming majority of entries, with non-official sources representing at most about 1–2% of the data. Based on this, we discarded the source-flag columns and focused on the main value/quantity series.

To avoid structural zeros and structurally empty records, we removed: (i) columns that are entirely missing, and (ii) rows with only zero or missing trade across all years. We also aligned the value and quantity tables so that they share the same subset of observations, and saved the resulting matrices for downstream analysis.

Finally, we produced exploratory plots of coffee trade quantities for specific countries. For Germany, Brazil, and Switzerland, we visualized (i) total imports vs exports over time, and (ii) a more detailed breakdown into raw vs transformed coffee. These first visualizations already hint at the distinct functional roles of countries in the supply chain. For example, Brazil as a major exporter of green coffee, Germany as an important hub for importing and re-exporting (including processed coffee), and Switzerland as a high-value processing and re-export center. In our final plot, we explicitly contrast Switzerland's trade in physical quantities with trade values, highlighting how relatively modest volumes can translate into disproportionately high export value once coffee is transformed and re-exported. Together, these patterns provide an initial empirical basis for our subsequent value-chain analysis of where coffee is transformed and where value is captured.

### Related work


> - What others have already done with the data?
> - Why is your approach original?
> - What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data).
> - In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class.


Several existing projects already visualize global coffee data, but most remain focused on country-level summaries or bilateral exchanges rather than modeling coffee as a transformation process along a global value chain.

A closely related project from previous years is the [Sundial Coffee Visualization Project](https://github.com/com-480-data-visualization/Sundial/tree/master?tab=readme-ov-file). Their project explored coffee trade through interactive visualizations, with a particular emphasis on **monetary flows** and additional dimensions such as **aromas and qualitative attributes of coffee**. While conceptually similar, their approach differs from ours: it focuses more on value representation and sensory aspects, whereas our project centers on **structural transformation within the supply chain**, specifically identifying where raw coffee is processed and where value is effectively added.

From a data and visualization perspective, the closest reference to our work is [Resource Trade Earth](https://resourcetrade.earth/?year=2017&category=904&units=weight&autozoom=1). This platform provides detailed, interactive **flow maps of global trade**, including coffee, based on international trade data. It allows users to explore bilateral exchanges between countries and offers a clear representation of trade intensity and direction. 

However, our approach diverges in a key way. While Resource Trade Earth focuses on **pairwise trade relationships** (who trades with whom), it does not explicitly address the **role of countries within the transformation chain**. In contrast, our project uses trade flows as a foundation to reconstruct the **economic function of each country**, distinguishing producers, processors, and final consumers. Rather than simply visualizing flows, we aim to interpret them in order to reveal where **value is created and captured** along the coffee supply chain.

Finally, academic work has also approached coffee trade as a **networked system**. For instance, [Utrilla-Catalan et al. (2022)](https://www.mdpi.com/2071-1050/14/2/672) analyze the global green coffee market using weighted exporter–importer networks derived from UN Comtrade data. Their work provides a rigorous analytical foundation and highlights structural inequalities within the trade network. However, it is primarily oriented toward economic analysis rather than **interactive, audience-facing storytelling**.

Our contribution builds on these different strands—interactive trade maps, prior visualization projects, and network-based analyses—while shifting the focus toward a central question: **where is coffee actually transformed, and who captures its value?**

**Note.** This dataset has **not** been used by our team in any previous course project or external context.

## Milestone 2 (17th April, 5pm)

**10% of the final grade**


## Milestone 3 (29th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

