// --- line_chart.js ---

const eventTypeDetails = {
    1: { name: "Expulsion", color: "#E67E22" },
    2: { name: "Deportation", color: "#2ECC71" },
    3: { name: "Repatriation", color: "#1ABC9C" },
    4: { name: "Escape", color: "#9B59B6" }
};

function parseDataSourceIds(sourceString) {
    if (!sourceString || typeof sourceString !== 'string') return [];
    const ids = sourceString.split(';')
        .map(id => id.trim())
        .filter(id => id && id !== "NA" && id !== "N/A" && id.toLowerCase() !== "unknown");
    return ids;
}

function drawOrUpdateLineChart(countryName, viewStartYear, viewEndYear) {
    lineChartPlot.selectAll("*").remove();
    lineChartSvgElement.selectAll(".line-chart-title-text").remove();
    lineChartSvgElement.selectAll(".legend").remove();

    let chartTitle = "Select a country to see trends";
    if (countryName) chartTitle = countryName;

    lineChartSvgElement.append("text")
        .attr("class", "line-chart-title-text")
        .attr("x", lineChartMargin.left + lineChartWidth / 2)
        .attr("y", lineChartMargin.top / 2)
        .attr("text-anchor", "middle")
        .text(chartTitle);

    if (typeof updateBibliography === "function") {
        updateBibliography([]);
    } else { console.warn("updateBibliography function not found."); }

    if (!countryName) {
        lineChartPlot.append("text").attr("class", "line-chart-placeholder").attr("x", lineChartWidth / 2).attr("y", lineChartHeight / 2).attr("dy", "0.35em").text("Click a country on the chord diagram.");
        return;
    }

    const annualizedDataPointsForLines = [];
    const uniqueSourceIdsFromVisibleEvents = new Set();
    const contributingOriginalEventsForMarkers = [];

    // console.log(`LineChart: Processing for ${countryName}, Type(s): ${Array.from(activeEventTypes).join(',')}, Range: ${viewStartYear}-${viewEndYear}`);
    let relevantEventsFoundCount = 0;
    let eventsWithSourceIdsCount = 0;

    activeEventTypes.forEach(eventTypeNum => {
        if (!eventTypeDetails[eventTypeNum]) return;
        const yearlyDataForType = new Map();

        originalValidEvents.forEach((event) => {
            if (event.origin_name_viz === countryName && event.event_type_num === eventTypeNum) {
                relevantEventsFoundCount++;
                const eventStartYear = event.start_year_num;
                const eventEndYear = event.end_year_num;
                const eventIsRelevantForView = Math.max(eventStartYear, viewStartYear) <= Math.min(eventEndYear, viewEndYear);

                if (eventIsRelevantForView) {
                    // console.log(`LineChart DETAIL: Event (country ${countryName}, type ${eventTypeNum}, years ${eventStartYear}-${eventEndYear})`);
                    // console.log(`  >>> Raw original_data_source_ids: '${event.original_data_source_ids}'`);
                    const eventSourceIds = parseDataSourceIds(event.original_data_source_ids);
                    // console.log(`  >>> Parsed eventSourceIds by parseDataSourceIds: ${JSON.stringify(eventSourceIds)}`);

                    if (eventSourceIds.length > 0) {
                        eventsWithSourceIdsCount++;
                        eventSourceIds.forEach(id => uniqueSourceIdsFromVisibleEvents.add(id));
                    }
                }

                const estimate = event.mean_estimate_num;
                const duration = eventEndYear - eventStartYear + 1;
                const annualEstimate = duration > 0 ? estimate / duration : 0;

                if (annualEstimate > 0) {
                    let eventAddedToMarkerList = false;
                    for (let year = eventStartYear; year <= eventEndYear; year++) {
                        if (year >= viewStartYear && year <= viewEndYear) {
                            yearlyDataForType.set(year, (yearlyDataForType.get(year) || 0) + annualEstimate);
                            if (!eventAddedToMarkerList) {
                                if (!contributingOriginalEventsForMarkers.find(e => e === event && e._view_event_type === eventTypeNum)) {
                                   contributingOriginalEventsForMarkers.push({...event, _view_event_type: eventTypeNum});
                                }
                                eventAddedToMarkerList = true;
                            }
                        }
                    }
                }
            }
        });
        Array.from(yearlyDataForType.entries()).forEach(([year, value]) => {
            annualizedDataPointsForLines.push({ type: eventTypeNum, year: parseInt(year), value: value });
        });
    });
    // console.log(`LineChart SUMMARY: For ${countryName}, Type(s): ${Array.from(activeEventTypes).join(',')}, Range: ${viewStartYear}-${viewEndYear}`);
    // console.log(`  >>> Found ${relevantEventsFoundCount} events matching country/type.`);
    // console.log(`  >>> Of these, ${eventsWithSourceIdsCount} had parsable source IDs based on current view.`);
    // console.log(`  >>> Collected ${uniqueSourceIdsFromVisibleEvents.size} unique source IDs for bibliography.`);
    // console.log(`  >>> Collected ${contributingOriginalEventsForMarkers.length} original events for markers.`);

    const hasAnyLineData = annualizedDataPointsForLines.length > 0;

    if (typeof updateBibliography === "function") {
        updateBibliography(Array.from(uniqueSourceIdsFromVisibleEvents));
    }

    if (!hasAnyLineData && contributingOriginalEventsForMarkers.length === 0) {
        lineChartPlot.append("text").attr("class", "line-chart-placeholder").attr("x", lineChartWidth / 2).attr("y", lineChartHeight / 2).attr("dy", "0.35em").text(`No data for selected filters.`);
        return;
    }

    const minYearDomain = hasAnyLineData ? d3.min(annualizedDataPointsForLines, d => d.year) : viewStartYear;
    const maxYearDomain = hasAnyLineData ? d3.max(annualizedDataPointsForLines, d => d.year) : viewEndYear;
    const yearDomain = [Math.min(viewStartYear, minYearDomain), Math.max(viewEndYear, maxYearDomain)];
    const xScale = d3.scaleLinear().domain(yearDomain).range([0, lineChartWidth]);
    const maxYValue = hasAnyLineData ? d3.max(annualizedDataPointsForLines, d => d.value) : 0;
    const yScale = d3.scaleLinear().domain([0, maxYValue || 1]).range([lineChartHeight, 0]).nice();

    lineChartPlot.append("g").attr("class", "axis axis--x").attr("transform", `translate(0,${lineChartHeight})`).call(d3.axisBottom(xScale).ticks(Math.min(yearDomain[1] - yearDomain[0] + 1, 10)).tickFormat(d3.format("d"))).selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-45)");
    lineChartPlot.append("g").attr("class", "axis axis--y").call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".2s")));

    const lineGenerator = d3.line().x(d => xScale(d.year)).y(d => yScale(d.value)).curve(d3.curveMonotoneX);
    const groupedLineData = d3.group(annualizedDataPointsForLines, d => d.type);

    // Draw lines first
    groupedLineData.forEach((typeData, eventTypeNum) => {
        if (typeData.length > 0) {
            const sortedTypeData = typeData.sort((a, b) => a.year - b.year);
            lineChartPlot.append("path").datum(sortedTypeData).attr("class", "line")
                .style("stroke", eventTypeDetails[eventTypeNum] ? eventTypeDetails[eventTypeNum].color : "#ccc")
                .style("fill", "none").attr("d", lineGenerator);
        }
    });

    // Draw citation markers (circles with numbers)
    const citationMarkerGroup = lineChartPlot.append("g").attr("class", "citation-marker-group");
    const dataCircleRadius = 9;
    const markerTextFontSize = "8px";
    const maskCircleRadius = dataCircleRadius + 1; // For line disruption effect

    const plottedMarkersInfo = new Map();
    contributingOriginalEventsForMarkers.forEach(event => {
        const eventSourceIds = parseDataSourceIds(event.original_data_source_ids);
        if (eventSourceIds.length === 0) return;
        const firstSourceIdToDisplay = eventSourceIds[0];

        let representativeYear = -1;
        let yValueForMarker;
        const linePointsForThisEventType = annualizedDataPointsForLines.filter(p => p.type === event._view_event_type);

        for (let y = event.start_year_num; y <= event.end_year_num; y++) {
            if (y >= viewStartYear && y <= viewEndYear) {
                const pointData = linePointsForThisEventType.find(p => p.year === y);
                if (pointData) {
                    representativeYear = y;
                    yValueForMarker = pointData.value;
                    break;
                }
            }
        }

        if (representativeYear !== -1 && yValueForMarker !== undefined && yValueForMarker >= 0) {
            const cx = xScale(representativeYear);
            const cy = yScale(yValueForMarker);
            const markerKey = `${cx.toFixed(1)},${cy.toFixed(1)},${firstSourceIdToDisplay}`;
            if (plottedMarkersInfo.has(markerKey)) return;
            plottedMarkersInfo.set(markerKey, true);

            // 1. Masking circle for line disruption
            citationMarkerGroup.append("circle").attr("class", "mask").attr("cx", cx).attr("cy", cy).attr("r", maskCircleRadius);

            const markerG = citationMarkerGroup.append("g").attr("class", "citation-marker").attr("transform", `translate(${cx},${cy})`);
            markerG.append("circle").attr("class", "data-circle").attr("r", dataCircleRadius).style("fill", eventTypeDetails[event._view_event_type] ? eventTypeDetails[event._view_event_type].color : "#999").style("stroke", "none");
            markerG.append("text").text(firstSourceIdToDisplay.length > 3 ? firstSourceIdToDisplay.substring(0, 3) : firstSourceIdToDisplay).style("font-size", markerTextFontSize).style("fill", "black").style("text-anchor", "middle").style("dominant-baseline", "central");
            markerG.append("title").text(`Source ID(s): ${eventSourceIds.join(', ')}\nEvent: ${event.start_year_num}-${event.end_year_num}, Total Est: ${formatNumber(event.mean_estimate_num)}`);
        }
    });

    const legend = lineChartSvgElement.append("g").attr("class", "legend");
    let legendItemXOffset = 0;
    const legendItemsRendered = [];
    activeEventTypes.forEach(eventTypeNum => {
        if (eventTypeDetails[eventTypeNum]) {
            const detail = eventTypeDetails[eventTypeNum];
            const tempText = legend.append("text").text(detail.name).style("font-size", "10px").style("opacity",0);
            const textWidth = tempText.node().getComputedTextLength();
            tempText.remove();
            const itemWidth = 10 + 5 + textWidth + 15;
            legendItemsRendered.push({ detail, width: itemWidth });
            legendItemXOffset += itemWidth;
        }
    });
    const totalLegendWidthActual = legendItemXOffset - (legendItemsRendered.length > 0 ? 15 : 0);
    let currentXLegend = (lineChartWidth - totalLegendWidthActual) / 2;
    if (currentXLegend < 0) currentXLegend = 0;
    legendItemsRendered.forEach(item => {
        const legendItemG = legend.append("g").attr("transform", `translate(${currentXLegend}, 0)`);
        legendItemG.append("rect").attr("width", 10).attr("height", 10).style("fill", item.detail.color);
        legendItemG.append("text").attr("x", 15).attr("y", 9).style("font-size", "10px").text(item.detail.name);
        currentXLegend += item.width;
    });
    const legendYPosition = lineChartMargin.top + lineChartHeight + lineChartMargin.bottom + (legendHeightEstimate / 2) - 5;
    legend.attr("transform", `translate(${lineChartMargin.left}, ${legendYPosition})`);
}