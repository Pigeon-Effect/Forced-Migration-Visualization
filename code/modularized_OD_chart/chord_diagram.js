// --- chord_diagram.js ---

// Assumes d3 is globally available
const countryColorMap = new Map();
let nodeIdList = []; // << Declare nodeIdList in the module scope

// Function to generate a lively, somewhat random color
function generateLivelyColor() {
    const hue = Math.random() * 360;
    const saturation = 0.75 + Math.random() * 0.25; // Saturation between 0.75 and 1.0
    const lightness = 0.55 + Math.random() * 0.1;  // Lightness between 0.55 and 0.65
    return d3.hsl(hue, saturation, lightness).toString();
}

function updateChart(selectedStartYear, selectedEndYear) {
    // Step 1: Filter originalValidEvents by activeEventTypes first
    const relevantEvents = originalValidEvents.filter(d => activeEventTypes.has(d.event_type_num));

    // Step 2: Calculate and store annual estimates, preparing for averaging
    const yearlyAggregatedEstimates = new Map();

    relevantEvents.forEach(event => {
        if (!event.origin_name_viz || !event.target_name_viz || event.mean_estimate_num <= 0) {
            return;
        }
        const duration = event.end_year_num - event.start_year_num + 1;
        if (duration <= 0) return;
        const annualEstimate = event.mean_estimate_num / duration;
        const expelledGroupKey = String(event.expelled_group || 'N/A').trim();

        for (let year = event.start_year_num; year <= event.end_year_num; year++) {
            if (!yearlyAggregatedEstimates.has(year)) {
                yearlyAggregatedEstimates.set(year, new Map());
            }
            const yearMap = yearlyAggregatedEstimates.get(year);
            const uniqueKeyParams = [event.origin_name_viz, event.target_name_viz, expelledGroupKey, event.event_type_num];
            const uniqueKeyString = JSON.stringify(uniqueKeyParams);

            if (!yearMap.has(uniqueKeyString)) {
                yearMap.set(uniqueKeyString, { sumAnnual: 0, count: 0 });
            }
            const stats = yearMap.get(uniqueKeyString);
            stats.sumAnnual += annualEstimate;
            stats.count += 1;
        }
    });

    // Step 3: Calculate final averaged annual rates
    const finalAnnualRates = new Map();
    for (const [year, yearMap] of yearlyAggregatedEstimates) {
        const finalYearRatesMap = new Map();
        for (const [uniqueKeyString, stats] of yearMap) {
            if (stats.count > 0) {
                finalYearRatesMap.set(uniqueKeyString, stats.sumAnnual / stats.count);
            }
        }
        if (finalYearRatesMap.size > 0) {
            finalAnnualRates.set(year, finalYearRatesMap);
        }
    }

    // Step 4: Aggregate these final rates for the chord diagram links based on selected year range
    const linkAggregates = new Map();
    const nodeIdsInFilteredData = new Set(); // This will be used to populate the module-scoped nodeIdList
    let totalFilteredValue = 0;

    for (let year = selectedStartYear; year <= selectedEndYear; year++) {
        if (finalAnnualRates.has(year)) {
            const yearRatesMap = finalAnnualRates.get(year);
            for (const [uniqueKeyString, averagedAnnualRate] of yearRatesMap) {
                const [origin, target, _expelledGroup, eventTypeNum] = JSON.parse(uniqueKeyString);

                if (activeEventTypes.has(eventTypeNum)) {
                    const chordKey = `${origin}->${target}`;
                    linkAggregates.set(chordKey, (linkAggregates.get(chordKey) || 0) + averagedAnnualRate);
                    nodeIdsInFilteredData.add(origin); // Collect unique node IDs
                    nodeIdsInFilteredData.add(target); // Collect unique node IDs
                    totalFilteredValue += averagedAnnualRate;
                }
            }
        }
    }

    chordSvg.selectAll(".groups").remove();
    chordSvg.selectAll(".chords").remove();
    chordSvg.selectAll(".no-data-text").remove();

    // Update the module-scoped nodeIdList
    nodeIdList = Array.from(nodeIdsInFilteredData).sort();

    if (nodeIdList.length === 0 || totalFilteredValue <= 0) {
        chordSvg.append("text").attr("class", "no-data-text").text("No data for selected chord filters.").attr("text-anchor", "middle").attr("dy", "0.3em").attr("fill", "#666");
        if (selectedCountryForLineChart) {
            drawOrUpdateLineChart(selectedCountryForLineChart, selectedStartYear, selectedEndYear);
        } else {
            drawOrUpdateLineChart(null, selectedStartYear, selectedEndYear);
        }
        return;
    }

    const nodeIndex = new Map(nodeIdList.map((id, i) => [id, i]));
    const numNodes = nodeIdList.length;
    const matrix = Array(numNodes).fill(0).map(() => Array(numNodes).fill(0));

    linkAggregates.forEach((value, key) => {
        const [source, target] = key.split('->');
        const sourceIdx = nodeIndex.get(source);
        const targetIdx = nodeIndex.get(target);
        if (sourceIdx !== undefined && targetIdx !== undefined) {
            matrix[sourceIdx][targetIdx] = value;
        }
    });

    nodeIdList.forEach(id => {
        if (!countryColorMap.has(id)) {
            countryColorMap.set(id, generateLivelyColor());
        }
    });

    const color = d3.scaleOrdinal()
        .domain(nodeIdList)
        .range(nodeIdList.map(id => countryColorMap.get(id)));

    const chordLayout = d3.chord().padAngle(arcPadAngle).sortGroups(d3.descending).sortSubgroups(d3.descending).sortChords(null);
    let chords;
    try {
        chords = chordLayout(matrix);
    } catch (layoutError) {
        console.error("Error during chord layout:", layoutError);
        chordSvg.append("text").attr("class", "no-data-text").text("Layout Error.").attr("text-anchor", "middle").attr("dy", "0.3em").attr("fill", "red");
        return;
    }

    const arcGenerator = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbonGenerator = d3.ribbon().radius(innerRadius).padAngle(chordPadAngle);

    const group = chordSvg.append("g").attr("class", "groups").selectAll("g")
        .data(chords.groups).join("g").attr("class", "group");

    const groupPath = group.append("path")
        .attr("d", arcGenerator)
        .attr("fill", d => color(nodeIdList[d.index]))
        .attr("stroke", d => d3.rgb(color(nodeIdList[d.index])).darker());

    group.append("text")
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", "0.35em")
        .attr("transform", d => `rotate(${(d.angle * 180 / Math.PI - 90)}) translate(${outerRadius + labelOffset}) ${d.angle > Math.PI ? "rotate(180)" : ""}`)
        .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
        .text(d => nodeIdList[d.index]);

    const ribbon = chordSvg.append("g").attr("class", "chords").attr("fill-opacity", 0.7).selectAll("path")
        .data(chords).join("path")
        .attr("class", "chord")
        .attr("d", ribbonGenerator)
        .attr("fill", d => color(nodeIdList[d.source.index]))
        .attr("stroke", d => d3.rgb(color(nodeIdList[d.source.index])).darker())
        .each(function(d) {
            d.aggregatedValue = matrix[d.source.index][d.target.index];
        });

    const handleGroupMouseOver = (event, d_group) => {
        const countryName = nodeIdList[d_group.index]; // nodeIdList is now module-scoped
        let tooltipHtml = `<b>${countryName}</b>\n`;
        tooltipHtml += "(Forced) Migration to:\n";
        let outgoingFlows = [];

        for (let targetIndex = 0; targetIndex < numNodes; targetIndex++) {
            if (d_group.index !== targetIndex && matrix[d_group.index][targetIndex] > 0) {
                outgoingFlows.push({
                    targetName: nodeIdList[targetIndex],
                    value: matrix[d_group.index][targetIndex]
                });
            }
        }
        outgoingFlows.sort((a, b) => b.value - a.value);
        const top5Destinations = outgoingFlows.slice(0, 5);

        if (top5Destinations.length > 0) {
            const destinationsString = top5Destinations
                .map(flow => `  • ${flow.targetName} (${formatNumber(flow.value)})`)
                .join('\n');
            tooltipHtml += destinationsString;
        } else {
            tooltipHtml += "  No outgoing migration recorded in this period.";
        }
        tooltip.html(tooltipHtml.trim()).transition().duration(200).style("opacity", 1);
        groupPath.classed("faded", p => p.index !== d_group.index);
        chordSvg.selectAll(".group text").classed("faded", p => p.index !== d_group.index);
        ribbon.classed("faded", c => c.source.index !== d_group.index && c.target.index !== d_group.index);
    };

    const handleChordMouseOver = (event, d_chord) => {
        const sourceName = nodeIdList[d_chord.source.index]; // nodeIdList is now module-scoped
        const targetName = nodeIdList[d_chord.target.index]; // nodeIdList is now module-scoped
        let tooltipHtml = `<b>Migration from ${sourceName} to ${targetName}</b>\n`;
        tooltipHtml += `Aggregated estimate of Migration: ${formatNumber(d_chord.aggregatedValue)}`;
        tooltip.html(tooltipHtml.trim()).transition().duration(200).style("opacity", 1);
        ribbon.classed("faded", c => c !== d_chord);
        groupPath.classed("faded", p => p.index !== d_chord.source.index && p.index !== d_chord.target.index);
        chordSvg.selectAll(".group text").classed("faded", p => p.index !== d_chord.source.index && p.index !== d_chord.target.index);
    };

    const handleMouseMove = (event) => {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 10) + "px");
    };

    const handleMouseOut = () => {
        tooltip.transition().duration(200).style("opacity", 0);
        groupPath.classed("faded", false);
        chordSvg.selectAll(".group text").classed("faded", false);
        ribbon.classed("faded", false);
    };

    // Event handlers are set up here. handleGroupClick will now have access to the module-scoped nodeIdList
    groupPath.on("mouseover", handleGroupMouseOver)
             .on("mousemove", handleMouseMove)
             .on("mouseout", handleMouseOut)
             .on("click", handleGroupClick);

    ribbon.on("mouseover", handleChordMouseOver)
          .on("mousemove", handleMouseMove)
          .on("mouseout", handleMouseOut);

    if (selectedCountryForLineChart) {
        drawOrUpdateLineChart(selectedCountryForLineChart, selectedStartYear, selectedEndYear);
    } else {
         drawOrUpdateLineChart(null, selectedStartYear, selectedEndYear);
    }
}

// handleGroupClick uses the module-scoped nodeIdList
function handleGroupClick(event, d) { // d is the D3 datum for the clicked group
    event.stopPropagation();
    const countryName = nodeIdList[d.index]; // Access module-scoped nodeIdList
    selectedCountryForLineChart = countryName;

    if (yearSliderInstance) {
        const currentSliderValues = yearSliderInstance.get();
        const startYear = parseInt(currentSliderValues[0]);
        const endYear = parseInt(currentSliderValues[1]);
        if (typeof drawOrUpdateLineChart === "function") {
            drawOrUpdateLineChart(selectedCountryForLineChart, startYear, endYear);
        }
    }
}
