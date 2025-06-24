# Forced-Migration-Visualization

Forced Migration Visualization Tool

[Explore the interactive visualization here](https://pigeon-effect.github.io/Forced-Migration-Visualization/)

Technical Overview
This data visualization tool provides an interactive exploration of forced migration patterns from 1950 to present. Built with D3.js, it features three complementary visualizations that dynamically respond to user interactions and filtering.

Core Visualizations
Chord Diagram: Migration Relationships
![origin_target_chart](https://raw.githubusercontent.com/Pigeon-Effect/Forced-Migration-Visualization/main/results/origin_target_chart_expulsions_1950_2025.svg)
Visualizes bilateral migration flows between countries using curved ribbons. Node arc size represents total migration volume per country, ribbon width indicates flow magnitude between pairs.

Sankey Diagram: Country-Specific Flows
![sankey_chart](https://raw.githubusercontent.com/Pigeon-Effect/Forced-Migration-Visualization/main/results/sankey_chart_kazahstan_1986_2025.svg)
Shows detailed migration flows for a selected country. Left column represents origin countries (immigration sources), right column shows destination countries (emigration targets). Flow width corresponds to migrant volume.

Temporal Trend Analysis
![line_chart](https://raw.githubusercontent.com/Pigeon-Effect/Forced-Migration-Visualization/main/results/line_chart_1986_2025.svg)
Displays migration trends over time. Points represent median estimates, shaded areas show uncertainty ranges. Automatically updates based on country selection and filters.



