// --- tool_explainer.js ---
let explainerModal = null;

function showToolExplainer() {
    if (!explainerModal) {
        createExplainerModal();
    }
    explainerModal.style("display", "block");
}

function createExplainerModal() {
    explainerModal = d3.select("body").append("div")
        .attr("id", "explainer-modal")
        .style("position", "fixed")
        .style("top", "0")
        .style("left", "0")
        .style("width", "100%")
        .style("height", "100%")
        .style("background-color", "rgba(0,0,0,0.9)")
        .style("z-index", "2000")
        .style("display", "none")
        .style("overflow", "auto")
        .style("font-family", "Arial, sans-serif");

    // Close button
    explainerModal.append("div")
        .attr("id", "explainer-close-button")
        .html("✕")
        .style("position", "fixed")
        .style("top", "20px")
        .style("right", "20px")
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .style("color", "#f1f1f1")
        .style("cursor", "pointer")
        .style("background", "rgba(0,0,0,0.7)")
        .style("border-radius", "50%")
        .style("width", "40px")
        .style("height", "40px")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("z-index", "2001")
        .on("click", hideToolExplainer);

    const contentContainer = explainerModal.append("div")
        .attr("id", "explainer-content")
        .style("position", "relative")
        .style("margin", "80px auto")
        .style("width", "90%")
        .style("max-width", "900px")
        .style("background", "#f0f2f5")
        .style("border-radius", "8px")
        .style("overflow", "hidden")
        .style("box-shadow", "0 4px 20px rgba(0,0,0,0.3)")
        .style("padding", "30px");

    // Title
    contentContainer.append("h1")
        .text("Forced Migration Visualizer Guide")
        .style("margin-top", "0")
        .style("color", "#2c3e50")
        .style("border-bottom", "2px solid #3498db")
        .style("padding-bottom", "15px")
        .style("margin-bottom", "25px")
        .style("font-family", "'Times New Roman', Times, serif");

    // Introduction
    contentContainer.append("p")
        .html("This tool visualizes forced migration patterns between countries. Use this guide to understand how to interact with each component:")
        .style("font-size", "18px")
        .style("margin-bottom", "25px")
        .style("font-family", "'Times New Roman', Times, serif");

    // Section: Core Visualizations
    const visualizationSection = contentContainer.append("div");

    visualizationSection.append("h2")
        .text("Core Visualizations")
        .style("color", "#2c3e50")
        .style("margin-top", "20px")
        .style("margin-bottom", "15px")
        .style("font-family", "'Times New Roman', Times, serif");

    // Chord Diagram
    const chordSection = visualizationSection.append("div")
        .style("margin-bottom", "30px");

    chordSection.append("h3")
        .html("<span style='color:#e74c3c; font-family:Times New Roman, Times, serif;'>Chord Diagram</span>: <span style='font-family:Times New Roman, Times, serif;'>Migration Relationships</span>")
        .style("margin-bottom", "10px")
        .style("font-family", "'Times New Roman', Times, serif");

    chordSection.append("div")
        .html(`
            <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:15px; font-family:'Times New Roman', Times, serif;">
                <div style="flex:1; min-width:250px; font-family:'Times New Roman', Times, serif;">
                    <div style="background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.1); font-family:'Times New Roman', Times, serif;">
                        <div style="display:flex; align-items:center; margin-bottom:10px; font-family:'Times New Roman', Times, serif;">
                            <div style="width:20px; height:20px; border-radius:50%; background:#E67E22; margin-right:10px;"></div>
                            <div style='font-family:Times New Roman, Times, serif;'><strong>Country Arcs</strong></div>
                        </div>
                        <p style="margin:0 0 10px 30px; font-size:14px; font-family:'Times New Roman', Times, serif;">Size shows total migration volume</p>
                        <div style="display:flex; align-items:center; margin-bottom:10px; font-family:'Times New Roman', Times, serif;">
                            <div style="width:20px; height:20px; border-radius:50%; background:#9B59B6; margin-right:10px;"></div>
                            <div style='font-family:Times New Roman, Times, serif;'><strong>Connection Ribbons</strong></div>
                        </div>
                        <p style="margin:0 0 10px 30px; font-size:14px; font-family:'Times New Roman', Times, serif;">Width shows migration between countries</p>
                    </div>
                </div>
                <div style="flex:1; min-width:250px; font-family:'Times New Roman', Times, serif;">
                    <div style="background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.1); font-family:'Times New Roman', Times, serif;">
                        <h4 style="margin-top:0; font-family:'Times New Roman', Times, serif;">How to Use:</h4>
                        <ul style="padding-left:20px; margin:0; font-size:14px; font-family:'Times New Roman', Times, serif;">
                            <li style='font-family:Times New Roman, Times, serif;'>Hover over arcs for country details</li>
                            <li style='font-family:Times New Roman, Times, serif;'>Hover over ribbons for flow details</li>
                            <li style='font-family:Times New Roman, Times, serif;'>Click any country to switch to Sankey view</li>
                            <li style='font-family:Times New Roman, Times, serif;'>Click ribbons to choose countries</li>
                        </ul>
                    </div>
                </div>
            </div>
        `);

    // Sankey Diagram
    const sankeySection = visualizationSection.append("div")
        .style("margin-bottom", "30px");

    sankeySection.append("h3")
        .html("<span style='color:#3498db; font-family:Times New Roman, Times, serif;'>Sankey Diagram</span>: <span style='font-family:Times New Roman, Times, serif;'>Detailed Country Flows</span>")
        .style("margin-bottom", "10px")
        .style("font-family", "'Times New Roman', Times, serif");

    sankeySection.append("div")
        .html(`
            <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:15px; font-family:'Times New Roman', Times, serif;">
                <div style="flex:1; min-width:250px; font-family:'Times New Roman', Times, serif;">
                    <div style="background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.1); font-family:'Times New Roman', Times, serif;">
                        <div style="display:flex; align-items:center; margin-bottom:10px; font-family:'Times New Roman', Times, serif;">
                            <div style="width:20px; height:20px; background:#2ECC71; margin-right:10px;"></div>
                            <div style='font-family:Times New Roman, Times, serif;'><strong>Left Column</strong>: Origin Countries</div>
                        </div>
                        <p style="margin:0 0 10px 30px; font-size:14px; font-family:'Times New Roman', Times, serif;">Countries sending migrants to selected country</p>
                        <div style="display:flex; align-items:center; margin-bottom:10px; font-family:'Times New Roman', Times, serif;">
                            <div style="width:20px; height:20px; background:#1ABC9C; margin-right:10px;"></div>
                            <div style='font-family:Times New Roman, Times, serif;'><strong>Right Column</strong>: Destination Countries</div>
                        </div>
                        <p style="margin:0 0 10px 30px; font-size:14px; font-family:'Times New Roman', Times, serif;">Countries receiving migrants from selected country</p>
                    </div>
                </div>
                <div style="flex:1; min-width:250px; font-family:'Times New Roman', Times, serif;">
                    <div style="background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.1); font-family:'Times New Roman', Times, serif;">
                        <h4 style="margin-top:0; font-family:'Times New Roman', Times, serif;">How to Use:</h4>
                        <ul style="padding-left:20px; margin:0; font-size:14px; font-family:'Times New Roman', Times, serif;">
                            <li style='font-family:Times New Roman, Times, serif;'>Hover over nodes for migration details</li>
                            <li style='font-family:Times New Roman, Times, serif;'>Hover over flows for specific path details</li>
                            <li style='font-family:Times New Roman, Times, serif;'>Use ← Back button to return to Chord view</li>
                            <li style='font-family:Times New Roman, Times, serif;'>Click 📷 to save the diagram</li>
                        </ul>
                    </div>
                </div>
            </div>
        `);

    // Line Chart
    const lineChartSection = visualizationSection.append("div")
        .style("margin-bottom", "30px");

    lineChartSection.append("h3")
        .html("<span style='color:#e67e22; font-family:Times New Roman, Times, serif;'>Trend Chart</span>: <span style='font-family:Times New Roman, Times, serif;'>Migration Over Time</span>")
        .style("margin-bottom", "10px")
        .style("font-family", "'Times New Roman', Times, serif");

    lineChartSection.append("div")
        .html(`
            <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:15px; font-family:'Times New Roman', Times, serif;">
                <div style="flex:1; min-width:250px; font-family:'Times New Roman', Times, serif;">
                    <div style="background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.1); font-family:'Times New Roman', Times, serif;">
                        <div style="display:flex; align-items:center; margin-bottom:10px; font-family:'Times New Roman', Times, serif;">
                            <div style="width:20px; height:20px; border-radius:50%; background:#E67E22; margin-right:10px;"></div>
                            <div style='font-family:Times New Roman, Times, serif;'><strong>Data Points</strong></div>
                        </div>
                        <p style="margin:0 0 10px 30px; font-size:14px; font-family:'Times New Roman', Times, serif;">Show migration volume for selected year</p>
                        <div style="display:flex; align-items:center; margin-bottom:10px; font-family:'Times New Roman', Times, serif;">
                            <div style="height:10px; width:100%; background:linear-gradient(to right, #E67E22, transparent); margin-right:10px;"></div>
                            <div style='font-family:Times New Roman, Times, serif;'><strong>Shaded Area</strong></div>
                        </div>
                        <p style="margin:0 0 10px 30px; font-size:14px; font-family:'Times New Roman', Times, serif;">Represents uncertainty in estimates</p>
                    </div>
                </div>
                <div style="flex:1; min-width:250px; font-family:'Times New Roman', Times, serif;">
                    <div style="background:#fff; border-radius:8px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.1); font-family:'Times New Roman', Times, serif;">
                        <h4 style="margin-top:0; font-family:'Times New Roman', Times, serif;">How to Use:</h4>
                        <ul style="padding-left:20px; margin:0; font-size:14px; font-family:'Times New Roman', Times, serif;">
                            <li style='font-family:Times New Roman, Times, serif;'>Hover over points for detailed data</li>
                            <li style='font-family:Times New Roman, Times, serif;'>Shows data for selected country or globally</li>
                            <li style='font-family:Times New Roman, Times, serif;'>Automatically updates with filters/slider</li>
                            <li style='font-family:Times New Roman, Times, serif;'>Source references appear below</li>
                        </ul>
                    </div>
                </div>
            </div>
        `);

    // Controls Section
    const controlsSection = contentContainer.append("div");

    controlsSection.append("h2")
        .text("Controls & Filters")
        .style("color", "#2c3es50")
        .style("margin-top", "30px")
        .style("margin-bottom", "15px")
        .style("font-family", "'Times New Roman', Times, serif");

    // Event Type Filters
    controlsSection.append("h3")
        .html("Event Type Filters")
        .style("margin-bottom", "10px");

    controlsSection.append("div")
        .html(`
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
                <div style="background:#E67E22; color:white; padding:8px 12px; border-radius:4px; font-size:14px;">Expulsion</div>
                <div style="background:#2ECC71; color:white; padding:8px 12px; border-radius:4px; font-size:14px;">Deportation</div>
                <div style="background:#1ABC9C; color:white; padding:8px 12px; border-radius:4px; font-size:14px;">Repatriation</div>
                <div style="background:#9B59B6; color:white; padding:8px 12px; border-radius:4px; font-size:14px;">Escape</div>
            </div>
            <p style="margin:0 0 20px 0; font-size:14px;">
                Click to toggle migration types on/off. Active filters are highlighted. 
                Combine types to see complex migration patterns.
            </p>
        `);

    // Year Slider
    controlsSection.append("h3")
        .html("Year Range Slider")
        .style("margin-bottom", "10px");

    controlsSection.append("div")
        .html(`
            <div style="background:#ecf0f1; padding:15px; border-radius:8px; margin-bottom:20px;">
                <div style="height:4px; background:#bdc3c7; position:relative; margin:20px 10px;">
                    <div style="position:absolute; height:100%; width:60%; background:#3498db; left:10%;"></div>
                    <div style="position:absolute; width:20px; height:20px; border-radius:50%; background:#3498db; top:-8px; left:10%; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>
                    <div style="position:absolute; width:20px; height:20px; border-radius:50%; background:#3498db; top:-8px; left:70%; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:14px;">
                    <span>1950</span>
                    <span><strong>1970 - 2020</strong></span>
                    <span>2025</span>
                </div>
            </div>
            <p style="margin:0 0 20px 0; font-size:14px;">
                Drag handles to select time range. All visualizations update to show only data 
                within your selected years.
            </p>
        `);

    // Country Search
    controlsSection.append("h3")
        .html("Country Search")
        .style("margin-bottom", "10px");

    controlsSection.append("div")
        .html(`
            <div style="background:#fff; padding:10px; border-radius:4px; border:1px solid #bdc3c7; margin-bottom:20px; max-width:300px;">
                <div style="display:flex;">
                    <div style="padding:8px; background:#eee; border-radius:4px 0 0 4px;">🔍</div>
                    <div style="flex-grow:1; padding:8px; font-size:14px; color:#7f8c8d;">Search for a country...</div>
                </div>
            </div>
            <p style="margin:0 0 20px 0; font-size:14px;">
                Start typing to find countries. Selecting a country will:
                <ul style="margin:10px 0; padding-left:20px; font-size:14px;">
                    <li>Switch to Sankey view for that country</li>
                    <li>Update line chart to show its migration trends</li>
                    <li>Highlight it in Chord diagram</li>
                </ul>
            </p>
        `);

    // Tools Section
    const toolsSection = contentContainer.append("div");

    toolsSection.append("h2")
        .text("Toolbar Functions")
        .style("color", "#2c3e50")
        .style("margin-top", "30px")
        .style("margin-bottom", "15px")
        .style("font-family", "'Times New Roman', Times, serif");

    toolsSection.append("div")
        .html(`
            <div style="display:flex; gap:25px; flex-wrap:wrap; margin-bottom:30px; font-family:'Times New Roman', Times, serif;">
                <div style="text-align:center; font-family:'Times New Roman', Times, serif;">
                    <div style="background:rgba(220,220,220,0.6); border-radius:50%; width:50px; height:50px; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; font-size:24px; font-family:'Times New Roman', Times, serif;">📷</div>
                    <div style="font-weight:bold; font-size:17px; letter-spacing:0.5px; font-family:'Times New Roman', Times, serif;">Download</div>
                    <p style="margin:5px 0; font-size:15px; max-width:150px; font-family:'Times New Roman', Times, serif; color:#222;">Save current visualization as SVG image</p>
                </div>
                
                <div style="text-align:center; font-family:'Times New Roman', Times, serif;">
                    <div style="background:rgba(220,220,220,0.6); border-radius:50%; width:50px; height:50px; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; font-size:24px; font-family:'Times New Roman', Times, serif;">📊</div>
                    <div style="font-weight:bold; font-size:17px; letter-spacing:0.5px; font-family:'Times New Roman', Times, serif;">Data Table</div>
                    <p style="margin:5px 0; font-size:15px; max-width:150px; font-family:'Times New Roman', Times, serif; color:#222;">View and search the raw dataset</p>
                </div>
                
                <div style="text-align:center; font-family:'Times New Roman', Times, serif;">
                    <div style="background:rgba(220,220,220,0.6); border-radius:50%; width:50px; height:50px; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; font-size:24px; font-family:'Times New Roman', Times, serif;">ℹ️</div>
                    <div style="font-weight:bold; font-size:17px; letter-spacing:0.5px; font-family:'Times New Roman', Times, serif;">Information</div>
                    <p style="margin:5px 0; font-size:15px; max-width:150px; font-family:'Times New Roman', Times, serif; color:#222;">Open this guide at any time</p>
                </div>
            </div>
        `);

    // Footer
    contentContainer.append("div")
        .style("margin-top", "30px")
        .style("padding-top", "20px")
        .style("border-top", "1px solid #bbb")
        .style("font-size", "15px")
        .style("color", "#222")
        .style("font-family", "'Times New Roman', Times, serif")
        .html(`
            <p style='font-family:"Times New Roman", Times, serif; font-size:15px; color:#222;'><strong>Tip:</strong> All visualizations are connected – filtering in one area updates all others</p>
            <p style='font-family:"Times New Roman", Times, serif; font-size:15px; color:#222;'>Data covers forced migration events from 1950 to present</p>
        `);
}

function hideToolExplainer() {
    if (explainerModal) {
        explainerModal.style("display", "none");
    }
}

window.showToolExplainer = showToolExplainer;
window.hideToolExplainer = hideToolExplainer;