// --- country_search.js ---
document.addEventListener('DOMContentLoaded', () => {
    const countrySearchInput = document.getElementById('country-search-input');
    const countrySearchResults = document.getElementById('country-search-results');
    let allCountries = [];

    // This variable is defined in app_controller.js, ensure it's accessible
    // If not, this needs to be passed or accessed via a shared state management approach
    // For now, assuming originalValidEvents becomes globally available or is passed to initialize.
    // let originalValidEvents = window.originalValidEvents || []; // Example if it were global

    function initializeCountrySearch() {
        // Wait until data (originalValidEvents) is loaded and available
        // This assumes originalValidEvents is populated by app_controller.js and becomes available
        if (typeof originalValidEvents === 'undefined' || originalValidEvents.length === 0) {
            // console.log("country_search.js: Waiting for originalValidEvents...");
            setTimeout(initializeCountrySearch, 200); // Retry after a short delay
            return;
        }

        // Extract all unique country names from the data
        const originCountries = originalValidEvents.map(d => d.origin_name_viz);
        const targetCountries = originalValidEvents.map(d => d.target_name_viz);
        allCountries = [...new Set([...originCountries, ...targetCountries])].sort();

        // Set up event listeners
        countrySearchInput.style.fontFamily = "'Times New Roman', Times, serif";
        countrySearchResults.style.fontFamily = "'Times New Roman', Times, serif";
        countrySearchInput.addEventListener('input', handleSearchInput);
        countrySearchInput.addEventListener('focus', () => {
            if (countrySearchInput.value.length > 0) {
                handleSearchInput({ target: countrySearchInput });
            }
        });
        // Delay hiding results to allow click event on items
        countrySearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                countrySearchResults.style.display = 'none';
            }, 200); // 200ms delay
        });

        // Expose the update function to the global scope (already done in app_controller)
        // window.updateSelectedCountryInSearch is primarily for chord_diagram to update the input field
    }

    function handleSearchInput(event) {
        const searchTerm = event.target.value.toLowerCase();
        if (searchTerm.length === 0) {
            countrySearchResults.style.display = 'none';
            return;
        }

        const filteredCountries = allCountries.filter(country =>
            country.toLowerCase().includes(searchTerm)
        );

        displaySearchResults(filteredCountries);
    }

    function displaySearchResults(countries) {
        countrySearchResults.innerHTML = ''; // Clear previous results

        if (countries.length === 0) {
            countrySearchResults.innerHTML = '<div class="country-search-item">No matching countries found</div>';
        } else {
            countries.forEach(country => {
                const item = document.createElement('div');
                item.className = 'country-search-item';
                item.textContent = country;
                // Use 'mousedown' instead of 'click' to fire before 'blur' on input hides the results
                item.addEventListener('mousedown', () => {
                    selectCountry(country);
                });
                countrySearchResults.appendChild(item);
            });
        }
        countrySearchResults.style.display = 'block';
    }

    function selectCountry(country) {
        countrySearchInput.value = country; // Update the search input field
        countrySearchResults.style.display = 'none'; // Hide the results dropdown

        // NEW LOGIC:
        // Trigger the Sankey view for the selected country.
        // This will set selectedCountryForSankey, isSankeyViewActive = true,
        // and then call updateMainChartVisuals which updates Sankey and Line Chart.
        if (typeof window.switchToSankeyView === 'function') {
            window.switchToSankeyView(country);
        } else {
            console.error("switchToSankeyView function not found on window object. Cannot switch to Sankey view.");
            // Fallback: If switchToSankeyView is somehow not available,
            // you might want to at least update the line chart as a fallback,
            // though this would deviate from the "acts like clicking a chord" requirement.
            // For now, just log an error.
            // if (typeof drawOrUpdateLineChart === "function" && yearSliderInstance) {
            //     selectedCountryForLineChart = country; // Manually set for line chart as a fallback
            //     const [startYear, endYear] = yearSliderInstance.get().map(v => parseInt(v));
            //     drawOrUpdateLineChart(country, startYear, endYear);
            // }
        }
    }

    // Start initialization
    initializeCountrySearch();
});