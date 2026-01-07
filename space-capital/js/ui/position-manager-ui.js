/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPACE CAPITAL - POSITION MANAGER UI
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * UI component for managing position/cost basis data
 * - CSV file import
 * - Manual entry and editing
 * - P&L overview
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.PositionManagerUI = (function() {
  'use strict';

  let modalElement = null;
  let isOpen = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  function createModal() {
    if (modalElement) return modalElement;

    const modal = document.createElement('div');
    modal.id = 'position-manager-modal';
    modal.className = 'pm-modal';
    modal.innerHTML = `
      <div class="pm-modal-backdrop"></div>
      <div class="pm-modal-content">
        <div class="pm-header">
          <h2 class="pm-title">📊 POSITION MANAGER</h2>
          <button class="pm-close-btn" aria-label="Close">✕</button>
        </div>
        
        <div class="pm-tabs">
          <button class="pm-tab active" data-tab="positions">POSITIONS</button>
          <button class="pm-tab" data-tab="import">IMPORT</button>
          <button class="pm-tab" data-tab="add">ADD/EDIT</button>
        </div>

        <div class="pm-tab-content" data-content="positions">
          <div class="pm-positions-header">
            <div class="pm-summary">
              <span class="pm-summary-item">
                <span class="pm-summary-label">TOTAL P&L</span>
                <span class="pm-summary-value" id="pm-total-pl">$0.00</span>
              </span>
              <span class="pm-summary-item">
                <span class="pm-summary-label">POSITIONS</span>
                <span class="pm-summary-value" id="pm-position-count">0</span>
              </span>
            </div>
            <div class="pm-actions">
              <button class="pm-btn pm-btn-secondary" id="pm-export-btn">EXPORT JSON</button>
              <button class="pm-btn pm-btn-danger" id="pm-clear-btn">CLEAR ALL</button>
            </div>
          </div>
          <div class="pm-positions-list" id="pm-positions-list">
            <div class="pm-empty">No positions loaded. Import a CSV or add manually.</div>
          </div>
        </div>

        <div class="pm-tab-content hidden" data-content="import">
          <div class="pm-import-section">
            <h3>Import IBKR Trade Confirms CSV</h3>
            <p class="pm-hint">Export an Activity Statement from Interactive Brokers as CSV (Trade Confirms format), then drop the file here.</p>
            
            <div class="pm-dropzone" id="pm-dropzone">
              <div class="pm-dropzone-content">
                <span class="pm-dropzone-icon">📁</span>
                <span class="pm-dropzone-text">Drop CSV file here or click to browse</span>
              </div>
              <input type="file" id="pm-file-input" accept=".csv" hidden>
            </div>

            <div class="pm-import-options">
              <label class="pm-checkbox">
                <input type="checkbox" id="pm-merge-existing" checked>
                <span>Merge with existing positions</span>
              </label>
              <label class="pm-checkbox">
                <input type="checkbox" id="pm-overwrite" checked>
                <span>Overwrite duplicates</span>
              </label>
            </div>

            <div class="pm-import-result hidden" id="pm-import-result">
              <div class="pm-result-summary"></div>
            </div>
          </div>

          <div class="pm-import-section">
            <h3>Import JSON Backup</h3>
            <div class="pm-dropzone pm-dropzone-small" id="pm-json-dropzone">
              <span>Drop JSON backup file</span>
              <input type="file" id="pm-json-input" accept=".json" hidden>
            </div>
          </div>
        </div>

        <div class="pm-tab-content hidden" data-content="add">
          <div class="pm-form">
            <h3>Add / Edit Position</h3>
            
            <div class="pm-form-row">
              <label class="pm-label">Ticker Symbol</label>
              <input type="text" class="pm-input" id="pm-ticker" placeholder="RKLB" maxlength="10">
            </div>

            <div class="pm-form-row">
              <label class="pm-label">Cost Basis ($)</label>
              <input type="number" class="pm-input" id="pm-cost-basis" placeholder="5000.00" step="0.01">
            </div>

            <div class="pm-form-row">
              <label class="pm-label">Current Value ($)</label>
              <input type="number" class="pm-input" id="pm-current-value" placeholder="7500.00" step="0.01">
            </div>

            <div class="pm-form-row">
              <label class="pm-label">Total P&L ($)</label>
              <input type="number" class="pm-input" id="pm-total-pl-input" placeholder="2500.00" step="0.01">
              <span class="pm-hint">If entered, overrides calculated P&L</span>
            </div>

            <div class="pm-form-row pm-form-row-split">
              <div>
                <label class="pm-label">Stock P&L ($)</label>
                <input type="number" class="pm-input" id="pm-stock-pl" placeholder="0" step="0.01">
              </div>
              <div>
                <label class="pm-label">Options P&L ($)</label>
                <input type="number" class="pm-input" id="pm-options-pl" placeholder="0" step="0.01">
              </div>
            </div>

            <div class="pm-form-actions">
              <button class="pm-btn pm-btn-primary" id="pm-save-btn">SAVE POSITION</button>
              <button class="pm-btn pm-btn-secondary" id="pm-reset-form-btn">RESET FORM</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modalElement = modal;

    // Add styles
    addStyles();
    
    // Bind events
    bindEvents();

    return modal;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES
  // ═══════════════════════════════════════════════════════════════════════════

  function addStyles() {
    if (document.getElementById('pm-styles')) return;

    const style = document.createElement('style');
    style.id = 'pm-styles';
    style.textContent = `
      .pm-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      .pm-modal.open {
        opacity: 1;
        pointer-events: auto;
      }
      .pm-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
      }
      .pm-modal-content {
        position: relative;
        width: 90%;
        max-width: 700px;
        max-height: 85vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: #0a0c0f;
        border: 2px solid #FF2975;
        box-shadow: 0 0 30px rgba(255, 41, 117, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.5);
        font-family: 'VT323', monospace;
      }
      .pm-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid #FF2975;
        background: linear-gradient(180deg, rgba(255, 41, 117, 0.1) 0%, transparent 100%);
      }
      .pm-title {
        margin: 0;
        font-size: 1.5rem;
        color: #FF2975;
        text-shadow: 0 0 10px rgba(255, 41, 117, 0.5);
        letter-spacing: 0.1em;
      }
      .pm-close-btn {
        background: none;
        border: 1px solid #666;
        color: #888;
        font-size: 1.25rem;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      .pm-close-btn:hover {
        border-color: #FF2975;
        color: #FF2975;
      }

      /* Tabs */
      .pm-tabs {
        display: flex;
        border-bottom: 1px solid #333;
      }
      .pm-tab {
        flex: 1;
        padding: 0.75rem;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: #666;
        font-family: 'VT323', monospace;
        font-size: 1rem;
        letter-spacing: 0.1em;
        cursor: pointer;
        transition: all 0.2s;
      }
      .pm-tab:hover {
        color: #aaa;
        background: rgba(255, 255, 255, 0.02);
      }
      .pm-tab.active {
        color: #00FFFF;
        border-bottom-color: #00FFFF;
      }

      /* Tab content */
      .pm-tab-content {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
      }
      .pm-tab-content.hidden {
        display: none;
      }

      /* Positions tab */
      .pm-positions-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #333;
      }
      .pm-summary {
        display: flex;
        gap: 1.5rem;
      }
      .pm-summary-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .pm-summary-label {
        font-size: 0.75rem;
        color: #666;
        letter-spacing: 0.1em;
      }
      .pm-summary-value {
        font-size: 1.25rem;
        color: #00FFFF;
      }
      .pm-summary-value.positive { color: #39FF14; }
      .pm-summary-value.negative { color: #FF0040; }
      
      .pm-actions {
        display: flex;
        gap: 0.5rem;
      }

      .pm-positions-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .pm-empty {
        text-align: center;
        padding: 2rem;
        color: #666;
      }
      .pm-position-row {
        display: grid;
        grid-template-columns: 80px 1fr 100px 100px 60px;
        gap: 0.5rem;
        align-items: center;
        padding: 0.5rem;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid #222;
        transition: all 0.2s;
      }
      .pm-position-row:hover {
        border-color: #444;
        background: rgba(255, 255, 255, 0.04);
      }
      .pm-position-ticker {
        font-size: 1.1rem;
        color: #FF2975;
        font-weight: bold;
      }
      .pm-position-breakdown {
        display: flex;
        gap: 1rem;
        font-size: 0.8rem;
        color: #666;
      }
      .pm-position-pl {
        text-align: right;
        font-size: 1rem;
      }
      .pm-position-pl.positive { color: #39FF14; }
      .pm-position-pl.negative { color: #FF0040; }
      .pm-position-pct {
        text-align: right;
        font-size: 0.9rem;
        color: #888;
      }
      .pm-position-actions button {
        background: none;
        border: 1px solid #444;
        color: #666;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        font-size: 0.8rem;
        margin-left: 0.25rem;
      }
      .pm-position-actions button:hover {
        border-color: #FF0040;
        color: #FF0040;
      }
      
      .pm-open-badge {
        color: #00FFFF;
        font-size: 0.6rem;
        margin-left: 0.25rem;
        vertical-align: super;
      }

      /* Import tab */
      .pm-import-section {
        margin-bottom: 1.5rem;
      }
      .pm-import-section h3 {
        color: #00FFFF;
        font-size: 1rem;
        margin-bottom: 0.5rem;
        letter-spacing: 0.1em;
      }
      .pm-hint {
        font-size: 0.8rem;
        color: #666;
        margin-bottom: 0.75rem;
      }
      .pm-dropzone {
        border: 2px dashed #444;
        padding: 2rem;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 1rem;
      }
      .pm-dropzone:hover, .pm-dropzone.dragover {
        border-color: #00FFFF;
        background: rgba(0, 255, 255, 0.05);
      }
      .pm-dropzone-small {
        padding: 1rem;
      }
      .pm-dropzone-icon {
        font-size: 2rem;
        display: block;
        margin-bottom: 0.5rem;
      }
      .pm-dropzone-text {
        color: #888;
      }
      .pm-import-options {
        display: flex;
        gap: 1.5rem;
        margin-bottom: 1rem;
      }
      .pm-checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #888;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .pm-checkbox input {
        accent-color: #FF2975;
      }
      .pm-import-result {
        padding: 1rem;
        background: rgba(0, 255, 255, 0.1);
        border: 1px solid #00FFFF;
      }
      .pm-import-result.error {
        background: rgba(255, 0, 64, 0.1);
        border-color: #FF0040;
      }
      .pm-result-row {
        display: block;
        margin-top: 0.25rem;
      }
      .pm-result-row .positive { color: #39FF14; }
      .pm-result-row .negative { color: #FF0040; }

      /* Add/Edit tab */
      .pm-form h3 {
        color: #00FFFF;
        margin-bottom: 1rem;
      }
      .pm-form-row {
        margin-bottom: 1rem;
      }
      .pm-form-row-split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .pm-label {
        display: block;
        color: #888;
        font-size: 0.8rem;
        letter-spacing: 0.1em;
        margin-bottom: 0.25rem;
      }
      .pm-input {
        width: 100%;
        padding: 0.5rem;
        background: #111;
        border: 1px solid #333;
        color: #fff;
        font-family: 'VT323', monospace;
        font-size: 1rem;
      }
      .pm-input:focus {
        outline: none;
        border-color: #FF2975;
      }
      .pm-form-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 1.5rem;
      }

      /* Buttons */
      .pm-btn {
        padding: 0.5rem 1rem;
        font-family: 'VT323', monospace;
        font-size: 1rem;
        letter-spacing: 0.1em;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid;
      }
      .pm-btn-primary {
        background: #FF2975;
        border-color: #FF2975;
        color: #fff;
      }
      .pm-btn-primary:hover {
        background: #FF69B4;
        box-shadow: 0 0 10px rgba(255, 41, 117, 0.5);
      }
      .pm-btn-secondary {
        background: transparent;
        border-color: #00FFFF;
        color: #00FFFF;
      }
      .pm-btn-secondary:hover {
        background: rgba(0, 255, 255, 0.1);
      }
      .pm-btn-danger {
        background: transparent;
        border-color: #FF0040;
        color: #FF0040;
      }
      .pm-btn-danger:hover {
        background: rgba(255, 0, 64, 0.1);
      }

      /* Responsive */
      @media (max-width: 600px) {
        .pm-modal-content {
          width: 95%;
          max-height: 90vh;
        }
        .pm-positions-header {
          flex-direction: column;
          gap: 0.75rem;
        }
        .pm-position-row {
          grid-template-columns: 60px 1fr 80px 40px;
        }
        .pm-position-breakdown {
          display: none;
        }
        .pm-form-row-split {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT BINDING
  // ═══════════════════════════════════════════════════════════════════════════

  function bindEvents() {
    const modal = modalElement;

    // Close button
    modal.querySelector('.pm-close-btn').addEventListener('click', close);
    modal.querySelector('.pm-modal-backdrop').addEventListener('click', close);

    // Tabs
    modal.querySelectorAll('.pm-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.pm-tab').forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.pm-tab-content').forEach(c => c.classList.add('hidden'));
        tab.classList.add('active');
        modal.querySelector(`[data-content="${tab.dataset.tab}"]`).classList.remove('hidden');
      });
    });

    // CSV Dropzone
    const dropzone = modal.querySelector('#pm-dropzone');
    const fileInput = modal.querySelector('#pm-file-input');
    
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleCSVFile(file);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleCSVFile(e.target.files[0]);
    });

    // JSON Dropzone
    const jsonDropzone = modal.querySelector('#pm-json-dropzone');
    const jsonInput = modal.querySelector('#pm-json-input');
    
    jsonDropzone.addEventListener('click', () => jsonInput.click());
    jsonDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleJSONFile(file);
    });
    jsonInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleJSONFile(e.target.files[0]);
    });

    // Export/Clear buttons
    modal.querySelector('#pm-export-btn').addEventListener('click', exportPositions);
    modal.querySelector('#pm-clear-btn').addEventListener('click', () => {
      if (confirm('Clear all positions? This cannot be undone.')) {
        window.PositionManager?.clear();
        renderPositions();
      }
    });

    // Add/Edit form
    modal.querySelector('#pm-save-btn').addEventListener('click', savePosition);
    modal.querySelector('#pm-reset-form-btn').addEventListener('click', resetForm);

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) close();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  function handleCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target.result;
      const merge = modalElement.querySelector('#pm-merge-existing').checked;
      const overwrite = modalElement.querySelector('#pm-overwrite').checked;
      
      try {
        const result = window.PositionManager.importFromCSV(csvText, { merge, overwrite });
        showImportResult(result);
        renderPositions();
        
        // Switch to positions tab to show results
        modalElement.querySelector('[data-tab="positions"]').click();
      } catch (err) {
        showImportResult({ error: err.message });
      }
    };
    reader.readAsText(file);
  }

  function handleJSONFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = window.PositionManager.importFromJSON(e.target.result);
      if (result.success) {
        renderPositions();
        modalElement.querySelector('[data-tab="positions"]').click();
      } else {
        alert('Import failed: ' + result.error);
      }
    };
    reader.readAsText(file);
  }

  function showImportResult(result) {
    const resultEl = modalElement.querySelector('#pm-import-result');
    resultEl.classList.remove('hidden', 'error');
    
    if (result.error) {
      resultEl.classList.add('error');
      resultEl.querySelector('.pm-result-summary').innerHTML = `❌ Import failed: ${result.error}`;
    } else {
      const totalPL = (result.summary?.totalStockPL || 0) + (result.summary?.totalOptionsPL || 0);
      const plClass = totalPL >= 0 ? 'positive' : 'negative';
      resultEl.querySelector('.pm-result-summary').innerHTML = `
        ✅ Imported <strong>${result.summary?.tickerCount || 0}</strong> tickers<br>
        <span class="pm-result-row">Stock P&L: <span class="${(result.summary?.totalStockPL || 0) >= 0 ? 'positive' : 'negative'}">$${(result.summary?.totalStockPL || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></span>
        <span class="pm-result-row">Options P&L: <span class="${(result.summary?.totalOptionsPL || 0) >= 0 ? 'positive' : 'negative'}">$${(result.summary?.totalOptionsPL || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></span>
        <span class="pm-result-row"><strong>Total P&L: <span class="${plClass}">$${totalPL.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></strong></span>
        ${result.summary?.totalOpenValue ? `<span class="pm-result-row">Open Position Value: $${result.summary.totalOpenValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>` : ''}
        <span class="pm-result-row pm-hint">Period: ${result.metadata?.Period || 'Unknown'}</span>
      `;
    }
  }

  function exportPositions() {
    const json = window.PositionManager.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `space-capital-positions-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  function savePosition() {
    const ticker = modalElement.querySelector('#pm-ticker').value.toUpperCase().trim();
    if (!ticker) {
      alert('Please enter a ticker symbol');
      return;
    }

    const data = {
      ticker,
      costBasis: parseFloat(modalElement.querySelector('#pm-cost-basis').value) || 0,
      currentValue: parseFloat(modalElement.querySelector('#pm-current-value').value) || 0,
      totalPL: parseFloat(modalElement.querySelector('#pm-total-pl-input').value) || undefined,
      stockPL: parseFloat(modalElement.querySelector('#pm-stock-pl').value) || 0,
      optionsPL: parseFloat(modalElement.querySelector('#pm-options-pl').value) || 0,
      source: 'manual'
    };

    // Calculate totalPL if not provided
    if (data.totalPL === undefined) {
      if (data.costBasis && data.currentValue) {
        data.totalPL = data.currentValue - data.costBasis;
      } else {
        data.totalPL = data.stockPL + data.optionsPL;
      }
    }

    window.PositionManager.set(ticker, data);
    renderPositions();
    resetForm();
    
    // Switch to positions tab
    modalElement.querySelector('[data-tab="positions"]').click();
  }

  function resetForm() {
    modalElement.querySelector('#pm-ticker').value = '';
    modalElement.querySelector('#pm-cost-basis').value = '';
    modalElement.querySelector('#pm-current-value').value = '';
    modalElement.querySelector('#pm-total-pl-input').value = '';
    modalElement.querySelector('#pm-stock-pl').value = '';
    modalElement.querySelector('#pm-options-pl').value = '';
  }

  function editPosition(ticker) {
    const pos = window.PositionManager.get(ticker);
    if (!pos) return;

    modalElement.querySelector('#pm-ticker').value = pos.ticker || '';
    modalElement.querySelector('#pm-cost-basis').value = pos.costBasis || '';
    modalElement.querySelector('#pm-current-value').value = pos.currentValue || '';
    modalElement.querySelector('#pm-total-pl-input').value = pos.totalPL || '';
    modalElement.querySelector('#pm-stock-pl').value = pos.stockPL || '';
    modalElement.querySelector('#pm-options-pl').value = pos.optionsPL || '';

    // Switch to add/edit tab
    modalElement.querySelector('[data-tab="add"]').click();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  function renderPositions() {
    const positions = window.PositionManager?.getAll() || {};
    const list = modalElement.querySelector('#pm-positions-list');
    const tickers = Object.keys(positions).sort();

    if (tickers.length === 0) {
      list.innerHTML = '<div class="pm-empty">No positions loaded. Import a CSV or add manually.</div>';
      modalElement.querySelector('#pm-total-pl').textContent = '$0.00';
      modalElement.querySelector('#pm-position-count').textContent = '0';
      return;
    }

    let totalPL = 0;
    const rows = tickers.map(ticker => {
      const pos = positions[ticker];
      const pl = pos.totalPL || 0;
      totalPL += pl;
      const plClass = pl >= 0 ? 'positive' : 'negative';
      const pctValue = window.PositionManager.getPnLPercent(ticker);
      const pctStr = pctValue !== 0 ? `${pctValue >= 0 ? '+' : ''}${pctValue.toFixed(1)}%` : '--';

      // Open position indicator
      const hasOpen = pos.hasOpenPosition || pos.openOptionsValue > 0 || pos.openStockValue > 0;
      const openIndicator = hasOpen ? '<span class="pm-open-badge" title="Has open positions">●</span>' : '';

      return `
        <div class="pm-position-row" data-ticker="${ticker}">
          <div class="pm-position-ticker">${ticker}${openIndicator}</div>
          <div class="pm-position-breakdown">
            ${pos.stockPL ? `<span class="${pos.stockPL >= 0 ? 'positive' : 'negative'}">Stock: $${pos.stockPL.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>` : ''}
            ${pos.optionsPL ? `<span class="${pos.optionsPL >= 0 ? 'positive' : 'negative'}">Opts: $${pos.optionsPL.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>` : ''}
          </div>
          <div class="pm-position-pl ${plClass}">$${pl.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          <div class="pm-position-pct">${pctStr}</div>
          <div class="pm-position-actions">
            <button class="pm-edit-btn" data-ticker="${ticker}" title="Edit">✎</button>
            <button class="pm-delete-btn" data-ticker="${ticker}" title="Delete">✕</button>
          </div>
        </div>
      `;
    }).join('');

    list.innerHTML = rows;

    // Update summary
    const totalEl = modalElement.querySelector('#pm-total-pl');
    totalEl.textContent = `$${totalPL.toFixed(2)}`;
    totalEl.className = 'pm-summary-value ' + (totalPL >= 0 ? 'positive' : 'negative');
    modalElement.querySelector('#pm-position-count').textContent = tickers.length;

    // Bind edit/delete buttons
    list.querySelectorAll('.pm-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editPosition(btn.dataset.ticker));
    });
    list.querySelectorAll('.pm-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm(`Remove ${btn.dataset.ticker}?`)) {
          window.PositionManager.remove(btn.dataset.ticker);
          renderPositions();
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  function open() {
    createModal();
    renderPositions();
    modalElement.classList.add('open');
    isOpen = true;
  }

  function close() {
    if (modalElement) {
      modalElement.classList.remove('open');
    }
    isOpen = false;
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  return {
    open,
    close,
    toggle,
    renderPositions
  };

})();
