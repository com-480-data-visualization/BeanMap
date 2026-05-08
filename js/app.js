import {
  fetchTradeData,
  rebuildExportVolumes,
  rebuildTransformationRanks,
  state
} from './dataService.js';

import {
  drawArcs,
  initThreeMap,
  loadMap,
  onYearChangeMap,
  selectCountryByName
} from './map3D.js';

import {
  clearSidePanel,
  setupUI,
  updateSidePanel
} from './uiController.js';

import {
  drawPriceChart,
  updateVisualizationsOnYearChange
} from './visualizations.js';

/**
 * Main Initialization Flow
 */
async function init() {
  const loadingEl = document.getElementById('map-loading');
  loadingEl.textContent = 'Fetching global trade data...';
  loadingEl.classList.remove('hidden');

  // 1. Fetch the data from the remote JSON
  const isDataLoaded = await fetchTradeData();

  if (isDataLoaded) {
    // 2. Prepare initial state for the default year (2023)
    rebuildTransformationRanks(state.currentYear);
    rebuildExportVolumes(state.currentYear);

    // 3. Initialize D3 Visualizations (Price Chart)
    drawPriceChart(state.data.PRICE_TIMELINE);

    // Ensure the chart stays responsive on window resize
    window.addEventListener('resize', () => {
      drawPriceChart(state.data.PRICE_TIMELINE);
    });

    // 4. Wire up the UI (Sliders, Buttons)
    // We pass in callbacks so the UI controller doesn't need to know about the map or charts
    setupUI(
      (newYear) => {
        state.currentYear = newYear;
        rebuildExportVolumes(newYear);
        rebuildTransformationRanks(newYear);

        onYearChangeMap(newYear);
        updateVisualizationsOnYearChange(newYear);

        if (state.selectedCountry) {
          updateSidePanel(state.selectedCountry, newYear);
        } else {
          clearSidePanel();
        }
      },
      () => {
        if (state.selectedCountry) {
          updateSidePanel(state.selectedCountry, state.currentYear);
          drawArcs(state.selectedCountry, state.currentYear);
        }
      }
    );

    // 5. Initialize the 3D Map
    initThreeMap((countryName) => {
      if (countryName) {
        updateSidePanel(countryName, state.currentYear);
      } else {
        clearSidePanel();
      }
      updateVisualizationsOnYearChange(state.currentYear);
    });

    // 6. Load the map and set default country (FIX #11)
    loadMap(() => {
      // This callback fires exactly when the 3D map finishes building
      selectCountryByName('Germany');
    });

    // 7. Render initial data for the visualizations
    updateVisualizationsOnYearChange(state.currentYear);

  } else {
    // Handle fatal data loading error
    loadingEl.innerHTML = '<span style="color:#C8A96E;font-size:11px;">⚠ Could not load trade data. Check your GitHub Pages link or network connection.</span>';
    loadingEl.style.flexDirection = 'column';
  }

  // 8. Initialize Country Searchbar
  const datalist = document.getElementById('country-list');
  const searchInput = document.getElementById('country-search');

  // Populate datalist with all known countries
  const countries = Array.from(state.ALL_PARTNERS).sort();
  countries.forEach(c => {
    const option = document.createElement('option');
    option.value = c;
    datalist.appendChild(option);
  });

  // Listen for search input (Fires immediately when datalist is clicked)
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (countries.includes(val)) {
      selectCountryByName(val);
      e.target.value = ''; // Clear input
      e.target.blur();     // Remove focus to trigger the CSS collapse
    }
  });

}

// Boot up the application once the HTML is fully parsed
window.addEventListener('DOMContentLoaded', init);