// Add this code to your Sankey chart implementation

// Add download button at initialization (add this near the beginning of your Sankey chart setup)
function initializeSankeyDownloadButton() {
    // Remove existing download button if present
    d3.select("#sankey-chart-container #sankey-download-button").remove();

    const downloadButton = d3.select("#sankey-chart-container").append("div")
        .attr("id", "sankey-download-button")
        .html("📷")
        .style("position", "absolute")
        .style("top", "20px")  // Increased padding
        .style("left", "20px") // Increased padding
        .style("cursor", "pointer")
        .style("z-index", "100")
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
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.35)")
        .style("transition", "background-color 0.2s ease-in-out, color 0.2s ease-in-out, box-shadow 0.2s")
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
                .style("box-shadow", "0 2px 8px rgba(0,0,0,0.35)");
        })
        .on("click", downloadSankeyDiagram);
}

function downloadSankeyDiagram() {
    // Get the SVG element
    const sankeyElement = d3.select("#sankey-svg").node();
    if (!sankeyElement) {
        console.error("Sankey SVG element not found");
        return;
    }

    // Create a deep clone of the SVG
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(sankeyElement);

    // Create a new SVG element from the string
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgStr, "image/svg+xml");
    const svgElement = svgDoc.documentElement;

    // Remove any existing xmlns attribute to prevent duplication
    svgElement.removeAttribute("xmlns");
    svgElement.removeAttribute("xmlns:xlink");

    // Add necessary XML namespaces properly
    svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svgElement.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Find and replace flag images with gray circles
    const images = svgElement.querySelectorAll('image');
    images.forEach(img => {
        const parent = img.parentNode;
        const width = parseFloat(img.getAttribute('width'));
        const height = parseFloat(img.getAttribute('height'));
        const x = parseFloat(img.getAttribute('x'));
        const y = parseFloat(img.getAttribute('y'));
        const clipPath = img.getAttribute('clip-path');

        // Create gray circle
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const radius = width / 2;
        circle.setAttribute('cx', x + radius);
        circle.setAttribute('cy', y + radius);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', '#cccccc');
        circle.setAttribute('stroke', '#333');
        circle.setAttribute('stroke-width', '1.5');
        if (clipPath) circle.setAttribute('clip-path', clipPath);

        // Replace image with circle
        parent.replaceChild(circle, img);
    });

    // Add title and metadata
    const [startYear, endYear] = yearSliderInstance ? yearSliderInstance.get().map(v => parseInt(v)) : [2000, 2020];
    const countryName = selectedCountryForLineChart || "Unknown";

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `Migration Flows - ${countryName} (${startYear}-${endYear})`;
    svgElement.insertBefore(title, svgElement.firstChild);

    // Serialize the final SVG without adding duplicate xmlns
    const finalSvgStr = serializer.serializeToString(svgElement)
        .replace(/xlink:href/g, 'href'); // Fix xlink references

    // Create and download the SVG file
    const svgBlob = new Blob([finalSvgStr], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `migration-flows-sankey-${countryName.replace(/\s+/g, '-')}-${startYear}-${endYear}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

// Modified drawSankeyChart function with download button initialization
function drawSankeyChart(selectedCountry, selectedStartYear, selectedEndYear, currentActiveEventTypes, allEventsData) {
    const sankeyDrawingArea = d3.select("#sankey-svg");
    sankeyDrawingArea.selectAll("*").remove();

    // Initialize the download button
    initializeSankeyDownloadButton();

    if (!selectedCountry || !allEventsData || allEventsData.length === 0) {
        sankeyDrawingArea.append("text").attr("x", "50%").attr("y", "50%").attr("text-anchor", "middle")
            .text("Select a country to see its Sankey flow.").attr("fill", "#666").style("font-size", "12px");
        return;
    }

    const containerNode = d3.select("#sankey-chart-container").node();
    const width = containerNode.clientWidth;
    const height = containerNode.clientHeight;

    if (width <= 0 || height <= 0) {
        return;
    }

    const margin = {top: 70, right: 180, bottom: 90, left: 180};
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;

    if (graphWidth <= 60 || graphHeight <= 60) {
        sankeyDrawingArea.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle")
            .text("Not enough space for Sankey diagram content after padding.").attr("fill", "#666").style("font-size", "12px");
        return;
    }

    const inflowEventsRaw = [];
    const outflowEventsRaw = [];
    allEventsData.forEach(event => {
        if (!currentActiveEventTypes.has(event.event_type_num)) return;
        if (event.origin_name_viz === event.target_name_viz) return;

        if (event.year_num >= selectedStartYear && event.year_num <= selectedEndYear) {
            const value = event.mean_estimate_num;
            if (value > 0) {
                if (event.target_name_viz === selectedCountry && event.origin_name_viz && event.origin_name_viz !== selectedCountry) {
                    inflowEventsRaw.push({
                        sourceName: event.origin_name_viz,
                        targetName: selectedCountry,
                        value: value,
                        eventType: event.event_type_num
                    });
                } else if (event.origin_name_viz === selectedCountry && event.target_name_viz && event.target_name_viz !== selectedCountry) {
                    outflowEventsRaw.push({
                        sourceName: selectedCountry,
                        targetName: event.target_name_viz,
                        value: value,
                        eventType: event.event_type_num
                    });
                }
            }
        }
    });

    const nodesInput = [];
    const nodeLookup = new Map();

    function getOrAddNodeForSankey(name, roleLayer) {
        let nodeId = name;
        if (roleLayer === 0) nodeId = `${name}_source_role`;
        else if (roleLayer === 2) nodeId = `${name}_target_role`;
        else if (roleLayer === 1) nodeId = `${name}_selected_role`;

        if (!nodeLookup.has(nodeId)) {
            const newNode = {
                id: nodeId,
                displayName: name,
                actualName: name,
                layer: roleLayer,
                valueIn: 0,
                valueOut: 0,
                totalFlowThrough: 0
            };
            nodeLookup.set(nodeId, newNode);
            nodesInput.push(newNode);
            return newNode;
        }
        return nodeLookup.get(nodeId);
    }

    const selectedNodeObjectInfo = getOrAddNodeForSankey(selectedCountry, 1);
    const centralNodeId = selectedNodeObjectInfo.id; // Cache for frequent use

    inflowEventsRaw.forEach(flow => {
        const sourceNodeInfo = getOrAddNodeForSankey(flow.sourceName, 0);
        sourceNodeInfo.valueOut += flow.value;
        selectedNodeObjectInfo.valueIn += flow.value;
    });
    outflowEventsRaw.forEach(flow => {
        const targetNodeInfo = getOrAddNodeForSankey(flow.targetName, 2);
        targetNodeInfo.valueIn += flow.value;
        selectedNodeObjectInfo.valueOut += flow.value;
    });
    // Total flow through for sorting (optional, if not already handled by valueIn/Out sum)
    nodesInput.forEach(n => n.totalFlowThrough = Math.max(n.valueIn, n.valueOut) || n.valueIn || n.valueOut);

    const linksInput = [];
    inflowEventsRaw.forEach(flow => {
        linksInput.push({
            source: nodeLookup.get(`${flow.sourceName}_source_role`).id, target: centralNodeId,
            value: flow.value, originalValue: flow.value, colorRefName: flow.sourceName
        });
    });
    outflowEventsRaw.forEach(flow => {
        linksInput.push({
            source: centralNodeId, target: nodeLookup.get(`${flow.targetName}_target_role`).id,
            value: flow.value, originalValue: flow.value, colorRefName: flow.targetName
        });
    });

    if (nodesInput.length === 0 || linksInput.length === 0) { /* ... no data message ... */
        return;
    }
    const otherNodesExist = nodesInput.some(n => n.id !== centralNodeId && (nodeLookup.get(n.id).totalFlowThrough > 0));
    if (!otherNodesExist && selectedNodeObjectInfo.totalFlowThrough === 0) { /* ... no migration data message ... */
        return;
    }

    const nodeWidth = 30;
    const nodePadding = 15;

    const sankeyLayout = d3.sankey()
        .nodeId(d => d.id).nodeWidth(nodeWidth).nodePadding(nodePadding)
        .nodeSort((a, b) => nodeLookup.get(a.id).layer - nodeLookup.get(b.id).layer || nodeLookup.get(b.id).totalFlowThrough - nodeLookup.get(a.id).totalFlowThrough)
        .iterations(32).extent([[0, 0], [graphWidth, graphHeight]]);

    let graph;
    try {
        graph = sankeyLayout({nodes: nodesInput.map(d => ({...d})), links: linksInput.map(d => ({...d}))});
    } catch (e) { /* ... error message ... */
        return;
    }

    const flagDiameter = 0.15 * height;
    const flagRadius = flagDiameter / 2;
    const columnWidthThird = graphWidth / 3;

    const centralNodeFromGraph = graph.nodes.find(n => n.id === centralNodeId);
    if (centralNodeFromGraph) {
        centralNodeFromGraph.x0 = columnWidthThird + (columnWidthThird - nodeWidth) / 2;
        centralNodeFromGraph.x1 = centralNodeFromGraph.x0 + nodeWidth;
        const graphCenterY = graphHeight / 2;
        centralNodeFromGraph.y0 = graphCenterY - flagRadius;
        centralNodeFromGraph.y1 = graphCenterY + flagRadius;
    }

    const sourceNodes = graph.nodes.filter(n => nodeLookup.get(n.id).layer === 0 && nodeLookup.get(n.id).valueOut > 0)
        .sort((a, b) => nodeLookup.get(b.id).valueOut - nodeLookup.get(a.id).valueOut);
    const totalValueOutSourceColumn = d3.sum(sourceNodes, n => nodeLookup.get(n.id).valueOut);
    const numSourceBars = sourceNodes.length;
    const totalPaddingSource = numSourceBars > 0 ? (numSourceBars - 1) * nodePadding : 0;
    const availableRenderHeightSource = Math.max(1, graphHeight - totalPaddingSource);

    const targetNodes = graph.nodes.filter(n => nodeLookup.get(n.id).layer === 2 && nodeLookup.get(n.id).valueIn > 0)
        .sort((a, b) => nodeLookup.get(b.id).valueIn - nodeLookup.get(a.id).valueIn);
    const totalValueInTargetColumn = d3.sum(targetNodes, n => nodeLookup.get(n.id).valueIn);
    const numTargetBars = targetNodes.length;
    const totalPaddingTarget = numTargetBars > 0 ? (numTargetBars - 1) * nodePadding : 0;
    const availableRenderHeightTarget = Math.max(1, graphHeight - totalPaddingTarget);

    let finalPixelsPerValue = 0;
    const hypotheticalPPV_Source = (totalValueOutSourceColumn > 0 && availableRenderHeightSource > 0) ? availableRenderHeightSource / totalValueOutSourceColumn : 0;
    const hypotheticalPPV_Target = (totalValueInTargetColumn > 0 && availableRenderHeightTarget > 0) ? availableRenderHeightTarget / totalValueInTargetColumn : 0;

    if (totalValueOutSourceColumn === 0 && totalValueInTargetColumn === 0) finalPixelsPerValue = 0;
    else if (totalValueOutSourceColumn > 0 && totalValueInTargetColumn === 0) finalPixelsPerValue = hypotheticalPPV_Source;
    else if (totalValueOutSourceColumn === 0 && totalValueInTargetColumn > 0) finalPixelsPerValue = hypotheticalPPV_Target;
    else finalPixelsPerValue = Math.min(hypotheticalPPV_Source, hypotheticalPPV_Target);

    if (finalPixelsPerValue <= 0 && (totalValueOutSourceColumn > 0 || totalValueInTargetColumn > 0)) finalPixelsPerValue = 0.000001;

    let currentSourceY = 0;
    sourceNodes.forEach((node) => {
        const nodeInfo = nodeLookup.get(node.id);
        node.x0 = 0;
        node.x1 = node.x0 + nodeWidth;
        const nodeHeight = Math.max(1, nodeInfo.valueOut * finalPixelsPerValue);
        node.y0 = currentSourceY;
        node.y1 = currentSourceY + nodeHeight;
        currentSourceY = node.y1 + nodePadding;
    });
    const totalActualHeightSource = Math.max(0, currentSourceY - (numSourceBars > 0 ? nodePadding : 0));
    const sourceOffsetY = (graphHeight - totalActualHeightSource) / 2;
    sourceNodes.forEach(node => {
        node.y0 += sourceOffsetY;
        node.y1 += sourceOffsetY;
    });

    let currentTargetY = 0;
    targetNodes.forEach((node) => {
        const nodeInfo = nodeLookup.get(node.id);
        node.x0 = 2 * columnWidthThird + (columnWidthThird - nodeWidth);
        node.x1 = node.x0 + nodeWidth;
        const nodeHeight = Math.max(1, nodeInfo.valueIn * finalPixelsPerValue);
        node.y0 = currentTargetY;
        node.y1 = currentTargetY + nodeHeight;
        currentTargetY = node.y1 + nodePadding;
    });
    const totalActualHeightTarget = Math.max(0, currentTargetY - (numTargetBars > 0 ? nodePadding : 0));
    const targetOffsetY = (graphHeight - totalActualHeightTarget) / 2;
    targetNodes.forEach(node => {
        node.y0 += targetOffsetY;
        node.y1 += targetOffsetY;
    });

    sankeyLayout.update(graph);

    graph.links.forEach(link => {
        const sourceNodeInfo = nodeLookup.get(link.source.id);
        const targetNodeInfo = nodeLookup.get(link.target.id);
        const sourceNodeHeight = link.source.y1 - link.source.y0;
        const targetNodeHeight = link.target.y1 - link.target.y0;

        link.visualWidthAtSource = (sourceNodeInfo.valueOut > 0 && sourceNodeHeight > 0)
            ? (link.originalValue / sourceNodeInfo.valueOut) * sourceNodeHeight
            : Math.max(1, link.width || 1);
        link.visualWidthAtTarget = (targetNodeInfo.valueIn > 0 && targetNodeHeight > 0)
            ? (link.originalValue / targetNodeInfo.valueIn) * targetNodeHeight
            : Math.max(1, link.width || 1);

        link.visualWidthAtSource = Math.max(1, Number.isFinite(link.visualWidthAtSource) ? link.visualWidthAtSource : 1);
        link.visualWidthAtTarget = Math.max(1, Number.isFinite(link.visualWidthAtTarget) ? link.visualWidthAtTarget : 1);
    });

    // Normalize widths for links at the central node to perfectly fit flagDiameter
    const outgoingFromCentral = graph.links.filter(l => l.source.id === centralNodeId);
    let sumOutgoingWidths = d3.sum(outgoingFromCentral, l => l.visualWidthAtSource);
    if (outgoingFromCentral.length > 0) {
        if (sumOutgoingWidths > 0 && Math.abs(sumOutgoingWidths - flagDiameter) > 0.01) {
            const correctionFactor = flagDiameter / sumOutgoingWidths;
            outgoingFromCentral.forEach(l => l.visualWidthAtSource *= correctionFactor);
        } else if (sumOutgoingWidths <= 0) { // If sum is 0 or negative, distribute flagDiameter equally
            const equalWidth = flagDiameter / outgoingFromCentral.length;
            outgoingFromCentral.forEach(l => l.visualWidthAtSource = Math.max(1, equalWidth)); // Ensure at least 1px
        }
        // Recalculate sum after potential equal distribution or if it was initially 0
        sumOutgoingWidths = d3.sum(outgoingFromCentral, l => l.visualWidthAtSource);
        // Final check to ensure sum is flagDiameter by adjusting the largest link if needed
        if (Math.abs(sumOutgoingWidths - flagDiameter) > 0.01 && outgoingFromCentral.length > 0) {
            outgoingFromCentral.sort((a, b) => b.visualWidthAtSource - a.visualWidthAtSource); // Sort largest first
            const diff = flagDiameter - sumOutgoingWidths;
            outgoingFromCentral[0].visualWidthAtSource += diff;
        }
    }

    const incomingToCentral = graph.links.filter(l => l.target.id === centralNodeId);
    let sumIncomingWidths = d3.sum(incomingToCentral, l => l.visualWidthAtTarget);
    if (incomingToCentral.length > 0) {
        if (sumIncomingWidths > 0 && Math.abs(sumIncomingWidths - flagDiameter) > 0.01) {
            const correctionFactor = flagDiameter / sumIncomingWidths;
            incomingToCentral.forEach(l => l.visualWidthAtTarget *= correctionFactor);
        } else if (sumIncomingWidths <= 0) {
            const equalWidth = flagDiameter / incomingToCentral.length;
            incomingToCentral.forEach(l => l.visualWidthAtTarget = Math.max(1, equalWidth));
        }
        sumIncomingWidths = d3.sum(incomingToCentral, l => l.visualWidthAtTarget);
        if (Math.abs(sumIncomingWidths - flagDiameter) > 0.01 && incomingToCentral.length > 0) {
            incomingToCentral.sort((a, b) => b.visualWidthAtTarget - a.visualWidthAtTarget);
            const diff = flagDiameter - sumIncomingWidths;
            incomingToCentral[0].visualWidthAtTarget += diff;
        }
    }

    // Manually stack links at the central node
    let currentY_source_central = centralNodeFromGraph.y0;
    outgoingFromCentral
        .sort((a, b) => a.y0 - b.y0) // Sort by original y-centerline from Sankey
        .forEach(link => {
            link.sy_eff = currentY_source_central + link.visualWidthAtSource / 2;
            currentY_source_central += link.visualWidthAtSource;
        });

    let currentY_target_central = centralNodeFromGraph.y0;
    incomingToCentral
        .sort((a, b) => a.y1 - b.y1) // Sort by original y-centerline from Sankey
        .forEach(link => {
            link.ty_eff = currentY_target_central + link.visualWidthAtTarget / 2;
            currentY_target_central += link.visualWidthAtTarget;
        });

    const sankeyGroup = sankeyDrawingArea.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Add directional arrow with labels
    const arrowGroup = sankeyGroup.append("g")
        .attr("class", "direction-arrow-group")
        .attr("transform", `translate(0, -40)`);

    // Arrow line
    arrowGroup.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", graphWidth)
        .attr("y2", 0)
        .attr("stroke", "#333")
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrowhead)");

    // Arrowhead marker definition
    sankeyDrawingArea.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 10)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#333");

    // Left label (Migration to [country])
    arrowGroup.append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("text-anchor", "start")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("font-family", "Times New Roman, Times, serif") // <-- Added font family
        .text(`Immigration to ${selectedCountry}`);

    // Right label (Migration from [country])
    arrowGroup.append("text")
        .attr("x", graphWidth)
        .attr("y", -10)
        .attr("text-anchor", "end")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("font-family", "Times New Roman, Times, serif") // <-- Added font family
        .text(`Emigration from ${selectedCountry}`);

    function sankeyLinkTapered(d) {
        const sx = d.source.x1;
        const tx = d.target.x0;

        const sy_center = (d.source.id === centralNodeId && d.sy_eff !== undefined) ? d.sy_eff : d.y0;
        const halfWidthSource = d.visualWidthAtSource / 2;

        const ty_center = (d.target.id === centralNodeId && d.ty_eff !== undefined) ? d.ty_eff : d.y1;
        const halfWidthTarget = d.visualWidthAtTarget / 2;

        const c1x = (sx + tx) / 2;

        return `M ${sx},${sy_center - halfWidthSource}` +
            ` C ${c1x},${sy_center - halfWidthSource} ${c1x},${ty_center - halfWidthTarget} ${tx},${ty_center - halfWidthTarget}` +
            ` L ${tx},${ty_center + halfWidthTarget}` +
            ` C ${c1x},${ty_center + halfWidthTarget} ${c1x},${sy_center + halfWidthSource} ${sx},${sy_center + halfWidthSource}` +
            ` Z`;
    }

    sankeyGroup.append("g").attr("class", "links")
        .selectAll(".link")
        .data(graph.links)
        .join("path")
        .attr("class", "link")
        .attr("d", sankeyLinkTapered)
        .style("stroke-width", 0.3)
        .style("stroke", d => {
            const baseColor = typeof countryColorMap !== 'undefined' && countryColorMap.get(d.colorRefName) ? countryColorMap.get(d.colorRefName) : "#7f8c8d";
            return d3.color(baseColor).darker(0.5);
        })
        .style("fill-opacity", 0.65)
        .style("fill", d => {
            const colorKeyName = d.colorRefName;
            return typeof countryColorMap !== 'undefined' && countryColorMap.get(colorKeyName) ? countryColorMap.get(colorKeyName) : "#7f8c8d";
        })
        .sort((a, b) => b.originalValue - a.originalValue);

    const drawableNodes = graph.nodes.filter(n => {
        const info = nodeLookup.get(n.id);
        if (!info) return false;
        if (n.id === centralNodeId) return true;
        if (info.layer === 0) return sourceNodes.some(sn => sn.id === n.id);
        if (info.layer === 2) return targetNodes.some(tn => tn.id === n.id);
        return false;
    });

    const nodeElements = sankeyGroup.append("g").attr("class", "nodes")
        .selectAll(".node")
        .data(drawableNodes, d => d.id)
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    nodeElements.each(function (d_node) {
        const group = d3.select(this);
        const nodeInfo = nodeLookup.get(d_node.id);
        if (!nodeInfo) return;
        const isCentralNode = d_node.id === centralNodeId;

        if (isCentralNode) {
            const imageWidth = flagDiameter;
            const imageHeight = flagDiameter;
            const imageX = (nodeWidth - imageWidth) / 2;
            const imageY = 0;

            group.append("circle")
                .attr("cx", imageX + flagRadius)
                .attr("cy", imageY + flagRadius)
                .attr("r", flagRadius)
                .attr("fill", "none")
                .attr("stroke", "#333").attr("stroke-width", 1.5);

            group.append("defs").append("clipPath").attr("id", `clip-central-${d_node.id}`)
                .append("circle")
                .attr("cx", imageX + flagRadius).attr("cy", imageY + flagRadius)
                .attr("r", flagRadius - 0.75);

            let alpha2Code = null;
            const fallbackFlagUrl = "../../../../resources/country_flags/xx.svg";
            let finalFlagUrl = fallbackFlagUrl;

            if (typeof countryIsoMapGlobal !== 'undefined' && countryIsoMapGlobal && typeof selectedCountry === 'string' && countryIsoMapGlobal.has(selectedCountry.trim())) {
                alpha2Code = countryIsoMapGlobal.get(selectedCountry.trim());
            }
            if (alpha2Code && alpha2Code.trim() !== "") {
                finalFlagUrl = `../../../../resources/country_flags/${alpha2Code.trim().toLowerCase()}.svg`;
            }

            const img = group.append("image")
                .attr("x", imageX).attr("y", imageY)
                .attr("width", imageWidth).attr("height", imageHeight)
                .attr("xlink:href", finalFlagUrl)
                .attr("clip-path", `url(#clip-central-${d_node.id})`);

            if (finalFlagUrl !== fallbackFlagUrl) {
                img.on("error", function () {
                    d3.select(this).attr("xlink:href", fallbackFlagUrl);
                });
            }
        } else {
            group.append("rect")
                .attr("height", d_rect => Math.max(1, d_rect.y1 - d_rect.y0))
                .attr("width", d_rect => d_rect.x1 - d_rect.x0)
                .attr("fill", typeof countryColorMap !== 'undefined' && countryColorMap.get(nodeInfo.actualName) ? countryColorMap.get(nodeInfo.actualName) : "#bdc3c7")
                .attr("stroke", "#333").attr("stroke-width", 0.5);
        }
    });

