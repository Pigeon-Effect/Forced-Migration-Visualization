// --- chord_diagram.js ---

// Assumes d3, formatNumber, countryColorMap, originalValidEvents, activeEventTypes,
// yearSliderInstance, selectedCountryForLineChart, updateSelectedCountryInSearch (window),
// switchToSankeyView (window), innerRadius, outerRadius, labelOffset, arcPadAngle, chordPadAngle,
// tooltip, drawOrUpdateLineChart are available from app_controller.js or globally.

let nodeIdList = []; // Specific to chord diagram's current rendering

function generateLivelyColor() { // Kept local if only chord uses this specific generator logic
    const hue = Math.random() * 360;
    const saturation = 0.75 + Math.random() * 0.25;
    const lightness = 0.55 + Math.random() * 0.1;
    return d3.hsl(hue, saturation, lightness).toString();
}

function updateChart(selectedStartYear, selectedEndYear) {
    // This function is for the Chord diagram.
    // chordSvg is defined and managed in app_controller.js

    const relevantEvents = originalValidEvents.filter(d =>
        activeEventTypes.has(d.event_type_num) &&
        d.year_num >= selectedStartYear && // CHANGED: filter by single year within range
        d.year_num <= selectedEndYear
    );

    const linkAggregates = new Map();
    const nodeIdsInFilteredData = new Set();
    let totalFilteredValue = 0;

    relevantEvents.forEach(event => {
        if (!event.origin_name_viz || !event.target_name_viz || event.mean_estimate_num <= 0) {
            return;
        }
        // Data is already annualized, no need to divide by duration
        const annualEstimate = event.mean_estimate_num; // CHANGED

        // Key for chord links (origin to target)
        const chordKey = `${event.origin_name_viz}->${event.target_name_viz}`;
        const currentAggregate = linkAggregates.get(chordKey) || { value: 0 /*, sources: new Set() */ }; // Sources removed for brevity as per original
        currentAggregate.value += annualEstimate;
        // if (event.original_data_source_ids) parseDataSourceIds(event.original_data_source_ids).forEach(id => currentAggregate.sources.add(id));
        linkAggregates.set(chordKey, currentAggregate);

        nodeIdsInFilteredData.add(event.origin_name_viz);
        nodeIdsInFilteredData.add(event.target_name_viz);
        totalFilteredValue += annualEstimate;
    });


    chordSvg.selectAll("*").remove(); // Clear previous chord diagram elements

    nodeIdList = Array.from(nodeIdsInFilteredData).sort();

    if (nodeIdList.length === 0 || totalFilteredValue <= 0) {
        chordSvg.append("text").attr("class", "no-data-text").text("No data for selected chord filters.").attr("text-anchor", "middle").attr("dy", "0.3em").attr("fill", "#666");
        return;
    }

    const nodeIndex = new Map(nodeIdList.map((id, i) => [id, i]));
    const numNodes = nodeIdList.length;
    const matrix = Array(numNodes).fill(0).map(() => Array(numNodes).fill(0));
    // const matrixSources = Array(numNodes).fill(0).map(() => Array(numNodes).fill(null).map(() => new Set())); // Sources removed


    linkAggregates.forEach((aggData, key) => {
        const [source, target] = key.split('->');
        const sourceIdx = nodeIndex.get(source);
        const targetIdx = nodeIndex.get(target);
        if (sourceIdx !== undefined && targetIdx !== undefined) {
            matrix[sourceIdx][targetIdx] = aggData.value;
            // aggData.sources.forEach(id => matrixSources[sourceIdx][targetIdx].add(id));
        }
    });

    nodeIdList.forEach(id => {
        if (!countryColorMap.has(id)) { // countryColorMap is global from app_controller
            countryColorMap.set(id, generateLivelyColor());
        }
    });

    const colorScale = d3.scaleOrdinal()
        .domain(nodeIdList)
        .range(nodeIdList.map(id => countryColorMap.get(id)));

    const chordLayout = d3.chord()
        .padAngle(arcPadAngle)
        .sortGroups(d3.descending)
        .sortSubgroups(d3.descending)
        .sortChords(d3.descending);

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
        .attr("fill", d => colorScale(nodeIdList[d.index]))
        .attr("stroke", d => d3.rgb(colorScale(nodeIdList[d.index])).darker());

    group.append("text")
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", "0.35em")
        .attr("transform", d => `rotate(${(d.angle * 180 / Math.PI - 90)}) translate(${outerRadius + labelOffset}) ${d.angle > Math.PI ? "rotate(180)" : ""}`)
        .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
        .text(d => nodeIdList[d.index])
        .style("font-size", "10px");

    const ribbon = chordSvg.append("g").attr("class", "chords").attr("fill-opacity", 0.75).selectAll("path")
        .data(chords).join("path")
        .attr("class", "chord")
        .attr("d", ribbonGenerator)
        .attr("fill", d => colorScale(nodeIdList[d.source.index]))
        .attr("stroke", d => d3.rgb(colorScale(nodeIdList[d.source.index])).darker())
        .each(function(d) {
            d.aggregatedValue = matrix[d.source.index][d.target.index];
            // d.sourceIds = Array.from(matrixSources[d.source.index][d.target.index]);
        });

    const handleGroupMouseOver = (event, d_group) => {
        const countryName = nodeIdList[d_group.index];
        let tooltipHtml = `<b>${countryName}</b><br/>Total Outgoing: ${formatNumber(d_group.value)}<br/>Top Destinations:<br/>`;
        let outgoingFlows = [];
        chords.forEach(chord => {
            if (chord.source.index === d_group.index) {
                outgoingFlows.push({ targetName: nodeIdList[chord.target.index], value: chord.source.value });
            }
        });
        outgoingFlows.sort((a, b) => b.value - a.value);
        const top5Destinations = outgoingFlows.slice(0, 5);

        if (top5Destinations.length > 0) {
            tooltipHtml += top5Destinations.map(flow => `&nbsp;&nbsp;• ${flow.targetName} (${formatNumber(flow.value)})`).join('<br/>');
        } else {
            tooltipHtml += "&nbsp;&nbsp;No outgoing migration recorded in this period.";
        }
        tooltip.html(tooltipHtml).transition().duration(200).style("opacity", 1);
        groupPath.classed("faded", p => p.index !== d_group.index);
        chordSvg.selectAll(".group text").classed("faded", p => p.index !== d_group.index);
        ribbon.classed("faded", c => c.source.index !== d_group.index && c.target.index !== d_group.index);
    };

    const handleChordMouseOver = (event, d_chord) => {
        const sourceName = nodeIdList[d_chord.source.index];
        const targetName = nodeIdList[d_chord.target.index];
        tooltip.html(`<b>${sourceName} → ${targetName}</b><br/>Volume: ${formatNumber(d_chord.source.value)}`)
            .transition().duration(200).style("opacity", 1);
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
}

function handleGroupClick(event, d) {
    event.stopPropagation();
    const countryName = nodeIdList[d.index];

    selectedCountryForLineChart = countryName;
    if (typeof window.updateSelectedCountryInSearch === 'function') {
        window.updateSelectedCountryInSearch(countryName);
    }

    if (typeof window.switchToSankeyView === 'function') {
        window.switchToSankeyView(countryName);
    } else {
        console.error("switchToSankeyView function not found.");
        if (yearSliderInstance && typeof drawOrUpdateLineChart === "function") {
             const [startYear, endYear] = yearSliderInstance.get().map(v => parseInt(v));
             drawOrUpdateLineChart(countryName, startYear, endYear);
        }
    }
}