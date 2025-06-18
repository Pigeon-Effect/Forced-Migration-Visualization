// --- chord_diagram.js ---

// Assumes d3, formatNumber, countryColorMap, originalValidEvents, activeEventTypes,
// yearSliderInstance, selectedCountryForLineChart, updateSelectedCountryInSearch (window),
// switchToSankeyView (window), innerRadius, outerRadius, labelOffset, arcPadAngle, chordPadAngle,
// tooltip, drawOrUpdateLineChart, countryIsoMapGlobal are available from app_controller.js or globally.

let nodeIdList = []; // Specific to chord diagram's current rendering

// Add buttons container
const buttonContainer = d3.select("#chart").append("div")
    .attr("id", "chart-buttons-container");

// Download button
const downloadButton = buttonContainer.append("div")
    .attr("id", "download-button")
    .attr("class", "chart-button")
    .attr("data-tooltip", "Download SVG of graph")
    .html("📷")
    .on("click", downloadChordDiagram);

// Data viewer button
const dataViewerButton = buttonContainer.append("div")
    .attr("id", "data-viewer-button")
    .attr("class", "chart-button")
    .attr("data-tooltip", "View original data")
    .html("📊")
    .on("click", function() {
        showDataViewer();
    });

// Information button
const infoButton = buttonContainer.append("div")
    .attr("id", "info-button")
    .attr("class", "chart-button")
    .attr("data-tooltip", "How to use this visualization")
    .html("ℹ️")
    .on("click", function() {
        showToolExplainer();
    });

// Add tooltip for info button
buttonContainer.append("div")
    .attr("id", "info-button-tooltip");

function getCountryFlagHtml(countryName, size = 24) {
    if (!countryIsoMapGlobal) return '';

    const alpha2Code = countryIsoMapGlobal.get(countryName.trim()) || 'xx';
    const flagUrl = `resources/country_flags/${alpha2Code.toLowerCase()}.svg`;
    const fallbackUrl = 'resources/country_flags/xx.svg';

    return `
        <div style="
            display: inline-block;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            overflow: hidden;
            margin-right: 8px;
            vertical-align: middle;
            background: #f0f0f0;
            border: 1px solid #ddd;
            line-height: 0;
        ">
            <img src="${flagUrl}" 
                 alt="${countryName} flag"
                 style="width: 100%; height: 100%; object-fit: cover; display: block;"
                 onerror="this.src='${fallbackUrl}'">
        </div>
    `;
}

function generateLivelyColor() {
    const hue = Math.random() * 360;
    const saturation = 0.75 + Math.random() * 0.25;
    const lightness = 0.55 + Math.random() * 0.1;
    return d3.hsl(hue, saturation, lightness).toString();
}

