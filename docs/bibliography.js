// --- bibliography.js ---

const bibliographyContentDiv = document.getElementById('bibliography-content');

function updateBibliography(uniqueSourceIds = []) {
    bibliographyContentDiv.innerHTML = '';

    if (!uniqueSourceIds || uniqueSourceIds.length === 0) {
        bibliographyContentDiv.innerHTML = '<p class="bibliography-placeholder" style="font-size:12px; color:#777;">No specific sources identified for the current line chart view, or data is aggregated.</p>';
        return;
    }

    const table = document.createElement('table');
    table.classList.add('bibliography-table');

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const headerRow = document.createElement('tr');
    ['ID', 'Year', 'Author', 'Title'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        if (text === 'ID') {
            th.classList.add('source-id-cell');
            // Ensure header is also centered if the class doesn't cover it
            th.style.textAlign = 'center';
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const sortedSourceIds = uniqueSourceIds.sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);

        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        } else if (!isNaN(numA)) {
            return -1;
        } else if (!isNaN(numB)) {
            return 1;
        }
        return String(a).localeCompare(String(b));
    });

    sortedSourceIds.forEach(sourceId => {
        const sourceDetails = typeof dataSourcesMap !== 'undefined' ? dataSourcesMap.get(String(sourceId)) : undefined;
        const row = document.createElement('tr');
        const cellId = document.createElement('td');
        cellId.classList.add('source-id-cell');
        // Force centering for the data cell using inline style
        cellId.style.textAlign = 'center';

        if (sourceDetails && sourceDetails.link && String(sourceDetails.link).trim() !== '' && String(sourceDetails.link).trim().toLowerCase() !== 'n/a') {
            try {
                const linkElement = document.createElement('a');
                let url = String(sourceDetails.link).trim();
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'http://' + url;
                }
                linkElement.href = url;
                linkElement.textContent = sourceId;
                linkElement.target = "_blank";
                linkElement.rel = "noopener noreferrer";
                cellId.appendChild(linkElement);
            } catch (e) {
                cellId.textContent = sourceId;
            }
        } else {
            cellId.textContent = sourceId;
        }
        row.appendChild(cellId);

        if (sourceDetails) {
            const cellYear = document.createElement('td');
            cellYear.textContent = sourceDetails.year || 'N/A';
            row.appendChild(cellYear);

            const cellAuthor = document.createElement('td');
            cellAuthor.textContent = sourceDetails.author || 'N/A';
            row.appendChild(cellAuthor);

            const cellTitle = document.createElement('td');
            cellTitle.textContent = sourceDetails.title || 'N/A';
            row.appendChild(cellTitle);
        } else {
            const cellMissing = document.createElement('td');
            cellMissing.setAttribute('colspan', '3');
            cellMissing.textContent = 'Source details not found in data map.';
            cellMissing.style.fontStyle = 'italic';
            cellMissing.style.color = '#999';
            row.appendChild(cellMissing);
        }
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    bibliographyContentDiv.appendChild(table);
}
