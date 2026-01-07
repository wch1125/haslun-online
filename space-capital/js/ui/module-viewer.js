/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODULE VIEWER
 * Safe iframe-based integration of orphan pages without CSS/JS conflicts
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE REGISTRY
  // Paths are relative to html/space-capital.html
  // Only includes functional, maintained modules
  // ─────────────────────────────────────────────────────────────────────────
  const MODULES = [
    { id: 'derivatives',   label: '📊 Derivatives Console', url: 'derivatives.html' },
    { id: 'ship-select',   label: '🚀 Ship Select',         url: 'ship-select.html' },
    { id: 'behavior-demo', label: '⚡ Behavior Demo',       url: 'ship-behavior-demo.html' }
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE VIEWER CLASS
  // ─────────────────────────────────────────────────────────────────────────
  const ModuleViewer = {
    overlay: null,
    panel: null,
    select: null,
    frame: null,
    closeBtn: null,
    openBtn: null,
    currentModule: null,
    
    /**
     * Initialize the module viewer
     */
    init() {
      this.overlay = document.getElementById('moduleViewer');
      this.select = document.getElementById('moduleViewerSelect');
      this.frame = document.getElementById('moduleViewerFrame');
      this.closeBtn = document.getElementById('moduleViewerClose');
      this.openBtn = document.getElementById('openModulesBtn');
      
      if (!this.overlay || !this.select || !this.frame) {
        console.warn('[ModuleViewer] Required elements not found');
        return;
      }
      
      this.populateModules();
      this.bindEvents();
      
      console.log('[ModuleViewer] Initialized with', MODULES.length, 'modules');
    },
    
    /**
     * Populate the module selector dropdown
     */
    populateModules() {
      // Add placeholder option
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— Select Module —';
      placeholder.disabled = true;
      placeholder.selected = true;
      this.select.appendChild(placeholder);
      
      // Add module options
      MODULES.forEach(mod => {
        const opt = document.createElement('option');
        opt.value = mod.id;
        opt.textContent = mod.label;
        this.select.appendChild(opt);
      });
    },
    
    /**
     * Bind event listeners
     */
    bindEvents() {
      // Open button
      if (this.openBtn) {
        this.openBtn.addEventListener('click', () => this.open());
      }
      
      // Close button
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.close());
      }
      
      // Click outside to close
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
      
      // Module selection
      this.select.addEventListener('change', () => {
        const moduleId = this.select.value;
        if (moduleId) {
          this.loadModule(moduleId);
        }
      });
      
      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) {
          this.close();
        }
      });
      
      // Iframe load events
      this.frame.addEventListener('load', () => {
        this.frame.removeAttribute('data-loading');
      });
    },
    
    /**
     * Check if viewer is open
     */
    isOpen() {
      return this.overlay.getAttribute('aria-hidden') === 'false';
    },
    
    /**
     * Open the module viewer
     * @param {string} [moduleId] - Optional module to load immediately
     */
    open(moduleId) {
      this.overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      
      // Focus the select or close button for accessibility
      setTimeout(() => {
        this.select.focus();
      }, 100);
      
      // Load specific module if provided
      if (moduleId) {
        this.select.value = moduleId;
        this.loadModule(moduleId);
      }
      
      console.log('[ModuleViewer] Opened');
    },
    
    /**
     * Close the module viewer
     */
    close() {
      this.overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      
      // Clear iframe to stop any running processes
      this.frame.src = 'about:blank';
      this.currentModule = null;
      
      // Reset select
      this.select.selectedIndex = 0;
      
      // Return focus to open button
      if (this.openBtn) {
        this.openBtn.focus();
      }
      
      console.log('[ModuleViewer] Closed');
    },
    
    /**
     * Load a module into the iframe
     * @param {string} moduleId - The module ID to load
     */
    loadModule(moduleId) {
      const module = MODULES.find(m => m.id === moduleId);
      
      if (!module) {
        console.warn('[ModuleViewer] Module not found:', moduleId);
        return;
      }
      
      // Show loading state
      this.frame.setAttribute('data-loading', 'true');
      
      // Load the module
      this.frame.src = module.url;
      this.currentModule = module;
      
      console.log('[ModuleViewer] Loading module:', module.label);
    },
    
    /**
     * Get available modules
     * @returns {Array} List of modules
     */
    getModules() {
      return MODULES;
    },
    
    /**
     * Get current module
     * @returns {Object|null} Current module or null
     */
    getCurrentModule() {
      return this.currentModule;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  
  // Expose globally
  window.ModuleViewer = ModuleViewer;
  
  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ModuleViewer.init());
  } else {
    ModuleViewer.init();
  }
  
})();
