function drawSankeyChart(selectedCountry, selectedStartYear, selectedEndYear, currentActiveEventTypes, allEventsData) {
    const sankeyDrawingArea = d3.select("#sankey-svg");
    sankeyDrawingArea.selectAll("*").remove();

    if (!selectedCountry || !allEventsData || allEventsData.length === 0) {
        sankeyDrawingArea.append("text").attr("x", "50%").attr("y", "50%").attr("text-anchor", "middle")
            .text("Select a country to see its Sankey flow.").attr("fill", "#666").style("font-size", "12px");
        return;
    }

    const containerNode = d3.select("#sankey-chart-container").node();
    const width = containerNode.clientWidth;
    const height = containerNode.clientHeight;

    if (width <= 0 || height <= 0) { return; }

    const margin = { top: 70, right: 180, bottom: 90, left: 180 };
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
                    inflowEventsRaw.push({ sourceName: event.origin_name_viz, targetName: selectedCountry, value: value, eventType: event.event_type_num });
                } else if (event.origin_name_viz === selectedCountry && event.target_name_viz && event.target_name_viz !== selectedCountry) {
                    outflowEventsRaw.push({ sourceName: selectedCountry, targetName: event.target_name_viz, value: value, eventType: event.event_type_num });
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
            const newNode = { id: nodeId, displayName: name, actualName: name, layer: roleLayer, valueIn: 0, valueOut: 0, totalFlowThrough: 0 };
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

    if (nodesInput.length === 0 || linksInput.length === 0) { /* ... no data message ... */ return; }
    const otherNodesExist = nodesInput.some(n => n.id !== centralNodeId && (nodeLookup.get(n.id).totalFlowThrough > 0));
    if (!otherNodesExist && selectedNodeObjectInfo.totalFlowThrough === 0) { /* ... no migration data message ... */ return; }


    const nodeWidth = 30;
    const nodePadding = 15;

    const sankeyLayout = d3.sankey()
        .nodeId(d => d.id).nodeWidth(nodeWidth).nodePadding(nodePadding)
        .nodeSort((a,b) => nodeLookup.get(a.id).layer - nodeLookup.get(b.id).layer || nodeLookup.get(b.id).totalFlowThrough - nodeLookup.get(a.id).totalFlowThrough)
        .iterations(32).extent([[0, 0], [graphWidth, graphHeight]]);

    let graph;
    try { graph = sankeyLayout({ nodes: nodesInput.map(d => ({ ...d })), links: linksInput.map(d => ({ ...d })) }); }
    catch (e) { /* ... error message ... */ return; }

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
                                 .sort((a,b) => nodeLookup.get(b.id).valueOut - nodeLookup.get(a.id).valueOut);
    const totalValueOutSourceColumn = d3.sum(sourceNodes, n => nodeLookup.get(n.id).valueOut);
    const numSourceBars = sourceNodes.length;
    const totalPaddingSource = numSourceBars > 0 ? (numSourceBars - 1) * nodePadding : 0;
    const availableRenderHeightSource = Math.max(1, graphHeight - totalPaddingSource);

    const targetNodes = graph.nodes.filter(n => nodeLookup.get(n.id).layer === 2 && nodeLookup.get(n.id).valueIn > 0)
                                 .sort((a,b) => nodeLookup.get(b.id).valueIn - nodeLookup.get(a.id).valueIn);
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
        node.x0 = 0; node.x1 = node.x0 + nodeWidth;
        const nodeHeight = Math.max(1, nodeInfo.valueOut * finalPixelsPerValue);
        node.y0 = currentSourceY; node.y1 = currentSourceY + nodeHeight;
        currentSourceY = node.y1 + nodePadding;
    });
    const totalActualHeightSource = Math.max(0, currentSourceY - (numSourceBars > 0 ? nodePadding : 0));
    const sourceOffsetY = (graphHeight - totalActualHeightSource) / 2;
     sourceNodes.forEach(node => { node.y0 += sourceOffsetY; node.y1 += sourceOffsetY; });

    let currentTargetY = 0;
    targetNodes.forEach((node) => {
        const nodeInfo = nodeLookup.get(node.id);
        node.x0 = 2 * columnWidthThird + (columnWidthThird - nodeWidth); node.x1 = node.x0 + nodeWidth;
        const nodeHeight = Math.max(1, nodeInfo.valueIn * finalPixelsPerValue);
        node.y0 = currentTargetY; node.y1 = currentTargetY + nodeHeight;
        currentTargetY = node.y1 + nodePadding;
    });
    const totalActualHeightTarget = Math.max(0, currentTargetY - (numTargetBars > 0 ? nodePadding : 0));
    const targetOffsetY = (graphHeight - totalActualHeightTarget) / 2;
    targetNodes.forEach(node => { node.y0 += targetOffsetY; node.y1 += targetOffsetY; });

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
             outgoingFromCentral.sort((a,b) => b.visualWidthAtSource - a.visualWidthAtSource); // Sort largest first
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
            incomingToCentral.sort((a,b) => b.visualWidthAtTarget - a.visualWidthAtTarget);
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

    function sankeyLinkTapered(d) {
        const sx = d.source.x1; const tx = d.target.x0;

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

    sankeyGroup.append("g").attr("class", "links") /* ... link drawing as before, using sankeyLinkTapered ... */
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


    const drawableNodes = graph.nodes.filter(n => { /* ... as before ... */
        const info = nodeLookup.get(n.id);
        if (!info) return false;
        if (n.id === centralNodeId) return true;
        if (info.layer === 0) return sourceNodes.some(sn => sn.id === n.id);
        if (info.layer === 2) return targetNodes.some(tn => tn.id === n.id);
        return false;
    });

    const nodeElements = sankeyGroup.append("g").attr("class", "nodes") /* ... as before ... */
        .selectAll(".node")
        .data(drawableNodes, d => d.id)
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    nodeElements.each(function(d_node) { /* ... node drawing (flag, rects) as before ... */
        const group = d3.select(this);
        const nodeInfo = nodeLookup.get(d_node.id);
        if (!nodeInfo) return;
        const isCentralNode = d_node.id === centralNodeId;

        if (isCentralNode) {
            const imageWidth = flagDiameter; const imageHeight = flagDiameter;
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
            const fallbackFlagUrl = "../resources/country_flags/xx.svg";
            let finalFlagUrl = fallbackFlagUrl;

            if (typeof countryIsoMapGlobal !== 'undefined' && countryIsoMapGlobal && typeof selectedCountry === 'string' && countryIsoMapGlobal.has(selectedCountry.trim())) {
                alpha2Code = countryIsoMapGlobal.get(selectedCountry.trim());
            }
            if (alpha2Code && alpha2Code.trim() !== "") {
                finalFlagUrl = `../resources/country_flags/${alpha2Code.trim().toLowerCase()}.svg`;
            }

            const img = group.append("image")
                .attr("x", imageX).attr("y", imageY)
                .attr("width", imageWidth).attr("height", imageHeight)
                .attr("xlink:href", finalFlagUrl)
                .attr("clip-path", `url(#clip-central-${d_node.id})`);

            if (finalFlagUrl !== fallbackFlagUrl) {
                img.on("error", function() { d3.select(this).attr("xlink:href", fallbackFlagUrl); });
            }
        } else {
            group.append("rect")
                .attr("height", d_rect => Math.max(1, d_rect.y1 - d_rect.y0))
                .attr("width", d_rect => d_rect.x1 - d_rect.x0)
                .attr("fill", typeof countryColorMap !== 'undefined' && countryColorMap.get(nodeInfo.actualName) ? countryColorMap.get(nodeInfo.actualName) : "#bdc3c7")
                .attr("stroke", "#333").attr("stroke-width", 0.5);
        }
    });

    nodeElements.each(function(d_node) { /* ... label drawing as before ... */
        const group = d3.select(this);
        const nodeInfo = nodeLookup.get(d_node.id);
        if (!nodeInfo) return;
        const isCentralNode = d_node.id === centralNodeId;
        let labelText = nodeInfo.displayName;
        let textAnchor, xPos, yPosLab;
        const nodeVisualHeight = d_node.y1 - d_node.y0;

        if (isCentralNode) {
            textAnchor = "middle"; xPos = (d_node.x1 - d_node.x0) / 2;
            yPosLab = -8;
        } else {
            const yMidRelative = nodeVisualHeight / 2;
            let valueForLabel = 0;
            if (nodeInfo.layer === 0) {
                valueForLabel = nodeInfo.valueOut; textAnchor = "end"; xPos = -10;
            } else if (nodeInfo.layer === 2) {
                valueForLabel = nodeInfo.valueIn; textAnchor = "start"; xPos = (d_node.x1 - d_node.x0) + 10;
            }
            if (valueForLabel >= 0.01 && typeof formatNumber === 'function') labelText += ` ${formatNumber(valueForLabel)}`;
            else if (valueForLabel >= 0.01) labelText += ` ${valueForLabel.toFixed(2)}`;
            yPosLab = yMidRelative;
        }
        group.append("text").attr("class", "sankey-node-label-text")
            .attr("x", xPos).attr("y", yPosLab)
            .attr("dy", isCentralNode ? 0 : "0.35em")
            .attr("text-anchor", textAnchor).style("font-size", "10px").style("fill", "#333")
            .style("font-weight", isCentralNode ? "bold" : "normal").text(labelText);
    });
}
