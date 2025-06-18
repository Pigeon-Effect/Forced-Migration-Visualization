// --- data_viewer.js ---
let dataViewerModal = null;

function showDataViewer() {
    if (!dataViewerModal) {
        createDataViewerModal();
    }
    dataViewerModal.style("display", "block");
}

function createDataViewerModal() {
    const filePath = window.csvFilePath || 'new_data.csv';

    dataViewerModal = d3.select("body").append("div")
        .attr("id", "data-viewer-modal")
        .style("position", "fixed")
        .style("top", "0")
        .style("left", "0")
        .style("width", "100%")
        .style("height", "100%")
        .style("background-color", "rgba(0,0,0,0.9)")
        .style("z-index", "2000")
        .style("display", "none")
        .style("overflow", "auto");

    // Close button with consistent styling
    dataViewerModal.append("div")
        .attr("id", "data-viewer-close-button")
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
        .on("click", hideDataViewer);



    const tableContainer = dataViewerModal.append("div")
        .attr("id", "data-table-container")
        .style("margin", "80px auto")
        .style("width", "95%")
        .style("max-width", "1600px")
        .style("background", "#f0f2f5")
        .style("border-radius", "8px")
        .style("overflow", "hidden")
        .style("box-shadow", "0 4px 20px rgba(0,0,0,0.3)")
        .style("font-family", "Arial, sans-serif");

    tableContainer.append("h2")
        .text("Annualized Migration Data")
        .style("padding", "15px 20px")
        .style("margin", "0")
        .style("background", "#2c3e50")
        .style("color", "white")
        .style("font-size", "18px");

    const table = tableContainer.append("table")
        .attr("id", "data-viewer-table")
        .style("width", "100%")
        .style("border-collapse", "collapse")
        .style("font-size", "12px")
        .style("table-layout", "fixed"); // Fixed layout for better control

    d3.csv(filePath).then(function(data) {
        if (!data || data.length === 0) {
            table.append("tr").append("td").text("No data available");
            return;
        }

        // Columns to hide
        const columnsToHide = [
            "origin_id", "target_id", "in_unhcr",
            "unhcr_numer", "comment", "difference_unhcr_mean_estimate"
        ];

        // Get visible columns
        const visibleColumns = Object.keys(data[0]).filter(
            col => !columnsToHide.includes(col)
        );

        // Create header row
        const header = table.append("thead").append("tr");
        visibleColumns.forEach(key => {
            header.append("th")
                .text(key)
                .style("padding", "10px 8px") // Reduced padding
                .style("text-align", "left")
                .style("background-color", "#34495e")
                .style("color", "white")
                .style("border-bottom", "2px solid #2c3e50")
                .style("position", "sticky")
                .style("top", "0");
        });

        // Create body with zebra striping
        const body = table.append("tbody");
        data.forEach((row, i) => {
            const tr = body.append("tr")
                .style("background-color", i % 2 === 0 ? "#ffffff" : "#f8f9fa")
                .style("border-bottom", "1px solid #e0e0e0");

            visibleColumns.forEach(col => {
                const td = tr.append("td")
                    .text(row[col])
                    .style("padding", "8px 8px") // Reduced padding
                    .style("word-wrap", "break-word") // Allow word wrapping
                    .style("hyphens", "auto"); // Auto hyphenation

                // Special handling for description column
                if (col === "description") {
                    td.style("max-width", "300px");
                }
            });
        });

        // Set column widths based on content importance
        const tableNode = table.node();
        if (tableNode) {
            const headerCells = tableNode.querySelectorAll("thead th");
            headerCells.forEach((cell, i) => {
                const colName = cell.textContent;
                if (colName === "origin_name" || colName === "target_name") {
                    cell.style.width = "15%";
                } else if (colName === "expelled_group") {
                    cell.style.width = "15%";
                } else if (colName === "description") {
                    cell.style.width = "30%";
                } else if (colName === "data_source_id") {
                    cell.style.width = "5%";
                } else if (colName === "year" || colName === "event_type") {
                    cell.style.width = "5%";
                } else if (colName === "mean_estimate") {
                    cell.style.width = "8%";
                } else {
                    cell.style.width = "7%";
                }
            });
        }

        // Add horizontal scrolling
        const tableWrapper = tableContainer.append("div")
            .style("overflow-x", "auto")
            .style("max-height", "70vh")
            .style("overflow-y", "auto");

        tableWrapper.node().appendChild(table.node());

    }).catch(error => {
        console.error("Error loading data for viewer:", error);
        table.append("tr").append("td")
            .text("Error loading data. Please check console for details.")
            .style("color", "red")
            .style("padding", "20px");
    });
}

function hideDataViewer() {
    if (dataViewerModal) {
        dataViewerModal.style("display", "none");
    }
}

window.showDataViewer = showDataViewer;
window.hideDataViewer = hideDataViewer;