const csvFilePath = 'new_data.csv';
const dataSourceCsvPath = 'data_source.csv';
const dataMinYear = 1950;
const dataMaxYear = 2025;
const arcPadAngle = 0.01;
const chordPadAngle = 0.01;
const labelOffset = 10;

let originalValidEvents = [];
let dataSourcesMap = new Map();
const formatNumber = d3.format(",.0f");
const activeEventTypes = new Set([1, 2, 3, 4]);
let yearSliderInstance = null;
let selectedCountryForLineChart = null;

const chartDiv = document.getElementById('chart');
const tooltip = d3.select("#tooltip");
const yearSliderElement = document.getElementById('year-slider');
const startYearValueDisplay = d3.select("#start-year-value");
const endYearValueDisplay = d3.select("#end-year-value");
const filterButtons = d3.selectAll(".filter-button");

let chordWidth, chordHeight, chordInnerWidth, chordInnerHeight, outerRadius, innerRadius;
let lineChartWidth, lineChartHeight;

const chordMargin = { top: 10, right: 10, bottom: 10, left: 10 };
const chordLabelBufferBase = 35;

const lineChartMargin = { top: 40, right: 30, bottom: 40, left: 60 };
const legendHeightEstimate = 30;

function setupChordDimensions() {
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
    if (!lineChartSvgElement.node() || !lineChartWrapper) {
        lineChartWidth = 200; lineChartHeight = 100; return;
    }
    const svgNode = lineChartSvgElement.node();
    const svgClientWidth = svgNode.clientWidth;
    const svgClientHeight = svgNode.clientHeight;
    lineChartWidth = svgClientWidth - lineChartMargin.left - lineChartMargin.right;
    lineChartHeight = svgClientHeight - lineChartMargin.top - lineChartMargin.bottom - legendHeightEstimate;
    lineChartWidth = Math.max(10, lineChartWidth);
    lineChartHeight = Math.max(10, lineChartHeight);
    if (isNaN(lineChartWidth) || isNaN(lineChartHeight)) {
        lineChartWidth = Math.max(10, 200 - lineChartMargin.left - lineChartMargin.right);
        lineChartHeight = Math.max(10, 150 - lineChartMargin.top - lineChartMargin.bottom - legendHeightEstimate);
    }
}

function updateSvgContainers() {
    chordSvgElement.attr("width", chordWidth).attr("height", chordHeight);
    chordSvg.attr("transform", `translate(${chordWidth / 2}, ${chordHeight / 2})`);
    lineChartPlot.attr("transform", `translate(${lineChartMargin.left},${lineChartMargin.top})`);
}

const chordSvgElement = d3.select("#chart").append("svg");
const chordSvg = chordSvgElement.append("g");
const lineChartSvgElement = d3.select("#line-chart-svg");
const lineChartPlot = lineChartSvgElement.append("g");

setupChordDimensions();
setupLineChartDimensions();
updateSvgContainers();