// In the drawSankeyChart function, modify the node label creation section:

    nodeElements.each(function (d_node) {
        const group = d3.select(this);
        const nodeInfo = nodeLookup.get(d_node.id);
        if (!nodeInfo) return;
        const isCentralNode = d_node.id === centralNodeId;
        let labelText = nodeInfo.displayName;
        let textAnchor, xPos, yPosLab;
        const nodeVisualHeight = d_node.y1 - d_node.y0;

        if (isCentralNode) {
            textAnchor = "middle";
            xPos = (d_node.x1 - d_node.x0) / 2;
            yPosLab = -8;
        } else {
            const yMidRelative = nodeVisualHeight / 2;
            let valueForLabel = 0;
            if (nodeInfo.layer === 0) { // Left side (source)
                valueForLabel = nodeInfo.valueOut;
                textAnchor = "end";
                xPos = -10;
            } else if (nodeInfo.layer === 2) { // Right side (target)
                valueForLabel = nodeInfo.valueIn;
                textAnchor = "start";
                xPos = (d_node.x1 - d_node.x0) + 10; // Fixed this line
            }

            // Only add value if it's significant
            if (valueForLabel >= 0.01) {
                labelText += typeof formatNumber === 'function'
                    ? ` ${formatNumber(valueForLabel)}`
                    : ` ${valueForLabel.toFixed(2)}`;
            }
            yPosLab = yMidRelative;
        }

        // Create the text label
        group.append("text")
            .attr("class", "sankey-node-label-text")
            .attr("x", xPos)
            .attr("y", yPosLab)
            .attr("dy", isCentralNode ? 0 : "0.35em")
            .attr("text-anchor", textAnchor)
            .style("font-size", "10px")
            .style("fill", "#333")
            .style("font-weight", isCentralNode ? "bold" : "normal")
            .style("font-family", "Times New Roman, Times, serif") // <-- Added font family
            .text(labelText);
    });