function downloadChordDiagram() {
    // Clone the SVG
    const svgElement = chordSvgElement.node().cloneNode(true);

    // Remove the download button from the clone
    const button = svgElement.querySelector('#download-button');
    if (button) button.remove();

    // Get the current year range
    const [startYear, endYear] = yearSliderInstance.get().map(v => parseInt(v));

    // Set SVG attributes for proper rendering
    svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svgElement.setAttribute("version", "1.1");

    // Create a title element
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `Migration Flows ${startYear}-${endYear}`;
    svgElement.insertBefore(title, svgElement.firstChild);

    // Create a style element for the SVG
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
        .group path { fill-opacity: 1; }
        .chord { fill-opacity: 0.75; }
        text { font-family: Arial, sans-serif; }
    `;
    svgElement.insertBefore(style, svgElement.firstChild);

    // Convert SVG to data URL
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgStr], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(svgBlob);

    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `migration-flows-${startYear}-${endYear}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

function updateChart(selectedStartYear, selectedEndYear) {
    // This function is for the Chord diagram.
    // chordSvg is defined and managed in app_controller.js

    const relevantEvents = originalValidEvents.filter(d =>
        activeEventTypes.has(d.event_type_num) &&
        d.year_num >= selectedStartYear &&
        d.year_num <= selectedEndYear
    );

    const linkAggregates = new Map();
    const nodeIdsInFilteredData = new Set();
    let totalFilteredValue = 0;

    relevantEvents.forEach(event => {
        if (!event.origin_name_viz || !event.target_name_viz || event.mean_estimate_num <= 0) {
            return;
        }
        const annualEstimate = event.mean_estimate_num;

        const chordKey = `${event.origin_name_viz}->${event.target_name_viz}`;
        const currentAggregate = linkAggregates.get(chordKey) || {
            value: 0,
            years: new Set()
        };
        currentAggregate.value += annualEstimate;
        currentAggregate.years.add(event.year_num);
        linkAggregates.set(chordKey, currentAggregate);

        nodeIdsInFilteredData.add(event.origin_name_viz);
        nodeIdsInFilteredData.add(event.target_name_viz);
        totalFilteredValue += annualEstimate;
    });

    chordSvg.selectAll("*").remove();

    nodeIdList = Array.from(nodeIdsInFilteredData).sort();

    if (nodeIdList.length === 0 || totalFilteredValue <= 0) {
        chordSvg.append("text").attr("class", "no-data-text").text("No data for selected chord filters.").attr("text-anchor", "middle").attr("dy", "0.3em").attr("fill", "#666");
        return;
    }

    const nodeIndex = new Map(nodeIdList.map((id, i) => [id, i]));
    const numNodes = nodeIdList.length;
    const matrix = Array(numNodes).fill(0).map(() => Array(numNodes).fill(0));

    linkAggregates.forEach((aggData, key) => {
        const [source, target] = key.split('->');
        const sourceIdx = nodeIndex.get(source);
        const targetIdx = nodeIndex.get(target);
        if (sourceIdx !== undefined && targetIdx !== undefined) {
            matrix[sourceIdx][targetIdx] = aggData.value;
        }
    });

    nodeIdList.forEach(id => {
        if (!countryColorMap.has(id)) {
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
        .style("font-size", "10px")
        .style("font-family", "'Times New Roman', Times, serif");

    const ribbon = chordSvg.append("g").attr("class", "chords").attr("fill-opacity", 0.75).selectAll("path")
        .data(chords).join("path")
        .attr("class", "chord")
        .attr("d", ribbonGenerator)
        .attr("fill", d => colorScale(nodeIdList[d.source.index]))
        .attr("stroke", d => d3.rgb(colorScale(nodeIdList[d.source.index])).darker())
        .each(function(d) {
            d.aggregatedValue = matrix[d.source.index][d.target.index];

            // Store country names for easy access
            d.sourceName = nodeIdList[d.source.index];
            d.targetName = nodeIdList[d.target.index];

            // Store years for this chord
            const pairKey = `${d.sourceName}->${d.targetName}`;
            const aggregate = linkAggregates.get(pairKey);
            d.years = aggregate?.years || new Set();
        })
        .on("click", handleChordClick);

    const handleGroupMouseOver = (event, d_group) => {
        const countryName = nodeIdList[d_group.index];
        const flagHtml = getCountryFlagHtml(countryName, 32);

        // Find all connected countries (both source and target relationships)
        const connectedIndices = new Set();
        connectedIndices.add(d_group.index); // Include the hovered country itself

        // Collect flows and years for tooltip
        const outgoingFlows = [];
        const flowYears = new Map(); // Store years for each flow

        chords.forEach(chord => {
            if (chord.source.index === d_group.index) {
                connectedIndices.add(chord.target.index);

                // Store flow information
                const targetName = nodeIdList[chord.target.index];
                const value = chord.source.value;

                // Get years for this flow
                if (!flowYears.has(targetName)) {
                    flowYears.set(targetName, new Set());
                }
                chord.years.forEach(year => flowYears.get(targetName).add(year));

                outgoingFlows.push({
                    targetName,
                    value,
                    years: chord.years
                });
            }
            if (chord.target.index === d_group.index) {
                connectedIndices.add(chord.source.index);
            }
        });

        // Sort and get top 10 destinations
        outgoingFlows.sort((a, b) => b.value - a.value);
        const topDestinations = outgoingFlows.slice(0, 10);

        // Concise tooltip (no duplication, no scrolling)
        let tooltipHtml = `
            <div style="display:flex;flex-direction:column;align-items:center;font-size:15px;margin-bottom:4px;">
                <div style="display:flex;align-items:center;justify-content:center;gap:8px;">
                    ${flagHtml}
                    <span style=\"font-weight:bold;\">${countryName}</span>
                </div>
            </div>
            <div style="height:1px;width:100%;background:#999999;margin:6px 0 8px 0;"></div>
            <div style="font-size:12px;color:#333;margin-bottom:6px;">Total outgoing: ${formatNumber(d_group.value)}</div>
            <div style="font-size:12px;margin-bottom:2px;">Migration to:</div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:2px;border:1px solid #999999;">
                <thead>
                    <tr style="border-bottom:1px solid #999999;">
                        <th style="text-align:left;padding:2px 4px;font-weight:normal;border:1px solid #999999;">Country</th>
                        <th style="text-align:right;padding:2px 4px;font-weight:normal;border:1px solid #999999;">Estimate</th>
                        <th style="text-align:right;padding:2px 4px;font-weight:normal;border:1px solid #999999;">Years</th>
                    </tr>
                </thead>
                <tbody>
                    ${
                        topDestinations.length > 0
                        ? topDestinations.map(flow => {
                            const years = Array.from(flow.years).sort();
                            const yearRange = years[0] === years[years.length - 1] ? years[0] : `${years[0]}-${years[years.length - 1]}`;
                            return `<tr>
                                <td style=\"padding:2px 4px;border:1px solid #999999;\">${flow.targetName}</td>
                                <td style=\"text-align:right;padding:2px 4px;border:1px solid #999999;\">${formatNumber(flow.value)}</td>
                                <td style=\"text-align:right;padding:2px 4px;border:1px solid #999999;\">${yearRange}</td>
                            </tr>`;
                        }).join('')
                        : '<tr><td colspan="3" style="font-size:12px;border:1px solid #999999;">No outgoing migration recorded.</td></tr>'
                    }
                </tbody>
            </table>
        `;


        // Apply new tooltip styles
        tooltip
            .style("background", "white")
            .style("color", "#333")
            .style("border-radius", "6px")
            .style("box-shadow", "0 2px 10px rgba(0,0,0,1)")
            .style("padding", "12px")
            .html(tooltipHtml)
            .transition()
            .duration(200)
            .style("opacity", 0.95);

        // Fade only unconnected elements
        groupPath.classed("faded", p => !connectedIndices.has(p.index));
        chordSvg.selectAll(".group text").classed("faded", p => !connectedIndices.has(p.index));
        ribbon.classed("faded", c => c.source.index !== d_group.index && c.target.index !== d_group.index);
    };

    const handleChordMouseOver = (event, d_chord) => {
        const sourceName = nodeIdList[d_chord.source.index];
        const targetName = nodeIdList[d_chord.target.index];
        const sourceFlag = getCountryFlagHtml(sourceName, 32);
        const targetFlag = getCountryFlagHtml(targetName, 32);

        // Get years for this chord
        const years = Array.from(d_chord.years).sort();
        const minYear = years[0];
        const maxYear = years[years.length - 1];
        const yearRange = minYear === maxYear ? minYear : `${minYear}-${maxYear}`;

        // Find all data_source_id for this chord (source-target pair)
        let dataSourceIds = new Set();
        if (originalValidEvents && Array.isArray(originalValidEvents)) {
            originalValidEvents.forEach(ev => {
                if (
                    ev.origin_name_viz === sourceName &&
                    ev.target_name_viz === targetName &&
                    d_chord.years && d_chord.years.has(ev.year_num)
                ) {
                    if (ev.data_source_id) {
                        dataSourceIds.add(ev.data_source_id);
                    }
                }
            });
        }
        const dataSourceIdsArr = Array.from(dataSourceIds);
        const sourcesHtml = dataSourceIdsArr.length > 0
            ? `<div style=\"font-size:11px;color:#666;\"><strong>Data source IDs:</strong> ${dataSourceIdsArr.join(", ")}</div>`
            : '';

        // Tooltip for chord: styled like group hover
        const tooltipHtml = `
            <div style=\"display:flex;flex-direction:column;align-items:center;font-size:15px;margin-bottom:4px;\">
                <div style=\"display:flex;align-items:center;justify-content:center;gap:8px;\">
                    ${sourceFlag}
                    <span style=\"font-weight:bold;\">${sourceName}</span>
                    <span style=\"font-weight:bold;margin:0 8px;\">→</span>
                    ${targetFlag}
                    <span style=\"font-weight:bold;\">${targetName}</span>
                </div>
            </div>
            <div style=\"height:1px;width:100%;background:#999999;margin:6px 0 8px 0;\"></div>
            <div style=\"font-size:12px;color:#000;margin-bottom:6px;\">Median estimate: ${formatNumber(d_chord.source.value)}</div>
            <div style=\"font-size:12px;color:#000;margin-bottom:2px;\">Years: ${yearRange}</div>
            ${dataSourceIdsArr.length > 0 ? `<div style=\"font-size:12px;color:#000;margin-bottom:2px;\">Data source IDs: ${dataSourceIdsArr.join(", ")}</div>` : ''}
        `;

        // Apply consistent styling
        tooltip
            .style("background", "white")
            .style("color", "#333")
            .style("border-radius", "6px")
            .style("box-shadow", "0 2px 10px rgba(0,0,0,1)")
            .style("padding", "12px")
            .html(tooltipHtml)
            .transition()
            .duration(200)
            .style("opacity", 0.95);

        ribbon.classed("faded", c => c !== d_chord);
        groupPath.classed("faded", p => p.index !== d_chord.source.index && p.index !== d_chord.target.index);
        chordSvg.selectAll(".group text").classed("faded", p => p.index !== d_chord.source.index && p.index !== d_chord.target.index);
    };

    const handleMouseMove = (event) => {
        const tooltipWidth = tooltip.node().offsetWidth;
        const tooltipHeight = tooltip.node().offsetHeight;
        const chartRect = chartDiv.getBoundingClientRect();

        // Calculate position with boundary checks
        let left = event.pageX + 20;
        let top = event.pageY + 25;

        // Right edge boundary check
        if (left + tooltipWidth > chartRect.right) {
            left = event.pageX - tooltipWidth - 20;
        }

        // Bottom edge boundary check
        if (top + tooltipHeight > chartRect.bottom) {
            top = event.pageY - tooltipHeight - 20;
        }

        tooltip
            .style("left", left + "px")
            .style("top", top + "px");
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
    switchToSankeyForCountry(countryName);
}

function handleChordClick(event, d_chord) {
    event.stopPropagation();

    // Create a menu to let the user choose which country to view
    const sourceCountry = nodeIdList[d_chord.source.index];
    const targetCountry = nodeIdList[d_chord.target.index];

    const menu = d3.select("body").append("div")
        .attr("id", "chord-click-menu")
        .style("position", "absolute")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("box-shadow", "0 2px 10px rgba(0,0,0,1)")
        .style("z-index", "1000")
        .style("padding", "10px")
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "14px");

    menu.append("div")
        .text("View Sankey for:")
        .style("font-weight", "bold")
        .style("margin-bottom", "8px");

    // Source country option
    menu.append("div")
        .style("cursor", "pointer")
        .style("padding", "6px 10px")
        .style("border-radius", "3px")
        .style("margin-bottom", "4px")
        .style("background", "#f0f0f0")
        .on("mouseover", function() {
            d3.select(this).style("background", "#e0e0e0");
        })
        .on("mouseout", function() {
            d3.select(this).style("background", "#f0f0f0");
        })
        .html(`<strong>${sourceCountry}</strong> (source)`)
        .on("click", function() {
            switchToSankeyForCountry(sourceCountry);
            menu.remove();
        });

    // Target country option
    menu.append("div")
        .style("cursor", "pointer")
        .style("padding", "6px 10px")
        .style("border-radius", "3px")
        .style("background", "#f0f0f0")
        .on("mouseover", function() {
            d3.select(this).style("background", "#e0e0e0");
        })
        .on("mouseout", function() {
            d3.select(this).style("background", "#f0f0f0");
        })
        .html(`<strong>${targetCountry}</strong> (target)`)
        .on("click", function() {
            switchToSankeyForCountry(targetCountry);
            menu.remove();
        });

    // Close menu when clicking anywhere else
    setTimeout(() => {
        d3.select("body").on("click.chord-menu", function(e) {
            if (!d3.select(e.target).closest("#chord-click-menu").node()) {
                menu.remove();
                d3.select("body").on("click.chord-menu", null);
            }
        });
    }, 10);
}

// Refactored country switching function
function switchToSankeyForCountry(countryName) {
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
