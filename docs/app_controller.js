// --- app_controller.js ---
const csvFilePath = 'annualized_data.csv';
const dataSourceCsvPath = 'data_source.csv';
const countryIsoCsvPath = '../../../../resources/country_ISO_mapping.csv'; // Path to your ISO mapping CSV

const dataMinYear = 1950;
const dataMaxYear = 2025;
const arcPadAngle = 0.01; // For Chord
const chordPadAngle = 0.01; // For Chord
const labelOffset = 10; // For Chord

// Shared variables for data and state
let originalValidEvents = [];
let dataSourcesMap = new Map();
const activeEventTypes = new Set([1, 2, 3, 4]);
let yearSliderInstance = null;
let selectedCountryForLineChart = null;
let selectedCountryForSankey = null;
let isSankeyViewActive = false;

// --- NEW: For Country ISO Mapping ---
let countryIsoMapGlobal = null; // Will store Map<CountryName, Alpha2Code>
let countryIsoPromiseGlobal = null; // Stores the promise for loading the ISO CSV
// --- END NEW ---

// Shared D3 utility functions and objects
let formatNumber;
let eventTypeDetails;
let countryColorMap = new Map();

// DOM Element references
const chartDiv = document.getElementById('chart');
const sankeyChartContainer = document.getElementById('sankey-chart-container');
const backToChordButton = document.getElementById('back-to-chord-button');
const tooltip = d3.select("#tooltip");
const yearSliderElement = document.getElementById('year-slider');
const startYearValueDisplay = d3.select("#start-year-value");
const endYearValueDisplay = d3.select("#end-year-value");
const filterButtons = d3.selectAll(".filter-button");

// SVG Elements
let chordSvgElement, chordSvg;
let sankeySvgElement;
let lineChartSvgElement, lineChartPlot;

// Dimensions
let chordWidth, chordHeight, chordInnerWidth, chordInnerHeight, outerRadius, innerRadius;
let lineChartWidth, lineChartHeight;

// Margins
const chordMargin = { top: 10, right: 10, bottom: 10, left: 10 };
const chordLabelBufferBase = 35;
const lineChartMargin = { top: 40, right: 30, bottom: 40, left: 60 };
const legendHeightEstimate = 30; // Used for line chart layout

// Initialize D3 dependent shared utilities
formatNumber = d3.format(",.0f");
eventTypeDetails = {
    1: { name: "Expulsion", color: "#E67E22" },
    2: { name: "Deportation", color: "#2ECC71" },
    3: { name: "Repatriation", color: "#1ABC9C" },
    4: { name: "Escape", color: "#9B59B6" }
};

// Initialize SVG elements
chordSvgElement = d3.select("#chart").append("svg");
chordSvg = chordSvgElement.append("g");
sankeySvgElement = d3.select("#sankey-svg");
lineChartSvgElement = d3.select("#line-chart-svg");
lineChartPlot = lineChartSvgElement.append("g");


// --- NEW: Function to load and process Country ISO Mapping ---
/**
 * Initializes the country ISO mapping by loading and parsing the CSV file.
 * Stores the result in countryIsoMapGlobal.
 * @returns {Promise<Map<string, string>>} A promise that resolves with the mapping.
 */
function initCountryIsoMapping() {
    if (!countryIsoPromiseGlobal) {
        countryIsoPromiseGlobal = d3.csv(countryIsoCsvPath) // Use the defined path
            .then(data => {
                countryIsoMapGlobal = new Map();
                if (data) {
                    data.forEach(row => {
                        if (row.name && typeof row.name === 'string' &&
                            row['alpha-2'] && typeof row['alpha-2'] === 'string') {
                            countryIsoMapGlobal.set(row.name.trim(), row['alpha-2'].trim());
                        }
                    });
                }
                console.log(`Country ISO mapping loaded: ${countryIsoMapGlobal.size} entries processed.`);
                return countryIsoMapGlobal;
            })
            .catch(error => {
                console.error("Fatal Error: Could not load or process country_ISO_mapping.csv. Flags will default to xx.svg.", error);
                countryIsoMapGlobal = new Map(); // Initialize to empty map on error
                return countryIsoMapGlobal; // Resolve with empty map
            });
    }
    return countryIsoPromiseGlobal;
}
// --- END NEW ---


// --- Helper function to parse data source IDs ---
function parseDataSourceIdsForAggregation(sourceString) {
    if (!sourceString || typeof sourceString !== 'string') return [];
    return sourceString.split(';')
        .map(id => String(id || '').trim())
        .filter(id => id && id !== "NA" && id !== "N/A" && id.toLowerCase() !== "unknown");
}

