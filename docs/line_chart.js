// --- line_chart.js ---
// Complete version with working download functionality and bubbles always on top

// Global variables
let lineChartDownloadButton = null;

// Utility functions
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
    return sortedValues.length % 2 === 0
        ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
        : sortedValues[mid];
}

// Download button functions
function createDownloadButton(viewStartYear, viewEndYear) {
    // Verify container exists
    const container = d3.select("#line-chart-container-wrapper");
    if (container.empty()) return false;

    // Ensure container has proper positioning
    container.style("position", "relative");

    // Remove existing button if present
    d3.select("#line-chart-download-button").remove();

    // Create new button with year parameters
    lineChartDownloadButton = container
        .append("div")
        .attr("id", "line-chart-download-button")
        .html("&#128247;")
        .style("position", "absolute")
        .style("top", "10px")
        .style("left", "10px")
        .style("cursor", "pointer")
        .style("z-index", "1000")
        .style("font-size", "20px")
        .style("line-height", "1")
        .style("background-color", "rgba(220, 220, 220, 0.6)")
        .style("color", "#333")
        .style("border", "1px solid #bbb")
        .style("border-radius", "50%")
        .style("width", "32px")
        .style("height", "32px")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("box-shadow", "0 2px 4px rgba(0,0,0,0.15)")
        .style("transition", "all 0.2s ease-in-out")
        .style("padding", "0")
        .on("mouseover", function() {
            d3.select(this)
                .style("background-color", "rgba(180, 180, 180, 0.8)")
                .style("color", "#000")
                .style("box-shadow", "0 3px 6px rgba(0,0,0,0.2)");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("background-color", "rgba(220, 220, 220, 0.6)")
                .style("color", "#333")
                .style("box-shadow", "0 2px 4px rgba(0,0,0,0.15)");
        })
        .on("click", function() {
            downloadLineChart(viewStartYear, viewEndYear);
        });

    return true;
}

