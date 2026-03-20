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


We base our analysis on the [FAO Detailed Trade Matrix dataset (1986–2024)](https://www.fao.org/faostat/en/#data/TM/), compiled by the Food and Agriculture Organization of the United Nations (FAO). The data follow the standard International Merchandise Trade Statistics (IMTS) methodology and are mainly sourced from UNSD, Eurostat, and national authorities. For each pair of countries and year, the database reports export quantity, export value, import quantity, and import value for a wide range of food and agricultural products.

The dataset is designed for global coverage rather than completeness of every bilateral flow: many country pairs never trade a given product, which results in a relatively sparse matrix, but the reported figures are based on official national statistics and undergo consistency checks by FAO. This makes it well suited for high-level analyses of trade patterns and value chains.

To use the dataset for our project, we will have to narrow it down and reshape it. In particular, we will restrict the bulk download to coffee-related products only (for example keeping items such as “Coffee, green” and “Coffee, decaffeinated or roasted”), drop variables that are not relevant for our questions, and ensure that the remaining fields are consistent across years and reporters.

Our goal is to construct two working datasets: one for coffee trade values and one for coffee trade quantities. In both cases, we aim for a format where each row corresponds to a single, economically meaningful flow of coffee between two countries in a given year, which can then be interpreted within the global transformation chain (from raw beans to processed products).

Note. The original FAO bulk download is too large to be pushed to GitHub. However, the smaller preprocessed coffee-only datasets that result from these steps are included in the repository.

### Problematic

> Frame the general topic of your visualization and the main axis that you want to develop.
> - What am I trying to show with my visualization?
> - Think of an overview for the project, your motivation, and the target audience.

**The Hidden Coffee Chain. Who Really Transforms the Bean?**

Coffee is one of the most traded commodities in the world, yet its supply chain remains deeply misunderstood. When observing only bilateral trade flows between countries, the picture becomes misleading.

Our visualization aims to reveal which countries are the true coffee transformers, those that import raw beans, process them through roasting, encapsulating, and packaging, and re-export them as higher-value products. To measure this, we will look at the difference between processed and raw coffee trade, and their respective values. This approach isolates the value genuinely added by each country.
The central axis is transformation: tracing the journey from raw beans to finished products. Rather than simply mapping who sells to whom, we want to show where economic value is actually captured along the chain.

Our target audience is the general public and students interested in economics or sustainability, who question the North-South inequalities embedded in global value chains. The motivation is straightforward: behind every cup of coffee lies an economic geography.

### Exploratory Data Analysis

> Pre-processing of the data set you chose
> - Show some basic statistics and get insights about the data

Starting from the full table, we first removed non-coffee products and kept only the two relevant items: “Coffee, green” and “Coffee, decaffeinated or roasted”. We also dropped redundant country-code columns and separated the dataset into two clean tables: one for trade values and one for trade quantities, keeping only import/export elements.

We then assessed data completeness over time by computing, for each year, the share of non-missing entries in the value and quantity tables. This showed that coverage is comparable across both datasets, but generally low (\<45%). This can be attributed to rare country-combination flows. Next, we inspected the source quality flags (E, X, A, I) associated with each data point. Official statistics (flag A) account for the overwhelming majority of entries, with non-official sources representing at most about 1–2% of the data. Based on this, we discarded the source-flag columns and focused on the main value/quantity series.

To avoid structural zeros and structurally empty records, we removed: (i) columns that are entirely missing, and (ii) rows with only zero or missing trade across all years. We also aligned the value and quantity tables so that they share the same subset of observations, and saved the resulting matrices for downstream analysis.

Finally, we produced exploratory plots of coffee trade quantities for specific countries. For Germany, Brazil, and Switzerland, we visualized (i) total imports vs exports over time, and (ii) a more detailed breakdown into raw vs processed coffee. These first visualizations already hint at the distinct functional roles of countries in the supply chain. For example, Brazil as a major exporter of green coffee, Germany as an important hub for importing and re-exporting (including processed coffee), and Switzerland as a high-value processing and re-export center. In our final plot, we explicitly contrast Switzerland's trade in physical quantities with trade values, highlighting how relatively modest volumes can translate into disproportionately high export value once coffee is processed and re-exported. Together, these patterns provide an initial empirical basis for our subsequent value-chain analysis of where coffee is processed and where value is captured.

All the steps are detailed in the EDA notebook: [EDA.ipynb](./EDA.ipynb)

### Related work


> - What others have already done with the data?
> - Why is your approach original?
> - What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data).
> - In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class.


Several existing projects already visualize global coffee data, but most focus on country-level summaries or bilateral exchanges rather than modeling coffee as a transformation process along a global value chain.

A useful reference is the [coffee_worldwide_ETL](https://github.com/datng87/coffee_worldwide_ETL) project, which combines choropleths and standard charts to explore global coffee production, consumption, and trade. It highlights key patterns such as the divide between producing and consuming countries, but treats geography mainly as a set of indicators rather than a system of flows.

A closely related project from previous years is the [Sundial Coffee Visualization Project](https://github.com/com-480-data-visualization/Sundial/tree/master?tab=readme-ov-file). It explores coffee trade with an emphasis on monetary flows and qualitative aspects such as aromas. While conceptually similar, it focuses on value representation, whereas our project targets structural transformation in the supply chain, identifying where raw coffee is processed and value is added.

The closest inspiration is [Resource Trade Earth](https://resourcetrade.earth/?year=2017&category=904&units=weight&autozoom=1), which provides interactive flow maps of global trade. While it effectively shows bilateral exchanges, it does not capture the functional role of countries within the value chain. Our approach builds on such flows to distinguish producers, processors, and consumers, and to reveal where value is created and captured.

Academic work, such as [Utrilla-Catalan et al. (2022)](https://www.mdpi.com/2071-1050/14/2/672), models coffee trade as a network and highlights structural inequalities, but remains focused on analysis rather than interactive storytelling.

Our contribution combines these perspectives while shifting the focus toward a central question: where is coffee actually processed, and who captures its value?

This dataset has not been used by our team before.

## Milestone 2 (17th April, 5pm)

**10% of the final grade**


## Milestone 3 (29th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