// --- Helper function to calculate median ---
function calculateMedian(values) {
    if (!values || values.length === 0) return 0;
    const sortedValues = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
        if (sortedValues.length === 0) return 0;
        if (sortedValues.length === 2) return (sortedValues[0] + sortedValues[1]) / 2;
        return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    } else {
        return sortedValues[mid];
    }
}

// --- Dimension Setup Functions ---
function setupChordDimensions() {
    if (isSankeyViewActive || !chartDiv.clientWidth) return;
    chordWidth = chartDiv.clientWidth;
    chordHeight = chartDiv.clientHeight;
    chordInnerWidth = chordWidth - chordMargin.left - chordMargin.right;
    chordInnerHeight = chordHeight - chordMargin.top - chordMargin.bottom;
    let currentBuffer = chordLabelBufferBase + Math.min(chordInnerWidth, chordInnerHeight) * 0.05;
    currentBuffer = Math.max(30, currentBuffer);
    outerRadius = Math.min(chordInnerWidth, chordInnerHeight) / 2 - currentBuffer;
    outerRadius = Math.max(20, outerRadius);
    innerRadius = outerRadius - Math.max(5, outerRadius * 0.08);
    innerRadius = Math.max(10, innerRadius);
    if (innerRadius >= outerRadius) innerRadius = outerRadius - 5;
}

function setupLineChartDimensions() {
    const lineChartWrapper = document.getElementById('line-chart-container-wrapper');
    if (!lineChartSvgElement.node() || !lineChartWrapper || !lineChartWrapper.clientWidth) {
        lineChartWidth = 200 - lineChartMargin.left - lineChartMargin.right; // Fallback width
        lineChartHeight = 150 - lineChartMargin.top - lineChartMargin.bottom - legendHeightEstimate; // Fallback height
        return;
    }
    const svgClientWidth = lineChartWrapper.clientWidth;
    const svgClientHeight = lineChartWrapper.clientHeight;
    lineChartWidth = svgClientWidth - lineChartMargin.left - lineChartMargin.right;
    lineChartHeight = svgClientHeight - lineChartMargin.top - lineChartMargin.bottom - legendHeightEstimate;
    lineChartWidth = Math.max(10, lineChartWidth);
    lineChartHeight = Math.max(10, lineChartHeight);
}

function updateSvgContainersAttributes() {
    if (!isSankeyViewActive && chordSvgElement.node() && chordWidth > 0 && chordHeight > 0) {
        chordSvgElement.attr("width", chordWidth).attr("height", chordHeight);
        chordSvg.attr("transform", `translate(${chordWidth / 2}, ${chordHeight / 2})`);
    }

    if (lineChartSvgElement.node()) {
        const lineChartWrapper = document.getElementById('line-chart-container-wrapper');
        if (lineChartWrapper.clientWidth > 0 && lineChartWrapper.clientHeight > 0) {
             lineChartSvgElement
                 .attr("width", lineChartWrapper.clientWidth)
                 .attr("height", lineChartWrapper.clientHeight);
             lineChartPlot.attr("transform", `translate(${lineChartMargin.left},${lineChartMargin.top})`);
        }
    }
}

// --- View Switching Functions ---
function showChordDiagramView() {
    chartDiv.style.display = 'flex';
    sankeyChartContainer.style.display = 'none';
    backToChordButton.style.display = 'none';
    isSankeyViewActive = false;

    selectedCountryForSankey = null;
    selectedCountryForLineChart = null;

    if (typeof window.updateSelectedCountryInSearch === 'function') {
        window.updateSelectedCountryInSearch(null);
    }

    setupChordDimensions();
    updateSvgContainersAttributes();
    if (yearSliderInstance) {
        const [startYear, endYear] = yearSliderInstance.get().map(v => parseInt(v));
        updateMainChartVisuals(startYear, endYear);
    }
}

function showSankeyChartView(countryName) {
    selectedCountryForSankey = countryName;
    selectedCountryForLineChart = countryName;
    isSankeyViewActive = true;
    chartDiv.style.display = 'none';
    sankeyChartContainer.style.display = 'block';
    backToChordButton.style.display = 'block';

    if (yearSliderInstance && originalValidEvents.length > 0) {
        const [startYear, endYear] = yearSliderInstance.get().map(v => parseInt(v));
        updateMainChartVisuals(startYear, endYear);
    }
}
window.switchToSankeyView = showSankeyChartView;
backToChordButton.addEventListener('click', showChordDiagramView);