// Tooltip logic for Sankey nodes and links
// Add after nodeElements and links are created in drawSankeyChart

// Helper: get flag HTML
    function getCountryFlagHtmlSankey(countryName, size = 24) {
        if (!countryIsoMapGlobal) return '';
        const alpha2Code = countryIsoMapGlobal.get(countryName.trim()) || 'xx';
        const flagUrl = `../../../../resources/country_flags/${alpha2Code.toLowerCase()}.svg`;
        const fallbackUrl = '../../../../resources/country_flags/xx.svg';
        return `<div style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;margin-right:8px;vertical-align:middle;background:#f0f0f0;border:1px solid #ddd;line-height:0;"><img src="${flagUrl}" alt="${countryName} flag" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.src='${fallbackUrl}'"></div>`;
    }

// Helper: get flag+name HTML for tooltips
    function getFlagAndNameHtml(countryName, size = 24) {
        const flagHtml = getCountryFlagHtmlSankey(countryName, size);
        return `<span style='display:flex;align-items:center;'>${flagHtml}<span>${countryName}</span></span>`;
    }

// Helper: get allEventsData for a node (country)
    function getTopDestinationsOrOrigins(nodeInfo, isSource, allEventsData, selectedCountry, selectedStartYear, selectedEndYear) {
        // isSource: true for left, false for right
        const flows = [];
        allEventsData.forEach(ev => {
            if (ev.year_num < selectedStartYear || ev.year_num > selectedEndYear) return;
            if (isSource && ev.origin_name_viz === nodeInfo.actualName && ev.target_name_viz !== nodeInfo.actualName && ev.target_name_viz !== selectedCountry) {
                flows.push({
                    country: ev.target_name_viz,
                    value: ev.mean_estimate_num,
                    year: ev.year_num
                });
            } else if (!isSource && ev.target_name_viz === nodeInfo.actualName && ev.origin_name_viz !== nodeInfo.actualName && ev.origin_name_viz !== selectedCountry) {
                flows.push({
                    country: ev.origin_name_viz,
                    value: ev.mean_estimate_num,
                    year: ev.year_num
                });
            }
        });
        // Aggregate by country
        const agg = {};
        flows.forEach(f => {
            if (!agg[f.country]) agg[f.country] = {value: 0, years: new Set()};
            agg[f.country].value += f.value;
            agg[f.country].years.add(f.year);
        });
        const arr = Object.entries(agg).map(([country, obj]) => ({
            country,
            value: obj.value,
            years: Array.from(obj.years).sort()
        }));
        arr.sort((a, b) => b.value - a.value);
        return arr.slice(0, 10);
    }

