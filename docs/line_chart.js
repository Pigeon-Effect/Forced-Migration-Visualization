// --- line_chart.js ---

// Assumes lineChartSvgElement, lineChartPlot, lineChartMargin, lineChartWidth, lineChartHeight,
// activeEventTypes, originalValidEvents, dataSourcesMap, formatNumber, eventTypeDetails, updateBibliography,
// viewStartYear, viewEndYear (passed as arguments)
// are available from app_controller.js or globally.

function parseDataSourceIds(sourceString) {
    if (!sourceString || typeof sourceString !== 'string') return [];
    return sourceString.split(';')
        .map(id => String(id || '').trim())
        .filter(id => id && id !== "NA" && id !== "N/A" && id.toLowerCase() !== "unknown");
}

function calculateMedian(values) {
    if (!values || values.length === 0) return 0;
    const sortedValues = values.map(v => +v).filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (sortedValues.length === 0) return 0;

    const mid = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
        return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    }
    return sortedValues[mid];
}

function drawOrUpdateLineChart(countryName, viewStartYear, viewEndYear) {
    if (!lineChartPlot || !lineChartSvgElement || !lineChartPlot.node()) {
        console.error("Line chart SVG elements not ready for drawing.");
        return;
    }
    lineChartPlot.selectAll("*").remove();
    lineChartSvgElement.selectAll(".line-chart-title-text").remove();
    lineChartSvgElement.selectAll(".legend").remove();

    if (!originalValidEvents || originalValidEvents.length === 0) {
        lineChartPlot.append("text").text("No data loaded.").attr("x", lineChartWidth/2).attr("y", lineChartHeight/2).attr("text-anchor", "middle").style("font-size","12px");
        updateBibliography([]);
        return;
    }

    // --- SECTION FOR DYAD-LEVEL (YEAR-ORIGIN-TARGET) MEDIAN, MIN, MAX CALCULATION ---
    const dyadAggregates = new Map();
    originalValidEvents.forEach(event => {
        let dyadTargetForGrouping = event.target_name_viz; // Default target for grouping

        // Heuristic: Normalize target to "Ghana" for 1983 Nigeria events related to Ghanaians
        // This ensures these specific events are grouped together for median calculation.
        if (event.year_num === 1983 && event.origin_name_viz === "Nigeria") {
            const targetStringLower = event.target_name_viz ? event.target_name_viz.toLowerCase() : "";
            const textStringLower = event.event_text_viz ? event.event_text_viz.toLowerCase() : "";

            // Check if target is explicitly Ghana, or a list containing Ghana, or text implies Ghanaians
            const targetsInList = targetStringLower.split(';').map(t => t.trim());
            if (targetStringLower === "ghana" || targetsInList.includes("ghana") || textStringLower.includes("ghanaian")) { // "ghanaian" catches "ghanaians", "ghanian"
                dyadTargetForGrouping = "Ghana";
            }
        }
        // For all other events, dyadTargetForGrouping remains event.target_name_viz or becomes undefined if originally blank.
        // Ensure dyadTargetForGrouping is a defined string for key creation, use a placeholder if undefined/null
        const keyTargetPart = dyadTargetForGrouping && dyadTargetForGrouping.trim() !== "" ? dyadTargetForGrouping : "UnknownTarget";


        const dyadKey = `${event.year_num}-${event.origin_name_viz}-${keyTargetPart}`;

        if (!dyadAggregates.has(dyadKey)) {
            dyadAggregates.set(dyadKey, {
                values: [],
                sourceIds: new Set()
            });
        }
        const group = dyadAggregates.get(dyadKey);
        group.values.push(+event.mean_estimate_num || 0);
        const eventSourceIds = parseDataSourceIds(event.original_data_source_ids);
        eventSourceIds.forEach(id => group.sourceIds.add(id));
    });

    dyadAggregates.forEach(agg => {
        const numericValuesForMinMax = agg.values.map(v => +v).filter(v => !isNaN(v));
        agg.median_estimate = calculateMedian(agg.values);
        agg.num_estimates_in_dyad = agg.values.length;

        if (agg.num_estimates_in_dyad > 1 && numericValuesForMinMax.length > 0) {
            agg.min_estimate_in_dyad = d3.min(numericValuesForMinMax);
            agg.max_estimate_in_dyad = d3.max(numericValuesForMinMax);
            if (agg.min_estimate_in_dyad === undefined) agg.min_estimate_in_dyad = agg.median_estimate;
            if (agg.max_estimate_in_dyad === undefined) agg.max_estimate_in_dyad = agg.median_estimate;
        } else if (numericValuesForMinMax.length > 0) {
             agg.min_estimate_in_dyad = agg.median_estimate;
             agg.max_estimate_in_dyad = agg.median_estimate;
        } else {
            agg.min_estimate_in_dyad = agg.median_estimate;
            agg.max_estimate_in_dyad = agg.median_estimate;
        }
        agg.combined_source_ids_str = Array.from(agg.sourceIds).join(';');
    });

    const uniqueOriginalEventsMap = new Map();
    originalValidEvents.forEach(event => {
        const uniqueEventKey = `${event.year_num}-${event.origin_name_viz}-${event.target_name_viz}-${event.event_type_num}`;
        if (!uniqueOriginalEventsMap.has(uniqueEventKey)) {
            uniqueOriginalEventsMap.set(uniqueEventKey, { ...event });
        }
    });

    const processedEvents = [];
    uniqueOriginalEventsMap.forEach(baseEvent => {
        // Determine the grouping key used for this baseEvent during dyadAggregates population
        let dyadTargetForLookup = baseEvent.target_name_viz;
        if (baseEvent.year_num === 1983 && baseEvent.origin_name_viz === "Nigeria") {
            const targetStringLower = baseEvent.target_name_viz ? baseEvent.target_name_viz.toLowerCase() : "";
            const textStringLower = baseEvent.event_text_viz ? baseEvent.event_text_viz.toLowerCase() : "";
            const targetsInList = targetStringLower.split(';').map(t=>t.trim());
            if (targetStringLower === "ghana" || targetsInList.includes("ghana") || textStringLower.includes("ghanaian")) {
                dyadTargetForLookup = "Ghana";
            }
        }
        const keyTargetPartLookup = dyadTargetForLookup && dyadTargetForLookup.trim() !== "" ? dyadTargetForLookup : "UnknownTarget";
        const dyadKey = `${baseEvent.year_num}-${baseEvent.origin_name_viz}-${keyTargetPartLookup}`;

        const aggregatesForThisDyad = dyadAggregates.get(dyadKey);

        if (aggregatesForThisDyad) {
            const finalEvent = { ...baseEvent };
            finalEvent.mean_estimate_num = aggregatesForThisDyad.median_estimate;
            finalEvent.lower_raw_estimate = aggregatesForThisDyad.min_estimate_in_dyad;
            finalEvent.upper_raw_estimate = aggregatesForThisDyad.max_estimate_in_dyad;
            finalEvent.num_estimates_in_group = aggregatesForThisDyad.num_estimates_in_dyad;
            finalEvent.original_data_source_ids = aggregatesForThisDyad.combined_source_ids_str;
            processedEvents.push(finalEvent);
        } else {
            const singleValue = +baseEvent.mean_estimate_num || 0;
            baseEvent.mean_estimate_num = singleValue;
            baseEvent.lower_raw_estimate = singleValue;
            baseEvent.upper_raw_estimate = singleValue;
            baseEvent.num_estimates_in_group = 1;
            processedEvents.push(baseEvent);
        }
    });
    // --- END OF PRE-PROCESSING SECTION ---

    const dataForChart = [];
    const allSourceIdsForBibliography = new Set();
    const allYearsInSelectedRange = d3.range(viewStartYear, viewEndYear + 1);

    allYearsInSelectedRange.forEach(year => {
        let yearEntry = { year: year };
        activeEventTypes.forEach(et => {
            yearEntry[`type_${et}`] = {
                value: 0,
                lower_sum: 0,
                upper_sum: 0,
                sourceIds: new Set(),
                has_uncertainty_contribution: false
            };
        });
        dataForChart.push(yearEntry);
    });

    processedEvents.forEach(event => {
        if (!activeEventTypes.has(event.event_type_num)) return;
        if (countryName && (event.origin_name_viz !== countryName && event.target_name_viz !== countryName)) return;

        const medianValue = event.mean_estimate_num;
        const lowerBoundValue = event.lower_raw_estimate;
        const upperBoundValue = event.upper_raw_estimate;
        const hadMultipleRawEstimatesInDyad = event.num_estimates_in_group > 1;
        const currentEventYear = event.year_num;

        if (currentEventYear >= viewStartYear && currentEventYear <= viewEndYear) {
            let yearData = dataForChart.find(d => d.year === currentEventYear);
            if (yearData) {
                const typeKey = `type_${event.event_type_num}`;
                if (yearData[typeKey]) {
                    const pointAggregator = yearData[typeKey];
                    if (countryName) {
                        if (event.origin_name_viz === countryName || event.target_name_viz === countryName) {
                            pointAggregator.value += medianValue;
                            pointAggregator.lower_sum += lowerBoundValue;
                            pointAggregator.upper_sum += upperBoundValue;
                            if (hadMultipleRawEstimatesInDyad) pointAggregator.has_uncertainty_contribution = true;
                            parseDataSourceIds(event.original_data_source_ids).forEach(id => pointAggregator.sourceIds.add(id));
                        }
                    } else {
                        pointAggregator.value += medianValue;
                        pointAggregator.lower_sum += lowerBoundValue;
                        pointAggregator.upper_sum += upperBoundValue;
                        if (hadMultipleRawEstimatesInDyad) pointAggregator.has_uncertainty_contribution = true;
                        parseDataSourceIds(event.original_data_source_ids).forEach(id => pointAggregator.sourceIds.add(id));
                    }
                }
                parseDataSourceIds(event.original_data_source_ids).forEach(id => allSourceIdsForBibliography.add(id));
            }
        }
    });

    // ... (rest of the charting code remains the same as your correctly working version) ...
    // Code for "No data message", scales, axes, line/area drawing, legend, bibliography update follows.

    if (dataForChart.length === 0 || dataForChart.every(d => Array.from(activeEventTypes).every(et => (d[`type_${et}`] ? d[`type_${et}`].value : 0) === 0 && (d[`type_${et}`] ? d[`type_${et}`].upper_sum : 0) === 0))) {
        const noDataMessage = countryName ? `No data for ${countryName} (selected filters).` : "No global data (selected filters).";
        lineChartPlot.append("text").text(noDataMessage)
            .attr("x", lineChartWidth / 2).attr("y", lineChartHeight / 2).attr("text-anchor", "middle")
            .attr("fill", "#666").style("font-size","12px");
        updateBibliography([]);
        return;
    }

    const effectiveLineChartWidth = lineChartWidth - 15;
    const xScale = d3.scalePoint().domain(allYearsInSelectedRange).range([0, Math.max(0, effectiveLineChartWidth)]).padding(0.2);

    let maxVal = d3.max(dataForChart, d => {
        const typeValues = Array.from(activeEventTypes).map(et => d[`type_${et}`] ? d[`type_${et}`].upper_sum : 0);
        return Math.max(0, ...typeValues);
    });
    maxVal = Math.max(10, maxVal || 10);

    const yScale = d3.scaleLinear().domain([0, maxVal]).nice().range([lineChartHeight, 0]);

    const xAxis = d3.axisBottom(xScale)
        .tickValues(xScale.domain().filter((d,i) => {
            const len = xScale.domain().length;
            const tickFrequency = Math.max(1, Math.floor(len / Math.min(len, 12)));
            return !(i % tickFrequency) || i === len - 1;
        }));
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".2s"));

    lineChartPlot.append("g").attr("class", "x-axis").attr("transform", `translate(0,${lineChartHeight})`).call(xAxis)
        .selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-45)");
    lineChartPlot.append("g").attr("class", "y-axis").call(yAxis);

    activeEventTypes.forEach(eventTypeNum => {
        const typeDetail = eventTypeDetails[eventTypeNum];
        if (!typeDetail) return;

        const typeKey = `type_${eventTypeNum}`;
        const seriesData = dataForChart.map(d => ({
            year: d.year,
            pointInfo: d[typeKey]
        })).filter(d => d.pointInfo);

        const seriesHasOverallUncertainty = seriesData.some(d => d.pointInfo.has_uncertainty_contribution);

        if (seriesHasOverallUncertainty) {
            const areaGenerator = d3.area()
                .x(d => xScale(d.year))
                .y0(d => yScale(d.pointInfo.lower_sum))
                .y1(d => yScale(d.pointInfo.upper_sum))
                .curve(d3.curveMonotoneX)
                .defined(d => d.pointInfo && (typeof d.pointInfo.lower_sum === 'number' && typeof d.pointInfo.upper_sum === 'number'));

            lineChartPlot.append("path")
                .datum(seriesData)
                .attr("fill", d3.color(typeDetail.color).copy({opacity: 0.2}))
                .attr("stroke", "none")
                .attr("class", `area-band type-${eventTypeNum}`)
                .attr("d", areaGenerator);
        }

        const medianLineGenerator = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.pointInfo.value))
            .curve(d3.curveMonotoneX)
            .defined(d => d.pointInfo && typeof d.pointInfo.value === 'number' && d.pointInfo.value >= 0);

        if (seriesData.some(d => d.pointInfo && d.pointInfo.value > 0)) {
            lineChartPlot.append("path")
                .datum(seriesData)
                .attr("fill", "none")
                .attr("stroke", typeDetail.color)
                .attr("stroke-width", 1.5)
                .attr("class", `median-line type-${eventTypeNum}`)
                .attr("d", medianLineGenerator);
        }

        const pointsDataForCircles = seriesData
            .filter(d => d.pointInfo && d.pointInfo.value > 0)
            .map(d => ({
                year: d.year,
                value: d.pointInfo.value,
                sourceIds: Array.from(d.pointInfo.sourceIds)
            }));

        if (pointsDataForCircles.length > 0) {
            const circleGroup = lineChartPlot.selectAll(`.circle-group-${eventTypeNum}`)
                .data(pointsDataForCircles)
                .join("g")
                .attr("class", `circle-group-${eventTypeNum}`)
                .attr("transform", d => {
                    const xPos = xScale(d.year);
                    const yPos = yScale(d.value);
                    if (xPos === undefined || yPos === undefined) return "translate(-100,-100)";
                    return `translate(${xPos}, ${yPos})`;
                 });

            circleGroup.append("circle")
                .attr("r", 10)
                .attr("fill", typeDetail.color)
                .attr("stroke", "white")
                .attr("stroke-width", 1);

            circleGroup.append("text")
                .text(d => (d.sourceIds.length > 0 ? d.sourceIds[0] : ""))
                .attr("text-anchor", "middle").attr("dy", "0.35em")
                .style("font-size", "9px").style("fill", "white")
                .style("pointer-events", "none");
        }
    });

    const legend = lineChartSvgElement.append("g").attr("class", "legend");
    let legendXOffset = 0;
    const legendItems = [];
    activeEventTypes.forEach(typeNum => {
        if (eventTypeDetails[typeNum]) {
             legendItems.push({ name: eventTypeDetails[typeNum].name, color: eventTypeDetails[typeNum].color });
        }
    });
    legendItems.forEach((item) => {
        const legendItemG = legend.append("g").attr("transform", `translate(${legendXOffset}, 0)`);
        legendItemG.append("rect").attr("x", 0).attr("y", -5).attr("width", 10).attr("height", 10).style("fill", item.color);
        legendItemG.append("text").attr("x", 15).attr("y", 0).attr("dy", "0.32em").text(item.name).style("font-size", "10px");
        const itemWidth = legendItemG.node().getBBox().width;
        legendXOffset += itemWidth + 15;
    });
    const totalLegendWidth = legendXOffset > 0 ? legendXOffset - 15 : 0;
    const legendYPosition = (lineChartMargin ? lineChartMargin.top : 0) + lineChartHeight + (lineChartMargin ? lineChartMargin.bottom : 0) + 15;
    const legendXPosition = ( (lineChartMargin ? lineChartMargin.left : 0) + lineChartWidth - totalLegendWidth) / 2;
    legend.attr("transform", `translate(${Math.max(0, legendXPosition)}, ${legendYPosition})`);

    updateBibliography(Array.from(allSourceIdsForBibliography));
}