function downloadLineChart(startYear, endYear) {
    if (!lineChartSvgElement || !lineChartSvgElement.node()) return;

    // Clone the SVG
    const svgElement = lineChartSvgElement.node().cloneNode(true);

    // Remove button from clone
    const button = svgElement.querySelector('#line-chart-download-button');
    if (button) button.remove();

    // Set attributes
    svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svgElement.setAttribute("version", "1.1");

    // Add metadata with the provided years
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `Migration Trends ${startYear}-${endYear}`;
    svgElement.insertBefore(title, svgElement.firstChild);

    // Add styles
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
        .median-line { stroke-width: 1.5; }
        .area-band { fill-opacity: 0.2; }
        .bubble-group { z-index: 1000; }
        text { font-family: Arial, sans-serif; }
    `;
    svgElement.insertBefore(style, svgElement.firstChild);

    // Serialize and download
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgElement);
    svgStr = svgStr.replace(/xlink:href/g, 'href');

    const svgBlob = new Blob([svgStr], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `migration-trends-${startYear}-${endYear}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Main chart function
function drawOrUpdateLineChart(countryName, viewStartYear, viewEndYear) {
    // Create download button with current years
    createDownloadButton(viewStartYear, viewEndYear);

    if (!lineChartPlot || !lineChartSvgElement || !lineChartPlot.node()) return;

    // Clear existing elements
    lineChartPlot.selectAll("*").remove();
    lineChartSvgElement.selectAll(".line-chart-title-text").remove();
    lineChartSvgElement.selectAll(".legend").remove();

    if (!originalValidEvents || originalValidEvents.length === 0) {
        lineChartPlot.append("text")
            .text("No data loaded.")
            .attr("x", lineChartWidth/2)
            .attr("y", lineChartHeight/2)
            .attr("text-anchor", "middle")
            .style("font-size","12px");
        updateBibliography([]);
        return;
    }

    // --- SECTION FOR DYAD-LEVEL (YEAR-ORIGIN-TARGET) MEDIAN, MIN, MAX CALCULATION ---
    const dyadAggregates = new Map();
    originalValidEvents.forEach(event => {
        let dyadTargetForGrouping = event.target_name_viz;

        if (event.year_num === 1983 && event.origin_name_viz === "Nigeria") {
            const targetStringLower = event.target_name_viz ? event.target_name_viz.toLowerCase() : "";
            const textStringLower = event.event_text_viz ? event.event_text_viz.toLowerCase() : "";
            const targetsInList = targetStringLower.split(';').map(t => t.trim());
            if (targetStringLower === "ghana" || targetsInList.includes("ghana") || textStringLower.includes("ghanaian")) {
                dyadTargetForGrouping = "Ghana";
            }
        }

        const keyTargetPart = dyadTargetForGrouping && dyadTargetForGrouping.trim() !== ""
            ? dyadTargetForGrouping
            : "UnknownTarget";
        const dyadKey = `${event.year_num}-${event.origin_name_viz}-${keyTargetPart}`;

        if (!dyadAggregates.has(dyadKey)) {
            dyadAggregates.set(dyadKey, {
                values: [],
                sourceIds: new Set()
            });
        }

        const group = dyadAggregates.get(dyadKey);
        group.values.push(+event.mean_estimate_num || 0);
        parseDataSourceIds(event.original_data_source_ids).forEach(id => group.sourceIds.add(id));
    });

    dyadAggregates.forEach(agg => {
        const numericValuesForMinMax = agg.values.map(v => +v).filter(v => !isNaN(v));
        agg.median_estimate = calculateMedian(agg.values);
        agg.num_estimates_in_dyad = agg.values.length;

        if (agg.num_estimates_in_dyad > 1 && numericValuesForMinMax.length > 0) {
            agg.min_estimate_in_dyad = d3.min(numericValuesForMinMax);
            agg.max_estimate_in_dyad = d3.max(numericValuesForMinMax);
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
        let dyadTargetForLookup = baseEvent.target_name_viz;
        if (baseEvent.year_num === 1983 && baseEvent.origin_name_viz === "Nigeria") {
            const targetStringLower = baseEvent.target_name_viz ? baseEvent.target_name_viz.toLowerCase() : "";
            const textStringLower = baseEvent.event_text_viz ? baseEvent.event_text_viz.toLowerCase() : "";
            const targetsInList = targetStringLower.split(';').map(t=>t.trim());
            if (targetStringLower === "ghana" || targetsInList.includes("ghana") || textStringLower.includes("ghanaian")) {
                dyadTargetForLookup = "Ghana";
            }
        }

        const keyTargetPartLookup = dyadTargetForLookup && dyadTargetForLookup.trim() !== ""
            ? dyadTargetForLookup
            : "UnknownTarget";
        const dyadKey = `${baseEvent.year_num}-${baseEvent.origin_name_viz}-${keyTargetPartLookup}`;

        const aggregatesForThisDyad = dyadAggregates.get(dyadKey);

        if (aggregatesForThisDyad) {
            const finalEvent = {
                ...baseEvent,
                mean_estimate_num: aggregatesForThisDyad.median_estimate,
                lower_raw_estimate: aggregatesForThisDyad.min_estimate_in_dyad,
                upper_raw_estimate: aggregatesForThisDyad.max_estimate_in_dyad,
                num_estimates_in_group: aggregatesForThisDyad.num_estimates_in_dyad,
                original_data_source_ids: aggregatesForThisDyad.combined_source_ids_str
            };
            processedEvents.push(finalEvent);
        } else {
            const singleValue = +baseEvent.mean_estimate_num || 0;
            processedEvents.push({
                ...baseEvent,
                mean_estimate_num: singleValue,
                lower_raw_estimate: singleValue,
                upper_raw_estimate: singleValue,
                num_estimates_in_group: 1
            });
        }
    });

    // Prepare chart data
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

    if (dataForChart.length === 0 || dataForChart.every(d => Array.from(activeEventTypes).every(et => (d[`type_${et}`] ? d[`type_${et}`].value : 0) === 0 && (d[`type_${et}`] ? d[`type_${et}`].upper_sum : 0) === 0))) {
        const noDataMessage = countryName
            ? `No data for ${countryName} (selected filters).`
            : "No global data (selected filters).";
        lineChartPlot.append("text")
            .text(noDataMessage)
            .attr("x", lineChartWidth / 2)
            .attr("y", lineChartHeight / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .style("font-size","12px");
        updateBibliography([]);
        return;
    }

    // Render chart
    const effectiveLineChartWidth = lineChartWidth - 15;
    const xScale = d3.scalePoint()
        .domain(allYearsInSelectedRange)
        .range([0, Math.max(0, effectiveLineChartWidth)])
        .padding(0.2);

    let maxVal = d3.max(dataForChart, d => {
        const typeValues = Array.from(activeEventTypes).map(et => d[`type_${et}`] ? d[`type_${et}`].upper_sum : 0);
        return Math.max(0, ...typeValues);
    });
    maxVal = Math.max(10, maxVal || 10);

    const yScale = d3.scaleLinear()
        .domain([0, maxVal])
        .nice()
        .range([lineChartHeight, 0]);

    const xAxis = d3.axisBottom(xScale)
        .tickValues(xScale.domain().filter((d,i) => {
            const len = xScale.domain().length;
            const tickFrequency = Math.max(1, Math.floor(len / Math.min(len, 12)));
            return !(i % tickFrequency) || i === len - 1;
        }));

    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d3.format(".2s"));

    lineChartPlot.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${lineChartHeight})`)
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    lineChartPlot.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

    // Store bubble data to render last (on top)
    const allBubbleData = [];

    activeEventTypes.forEach(eventTypeNum => {
        const typeDetail = eventTypeDetails[eventTypeNum];
        if (!typeDetail) return;

        const typeKey = `type_${eventTypeNum}`;
        const seriesData = dataForChart.map(d => ({
            year: d.year,
            pointInfo: d[typeKey]
        })).filter(d => d.pointInfo);

        const seriesHasOverallUncertainty = seriesData.some(d => d.pointInfo.has_uncertainty_contribution);

        // Render uncertainty areas first (bottom layer)
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

        // Render median lines second (middle layer)
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

        // Collect bubble data for rendering last (top layer)
        const pointsDataForCircles = seriesData
            .filter(d => d.pointInfo && d.pointInfo.value > 0)
            .map(d => ({
                year: d.year,
                value: d.pointInfo.value,
                sourceIds: Array.from(d.pointInfo.sourceIds),
                color: typeDetail.color,
                eventTypeNum: eventTypeNum
            }));

        allBubbleData.push(...pointsDataForCircles);
    });

    // Render all bubbles last to ensure they're on top
    if (allBubbleData.length > 0) {
        const bubbleContainer = lineChartPlot.append("g")
            .attr("class", "bubble-container")
            .style("z-index", "1000");

        allBubbleData.forEach(bubbleData => {
            const bubbleGroup = bubbleContainer.append("g")
                .attr("class", `bubble-group bubble-group-${bubbleData.eventTypeNum}`)
                .attr("transform", `translate(${xScale(bubbleData.year)}, ${yScale(bubbleData.value)})`);

            // Add white outline for better visibility
            bubbleGroup.append("circle")
                .attr("r", 6) // smaller white outline
                .attr("fill", "white")
                .attr("stroke", "none")
                .style("opacity", 0.8);

            const mainCircle = bubbleGroup.append("circle")
                .attr("r", 5) // smaller colored circle
                .attr("fill", bubbleData.color)
                .attr("stroke", "none") // no white border
                .style("cursor", "pointer");

            // Tooltip logic
            mainCircle.on("mouseover", function(event) {
                d3.select("#bubble-tooltip").remove();
                const year = bubbleData.year;
                const eventsForYear = processedEvents.filter(e => e.year_num === year);
                const grouped = {};
                eventsForYear.forEach(e => {
                    const key = `${e.origin_name_viz}||${e.target_name_viz}`;
                    if (!grouped[key]) {
                        grouped[key] = {
                            origin: e.origin_name_viz,
                            target: e.target_name_viz,
                            median: 0,
                            sourceIds: new Set()
                        };
                    }
                    grouped[key].median += +e.mean_estimate_num || 0;
                    parseDataSourceIds(e.original_data_source_ids).forEach(id => grouped[key].sourceIds.add(id));
                });
                const top10 = Object.values(grouped)
                    .sort((a, b) => b.median - a.median)
                    .slice(0, 10);
                let tooltipHtml = `<div style='font-size:13px; font-weight:bold; margin-bottom:4px; font-family:Times New Roman, Times, serif;'>Year: ${year}</div>`;
                tooltipHtml += `<div style='font-size:12px; margin-bottom:4px; font-family:Times New Roman, Times, serif;'>Sum of median estimates: <b>${bubbleData.value}</b></div>`;
                tooltipHtml += `<table style='font-size:11px; border-collapse:collapse; font-family:Times New Roman, Times, serif;'><thead><tr style='background:#eee;'><th style='padding:2px 6px;'>Origin</th><th style='padding:2px 6px;'>Target</th><th style='padding:2px 6px;'>Median</th><th style='padding:2px 6px;'>Data Source IDs</th></tr></thead><tbody>`;
                top10.forEach(row => {
                    tooltipHtml += `<tr><td style='padding:2px 6px;'>${row.origin}</td><td style='padding:2px 6px;'>${row.target}</td><td style='padding:2px 6px;'>${row.median}</td><td style='padding:2px 6px;'>${Array.from(row.sourceIds).join(', ')}</td></tr>`;
                });
                tooltipHtml += `</tbody></table>`;
                d3.select("body").append("div")
                    .attr("id", "bubble-tooltip")
                    .style("position", "absolute")
                    .style("background", "#fff")
                    .style("border", "1px solid #aaa")
                    .style("border-radius", "6px")
                    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
                    .style("padding", "8px 10px")
                    .style("pointer-events", "none")
                    .style("z-index", 2000)
                    .style("font-family", "Times New Roman, Times, serif")
                    .html(tooltipHtml)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mousemove", function(event) {
                // Position the tooltip so it stays within the viewport
                const tooltip = d3.select("#bubble-tooltip");
                if (!tooltip.empty()) {
                    const tooltipNode = tooltip.node();
                    const tooltipWidth = tooltipNode.offsetWidth;
                    const tooltipHeight = tooltipNode.offsetHeight;
                    const pageWidth = window.innerWidth;
                    const pageHeight = window.innerHeight;
                    let left = event.pageX + 20;
                    let top = event.pageY + 10;
                    // If tooltip would go off the right edge, show it to the left of the cursor
                    if (left + tooltipWidth > pageWidth - 10) {
                        left = event.pageX - tooltipWidth - 20;
                    }
                    // If tooltip would go off the bottom edge, move it up
                    if (top + tooltipHeight > pageHeight - 10) {
                        top = event.pageY - tooltipHeight - 10;
                    }
                    tooltip.style("left", left + "px").style("top", top + "px");
                }
            })
            .on("mouseout", function() {
                d3.select("#bubble-tooltip").remove();
            });
        });
    }

    const legend = lineChartSvgElement.append("g").attr("class", "legend");
    let legendXOffset = 0;
    const legendItems = [];

    activeEventTypes.forEach(typeNum => {
        if (eventTypeDetails[typeNum]) {
            legendItems.push({
                name: eventTypeDetails[typeNum].name,
                color: eventTypeDetails[typeNum].color
            });
        }
    });

    legendItems.forEach((item) => {
        const legendItemG = legend.append("g")
            .attr("transform", `translate(${legendXOffset}, 0)`);

        legendItemG.append("rect")
            .attr("x", 0)
            .attr("y", -5)
            .attr("width", 10)
            .attr("height", 10)
            .style("fill", item.color);

        legendItemG.append("text")
            .attr("x", 15)
            .attr("y", 0)
            .attr("dy", "0.32em")
            .text(item.name)
            .style("font-size", "10px");

        legendXOffset += legendItemG.node().getBBox().width + 15;
    });

    const totalLegendWidth = legendXOffset > 0 ? legendXOffset - 15 : 0;
    const legendYPosition = (lineChartMargin ? lineChartMargin.top : 0) + lineChartHeight + (lineChartMargin ? lineChartMargin.bottom : 0) + 15;
    const legendXPosition = ((lineChartMargin ? lineChartMargin.left : 0) + lineChartWidth - totalLegendWidth) / 2;

    legend.attr("transform", `translate(${Math.max(0, legendXPosition)}, ${legendYPosition})`);

    updateBibliography(Array.from(allSourceIdsForBibliography));
}