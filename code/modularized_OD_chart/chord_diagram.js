// --- chord_diagram.js ---

// Assumes d3 is globally available
// Map to store fixed colors for each country
const countryColorMap = new Map();

// Function to generate a lively, somewhat random color
function generateLivelyColor() {
    const hue = Math.random() * 360;
    const saturation = 0.75 + Math.random() * 0.25; // Saturation between 0.75 and 1.0
    const lightness = 0.55 + Math.random() * 0.1;  // Lightness between 0.55 and 0.65
    return d3.hsl(hue, saturation, lightness).toString();
}

function updateChart(selectedStartYear, selectedEndYear) {
    const linkAggregates = new Map();
    const nodeIdsInFilteredData = new Set();
    let totalFilteredValue = 0;

    originalValidEvents.forEach(d => {
        if (!activeEventTypes.has(d.event_type_num)) { return; }
        const eventStart = d.start_year_num;
        const eventEnd = d.end_year_num;
        const estimate = d.mean_estimate_num;
        const origin = d.origin_name_viz;
        const target = d.target_name_viz;

        if (!origin || !target) {
            return;
        }
        if (eventStart > eventEnd || estimate <= 0) { return; }

        const overlapStart = Math.max(eventStart, selectedStartYear);
        const overlapEnd = Math.min(eventEnd, selectedEndYear);
        const overlapDuration = overlapEnd - overlapStart + 1;

        if (overlapDuration > 0) {
            const eventDuration = eventEnd - eventStart + 1;
            const proportion = eventDuration > 0 ? overlapDuration / eventDuration : 0;
            const adjustedEstimate = estimate * proportion;
            if (adjustedEstimate > 0) {
                const key = `${origin}->${target}`;
                const currentSum = linkAggregates.get(key) || 0;
                linkAggregates.set(key, currentSum + adjustedEstimate);
                nodeIdsInFilteredData.add(origin);
                nodeIdsInFilteredData.add(target);
                totalFilteredValue += adjustedEstimate;
            }
        }
    });

    chordSvg.selectAll(".groups").remove();
    chordSvg.selectAll(".chords").remove();
    chordSvg.selectAll(".no-data-text").remove();

    if (nodeIdsInFilteredData.size === 0 || totalFilteredValue <= 0) {
        chordSvg.append("text").attr("class", "no-data-text").text("No data for selected chord filters.").attr("text-anchor", "middle").attr("dy", "0.3em").attr("fill", "#666");
        if (selectedCountryForLineChart) {
            drawOrUpdateLineChart(selectedCountryForLineChart, selectedStartYear, selectedEndYear);
        } else {
            drawOrUpdateLineChart(null, selectedStartYear, selectedEndYear);
        }
        return;
    }

    const nodeIdList = Array.from(nodeIdsInFilteredData).sort();
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

    // Ensure all nodes in the current view have a color in the map
    nodeIdList.forEach(id => {
        if (!countryColorMap.has(id)) {
            countryColorMap.set(id, generateLivelyColor());
        }
    });

    // Create a D3 color scale using the fixed colors from the map
    const color = d3.scaleOrdinal()
        .domain(nodeIdList)
        .range(nodeIdList.map(id => countryColorMap.get(id)));

    const chordLayout = d3.chord().padAngle(arcPadAngle).sortGroups(d3.descending).sortChords(null);
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
        .each(function(d) { d.filteredValue = matrix[d.source.index][d.target.index]; });

    const handleGroupMouseOver = (event, d_group) => {
        const countryName = nodeIdList[d_group.index];
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
        const sourceName = nodeIdList[d_chord.source.index];
        const targetName = nodeIdList[d_chord.target.index];
        let tooltipHtml = `<b>Migration from ${sourceName} to ${targetName}</b>\n`;
        tooltipHtml += `Aggregated estimate of Migration: ${formatNumber(d_chord.filteredValue)}`;
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

function handleGroupClick(event, d) {
    event.stopPropagation();
    const groupElement = d3.select(this.parentNode);
    const countryName = groupElement.select("text").text();
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