// Tooltip for nodes (show years and data_source_ids instead of top destinations/origins)
    nodeElements.on("mouseover", function (event, d_node) {
        const nodeInfo = nodeLookup.get(d_node.id);
        if (!nodeInfo) return;
        const isSource = nodeInfo.layer === 0;
        const isTarget = nodeInfo.layer === 2;
        if (!isSource && !isTarget) return;
        // Use helper for flag+name
        const flagAndNameHtml = getFlagAndNameHtml(nodeInfo.actualName, 32);
        // Find all events for this node (as source or target)
        const events = allEventsData.filter(ev =>
            (isSource && ev.origin_name_viz === nodeInfo.actualName && ev.year_num >= selectedStartYear && ev.year_num <= selectedEndYear) ||
            (isTarget && ev.target_name_viz === nodeInfo.actualName && ev.year_num >= selectedStartYear && ev.year_num <= selectedEndYear)
        );
        const years = Array.from(new Set(events.map(ev => ev.year_num))).sort();
        const dataSourceIds = Array.from(new Set(events.map(ev => ev.data_source_id).filter(Boolean)));
        const yearRange = years.length ? (years[0] === years[years.length - 1] ? years[0] : `${years[0]}-${years[years.length - 1]}`) : '';
        let tooltipHtml = `
        <div style='display:flex;align-items:center;font-size:15px;font-weight:bold;margin-bottom:4px;'>${flagAndNameHtml}</div>
        <div><strong>Total ${isSource ? 'Outgoing' : 'Incoming'}:</strong> ${formatNumber(isSource ? nodeInfo.valueOut : nodeInfo.valueIn)}</div>
        <div style='font-size:11px;color:#666;'><strong>Years:</strong> ${yearRange}</div>
        ${dataSourceIds.length ? `<div style='font-size:11px;color:#666;'><strong>Data source IDs:</strong> ${dataSourceIds.join(", ")}</div>` : ''}
    `;
        tooltip.style("background", "white").style("color", "#333").style("border-radius", "6px").style("box-shadow", "0 8px 24px rgba(0,0,0,0.35)").style("padding", "12px").html(tooltipHtml).transition().duration(200).style("opacity", 0.95);
    })
        .on("mousemove", function (event) {
            const tooltipWidth = tooltip.node().offsetWidth;
            const tooltipHeight = tooltip.node().offsetHeight;
            let left = event.pageX + 20;
            let top = event.pageY + 25;
            if (left + tooltipWidth > window.innerWidth) left = event.pageX - tooltipWidth - 20;
            if (top + tooltipHeight > window.innerHeight) top = event.pageY - tooltipHeight - 20;
            tooltip.style("left", left + "px").style("top", top + "px");
        })
        .on("mouseout", function () {
            tooltip.transition().duration(200).style("opacity", 0);
        });

