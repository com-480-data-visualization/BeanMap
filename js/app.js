import {
  fetchTradeData,
  rebuildExportVolumes,
  rebuildTransformationRanks,
  state
} from './dataService.js';

import {
  initThreeMap,
  loadMap,
  onYearChangeMap
} from './map3D.js';

import {
  setupUI,
  updateSidePanel
} from './uiController.js';

import {
  setupTimeline,
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

    // 3. Initialize D3 Visualizations (Timeline and Sankey)
    setupTimeline();

    // 4. Wire up the UI (Sliders, Buttons)
    // We pass in callbacks so the UI controller doesn't need to know about the map or charts
    setupUI(
      // Callback for when the year slider changes
      (newYear) => {
        state.currentYear = newYear;
        rebuildExportVolumes(newYear);
        rebuildTransformationRanks(newYear);

        // Broadcast the year change to all components
        onYearChangeMap(newYear);
        updateVisualizationsOnYearChange(newYear);

        // Update the side panel if a country is currently selected
        if (state.selectedCountry) {
          updateSidePanel(state.selectedCountry, newYear);
        }
      },
      // Callback for when the "Show Value" / "Show Weight" toggle is clicked
      () => {
        if (state.selectedCountry) {
          updateSidePanel(state.selectedCountry, state.currentYear);
        }
      }
    );

    // 5. Initialize the 3D Map
    // We pass a callback so the map can tell the app when a user clicks a country
    initThreeMap((countryName) => {
      updateSidePanel(countryName, state.currentYear);
    });

    // 6. Load the GeoJSON geometry (This hides the loading screen when finished)
    loadMap();

    // 7. Render initial data for the visualizations
    updateVisualizationsOnYearChange(state.currentYear);

  } else {
    // Handle fatal data loading error
    loadingEl.innerHTML = '<span style="color:#C8A96E;font-size:11px;">⚠ Could not load trade data. Check your GitHub Pages link or network connection.</span>';
    loadingEl.style.flexDirection = 'column';
  }
}

// Boot up the application once the HTML is fully parsed
window.addEventListener('DOMContentLoaded', init);