Promise.all([
    d3.csv(csvFilePath),
    d3.csv(dataSourceCsvPath)
]).then(([migrationData, sourcesData]) => {
    if (!migrationData || migrationData.length === 0) { throw new Error("Migration CSV data is empty."); }
    if (!sourcesData || sourcesData.length === 0) {
        console.error("Data Source CSV (sourcesData) is empty or failed to load properly!");
    }

    sourcesData.forEach((src, index) => {
        const idFromSourceFile = src.data_source_id;
        const authorFromSourceFile = src.author;
        const yearFromSourceFile = src.year;
        const titleFromSourceFile = src.title;
        const linkFromSourceFile = src.link;

        const sourceIdKey = String(idFromSourceFile || '').trim();

        if (sourceIdKey) {
            dataSourcesMap.set(sourceIdKey, {
                year: String(yearFromSourceFile || '').trim(),
                author: String(authorFromSourceFile || '').trim(),
                title: String(titleFromSourceFile || '').trim(),
                link: String(linkFromSourceFile || '').trim()
            });
        }
    });

    originalValidEvents = migrationData.filter(d => {
        const estimateNum = +d.mean_estimate;
        const startYearNum = +d.start_year;
        const endYearNum = +d.end_year;
        const eventTypeNum = +d.event_type;
        const initialOriginName = String(d.origin_name || '').trim();
        const initialTargetName = String(d.target_name || '').trim();

        d.original_data_source_ids = String(d.data_source_id || '').trim();

        const hasOrigin = initialOriginName !== '';
        const hasTarget = initialTargetName !== '';
        const isEstimateValid = !isNaN(estimateNum) && estimateNum > 0;
        const isStartYearValid = !isNaN(startYearNum);
        const isEndYearValid = !isNaN(endYearNum);
        const isYearOrderValid = startYearNum <= endYearNum;
        const isEventTypeValid = !isNaN(eventTypeNum) && [1, 2, 3, 4].includes(eventTypeNum);
        const isValidBasic = hasOrigin && hasTarget && isEstimateValid && isStartYearValid && isEndYearValid && isYearOrderValid && isEventTypeValid;

        if (isValidBasic) {
            d.origin_name_viz = initialOriginName.includes(';') ? "Various" : initialOriginName;
            d.target_name_viz = initialTargetName.includes(';') ? "Various" : initialTargetName;
            d.mean_estimate_num = estimateNum;
            d.start_year_num = startYearNum;
            d.end_year_num = endYearNum;
            d.event_type_num = eventTypeNum;
            return true;
        }
        return false;
    });
    if (originalValidEvents.length === 0) { throw new Error("No valid data rows found after validation."); }

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
            if (typeof updateChart === "function") updateChart(startYear, endYear);
        });
        const initialValues = yearSliderInstance.get();
        startYearValueDisplay.text(initialValues[0]); endYearValueDisplay.text(initialValues[1]);

        setupChordDimensions();
        setupLineChartDimensions();
        updateSvgContainers();
        if (typeof updateChart === "function") updateChart(parseInt(initialValues[0]), parseInt(initialValues[1]));
        if (typeof drawOrUpdateLineChart === "function") drawOrUpdateLineChart(null, parseInt(initialValues[0]), parseInt(initialValues[1]));
    } else { throw new Error("Slider element #year-slider not found."); }

    filterButtons.on("click", function() {
        const button = d3.select(this);
        const eventType = parseInt(button.attr("data-event-type"));
        const isActive = button.classed("active");
        if (isActive) { activeEventTypes.delete(eventType); button.classed("active", false); }
        else { activeEventTypes.add(eventType); button.classed("active", true); }
        if (yearSliderInstance && typeof updateChart === "function") {
            const currentSliderValues = yearSliderInstance.get();
            updateChart(parseInt(currentSliderValues[0]), parseInt(currentSliderValues[1]));
        }
    });

}).catch(error => {
    console.error("Error during setup:", error);
    tooltip.style("opacity", 0);
    if (chordSvgElement) chordSvgElement.selectAll("*").remove();
    if (lineChartPlot) lineChartPlot.selectAll("*").remove();
    if (chordSvg && chordSvg.append) {
        chordSvg.append("text").attr("x", 0).attr("y", 0).attr("text-anchor", "middle")
            .attr("dy", "0.3em").text(`Error: ${error.message}. Check console.`).attr("fill", "red");
    }
    const errX = (typeof lineChartWidth === 'number' && !isNaN(lineChartWidth)) ? lineChartWidth / 2 : 100;
    const errY = (typeof lineChartHeight === 'number' && !isNaN(lineChartHeight)) ? lineChartHeight / 2 : 50;
    if (lineChartPlot && lineChartPlot.append) {
         lineChartPlot.append("text").attr("x", errX).attr("y", errY).attr("text-anchor", "middle").attr("dy","0.3em").text(`Error loading data.`).attr("fill", "red");
    } else if (lineChartSvgElement && lineChartSvgElement.append) {
        lineChartSvgElement.append("text").attr("x", "50%").attr("y", "50%").attr("text-anchor", "middle").attr("dy","0.3em").text(`Error loading data.`).attr("fill", "red");
    }
    const biblioContent = document.getElementById('bibliography-content');
    if (biblioContent) biblioContent.innerHTML = `<p style="color:red;">Error loading data: ${error.message}</p>`;
    if (yearSliderElement) yearSliderElement.setAttribute('disabled', 'true');
    filterButtons.property("disabled", true);
});

window.addEventListener('resize', () => {
    setupChordDimensions();
    setupLineChartDimensions();
    updateSvgContainers();
    if (yearSliderInstance && typeof updateChart === "function") {
        const currentSliderValues = yearSliderInstance.get();
        updateChart(parseInt(currentSliderValues[0]), parseInt(currentSliderValues[1]));
    }
});