// Tooltip for links (flows in the middle)
    sankeyGroup.selectAll(".link").on("mouseover", function (event, d_link) {
        // Find all events for this flow
        const sourceName = nodeLookup.get(d_link.source.id)?.actualName;
        const targetName = nodeLookup.get(d_link.target.id)?.actualName;
        const sourceFlagAndName = getFlagAndNameHtml(sourceName, 24);
        const targetFlagAndName = getFlagAndNameHtml(targetName, 24);
        const events = allEventsData.filter(ev =>
            ev.origin_name_viz === sourceName &&
            ev.target_name_viz === targetName &&
            ev.year_num >= selectedStartYear && ev.year_num <= selectedEndYear
        );
        const years = Array.from(new Set(events.map(ev => ev.year_num))).sort();
        const dataSourceIds = Array.from(new Set(events.map(ev => ev.data_source_id).filter(Boolean)));
        const yearRange = years.length ? (years[0] === years[years.length - 1] ? years[0] : `${years[0]}-${years[years.length - 1]}`) : '';
        let tooltipHtml = `
        <div style='display:flex;align-items:center;gap:8px;font-size:14px;font-weight:bold;'>
            ${sourceFlagAndName}
            <span>→</span>
            ${targetFlagAndName}
        </div>
        <div style='font-size:12px;'><strong>Median estimate:</strong> ${formatNumber(d_link.value)}</div>
        <div style='font-size:11px;color:#666;'><strong>Years:</strong> ${yearRange}</div>
        ${dataSourceIds.length ? `<div style='font-size:11px;color:#666;'><strong>Data source IDs:</strong> ${dataSourceIds.join(", ")}</div>` : ''}
    `;
        tooltip.style("background", "white").style("color", "#333").style("border-radius", "6px").style("box-shadow", "0 8px 24px rgba(0,0,0,0.35)").style("padding", "12px").html(tooltipHtml).transition().duration(200).style("opacity", 0.95);
    })
        .on("mousemove", function (event) {
            const tooltipWidth = tooltip.node().offsetWidth;
            const tooltipHeight = tooltip.node().offsetHeight;
            let left = event.pageX + 20;
            let top = event.pageY + 25;
            if (left + tooltipWidth > window.innerWidth) left = event.pageX - tooltipWidth - 20;
            if (top + tooltipHeight > window.innerHeight) top = event.pageY - tooltipHeight - 20;
            tooltip.style("left", left + "px").style("top", top + "px");
        })
        .on("mouseout", function () {
            tooltip.transition().duration(200).style("opacity", 0);
        });
}