// --- Main Update Logic ---
function updateMainChartVisuals(startYear, endYear) {
    if (isSankeyViewActive) {
        if (selectedCountryForSankey && typeof drawSankeyChart === "function") {
            // Ensure countryIsoMapGlobal is passed or accessible by drawSankeyChart
            drawSankeyChart(selectedCountryForSankey, startYear, endYear, activeEventTypes, originalValidEvents);
        }
    } else {
        if (typeof updateChart === "function") {
            setupChordDimensions();
            updateSvgContainersAttributes();
            updateChart(startYear, endYear);
        }
    }

    if (typeof drawOrUpdateLineChart === "function") {
        drawOrUpdateLineChart(selectedCountryForLineChart, startYear, endYear);
    }
}

window.updateSelectedCountryInSearch = (country) => {
    const searchInput = document.getElementById('country-search-input');
    if (searchInput) searchInput.value = country || "";
};

// --- Data Loading and Initialization ---
Promise.all([
    d3.csv(csvFilePath),
    d3.csv(dataSourceCsvPath),
    initCountryIsoMapping() // Add the promise for ISO mapping
]).then(([migrationData, sourcesData, isoMap]) => { // isoMap is the resolved value (countryIsoMapGlobal)
    if (!migrationData || migrationData.length === 0) { throw new Error("Migration CSV data is empty."); }
    if (!sourcesData || sourcesData.length === 0) {
        console.warn("Data Source CSV (sourcesData) is empty. Bibliography may be incomplete.");
    }
    // countryIsoMapGlobal is already set by initCountryIsoMapping, but 'isoMap' confirms it's done.

    sourcesData.forEach(src => {
        const idFromSourceFile = String(src.data_source_id || '').trim();
        if (idFromSourceFile) {
            dataSourcesMap.set(idFromSourceFile, {
                year: String(src.year || '').trim(),
                author: String(src.author || '').trim(),
                title: String(src.title || '').trim(),
                link: String(src.link || '').trim()
            });
        }
    });

    let parsedAndValidatedEvents = migrationData.map(d => {
        const estimateNum = +d.mean_estimate;
        const yearNum = +d.year;
        const eventTypeNum = +d.event_type;
        const initialOriginName = String(d.origin_name || '').trim();
        const initialTargetName = String(d.target_name || '').trim();
        const expelledGroup = String(d.expelled_group || 'N/A').trim();
        const originalDataSourceIds = String(d.data_source_id || '').trim();

        const hasOrigin = initialOriginName !== '';
        const hasTarget = initialTargetName !== '';
        const isEstimateValidNumeric = !isNaN(estimateNum);
        const isYearValid = !isNaN(yearNum);
        const isEventTypeValid = !isNaN(eventTypeNum) && [1, 2, 3, 4].includes(eventTypeNum);

        if (hasOrigin && hasTarget && isEstimateValidNumeric && isYearValid && isEventTypeValid) {
            return {
                ...d,
                origin_name_viz: initialOriginName.includes(';') ? "Multiple Origins" : initialOriginName,
                target_name_viz: initialTargetName.includes(';') ? "Multiple Targets" : initialTargetName,
                mean_estimate_num: estimateNum,
                year_num: yearNum,
                event_type_num: eventTypeNum,
                expelled_group_processed: expelledGroup,
                original_data_source_ids: originalDataSourceIds,
            };
        }
        return null;
    }).filter(d => d !== null);

    const groupedEvents = new Map();
    parsedAndValidatedEvents.forEach(event => {
        const groupKey = `${event.origin_name_viz}-${event.target_name_viz}-${event.expelled_group_processed}-${event.year_num}-${event.event_type_num}`;
        if (!groupedEvents.has(groupKey)) {
            groupedEvents.set(groupKey, []);
        }
        groupedEvents.get(groupKey).push(event);
    });

    const eventsAfterMedianProcessing = [];
    groupedEvents.forEach(group => {
        if (group.length === 1) {
            eventsAfterMedianProcessing.push(group[0]);
        } else {
            const estimates = group.map(e => e.mean_estimate_num);
            const medianEstimate = calculateMedian(estimates);
            const representativeEvent = { ...group[0] };
            representativeEvent.mean_estimate_num = medianEstimate;
            const allSourceIdsInGroup = new Set();
            group.forEach(e => {
                parseDataSourceIdsForAggregation(e.original_data_source_ids).forEach(id => allSourceIdsInGroup.add(id));
            });
            representativeEvent.original_data_source_ids = Array.from(allSourceIdsInGroup).join(';');
            representativeEvent.aggregation_note = `Median of ${group.length} events. Original values: ${estimates.join(', ')}.`;
            eventsAfterMedianProcessing.push(representativeEvent);
        }
    });

    originalValidEvents = eventsAfterMedianProcessing.filter(d => {
        return d.origin_name_viz !== "Multiple Origins" &&
               d.target_name_viz !== "Multiple Targets" &&
               d.mean_estimate_num > 0;
    });

    console.log(`Loaded ${originalValidEvents.length} valid, single-origin/target, median-processed events.`);
    if (originalValidEvents.length === 0) {
        console.warn("No valid data rows found after all processing. Graphs may be empty.");
        chartDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: red;">No displayable data found after processing. Please check data, filters, and console logs.</p>';
    }

    setupChordDimensions();
    setupLineChartDimensions();
    updateSvgContainersAttributes();

    if (yearSliderElement) {
        yearSliderInstance = noUiSlider.create(yearSliderElement, {
            start: [dataMinYear, dataMaxYear], connect: true, step: 1,
            range: { 'min': dataMinYear, 'max': dataMaxYear },
            format: wNumb({ decimals: 0 }),
        });
        yearSliderInstance.on('update', function (values) {
            const startYear = parseInt(values[0]);
            const endYear = parseInt(values[1]);
            startYearValueDisplay.text(startYear); endYearValueDisplay.text(endYear);
            updateMainChartVisuals(startYear, endYear);
        });
        const initialValues = yearSliderInstance.get();
        startYearValueDisplay.text(initialValues[0]); endYearValueDisplay.text(initialValues[1]);
        if (originalValidEvents.length > 0) {
            updateMainChartVisuals(parseInt(initialValues[0]), parseInt(initialValues[1]));
        }
    } else { throw new Error("Slider element #year-slider not found."); }

    filterButtons.on("click", function() {
        const button = d3.select(this);
        const eventType = parseInt(button.attr("data-event-type"));
        const isActive = button.classed("active");
        if (isActive) { activeEventTypes.delete(eventType); button.classed("active", false); }
        else { activeEventTypes.add(eventType); button.classed("active", true); }

        if (yearSliderInstance && originalValidEvents.length > 0) {
            const [startYear, endYear] = yearSliderInstance.get().map(v => parseInt(v));
            updateMainChartVisuals(startYear, endYear);
        }
    });

}).catch(error => {
    console.error("Error during setup:", error);
    tooltip.style("opacity", 0);
    if (chordSvgElement && chordSvgElement.node()) chordSvgElement.selectAll("*").remove();
    if (sankeySvgElement && sankeySvgElement.node()) sankeySvgElement.selectAll("*").remove();
    if (lineChartPlot && lineChartPlot.node()) lineChartPlot.selectAll("*").remove();

    const displayError = (selection, w, h, msg) => {
        if (selection && selection.node()) {
            selection.append("text")
                .attr("x", w / 2).attr("y", h / 2)
                .attr("text-anchor", "middle").attr("dy", "0.3em")
                .text(msg).attr("fill", "red").style("font-size", "12px");
        }
    };

    const leftPanelWidth = chartDiv.clientWidth || sankeyChartContainer.clientWidth || 300;
    const leftPanelHeight = chartDiv.clientHeight || sankeyChartContainer.clientHeight || 150;

    if (!isSankeyViewActive) displayError(chordSvgElement, leftPanelWidth, leftPanelHeight, `Error: ${error.message}.`);
    else displayError(sankeySvgElement, leftPanelWidth, leftPanelHeight, `Error: ${error.message}.`);

    const lineChartWrapper = document.getElementById('line-chart-container-wrapper');
    if (lineChartWrapper) displayError(lineChartSvgElement, lineChartWrapper.clientWidth || 200, lineChartWrapper.clientHeight || 100, `Error loading data.`);

    const biblioContent = document.getElementById('bibliography-content');
    if (biblioContent) biblioContent.innerHTML = `<p style="color:red;">Error loading data: ${error.message}</p>`;
    if (yearSliderElement) yearSliderElement.setAttribute('disabled', 'true');
    filterButtons.property("disabled", true);
});

window.addEventListener('resize', () => {
    setupChordDimensions();
    setupLineChartDimensions();
    updateSvgContainersAttributes();
    if (yearSliderInstance && originalValidEvents.length > 0) {
        const [startYear, endYear] = yearSliderInstance.get().map(v => parseInt(v));
        updateMainChartVisuals(startYear, endYear);
    }
});