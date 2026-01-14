/**
 * Aquarelle - Game Logic v4.0
 * A watercolor mixing puzzle game
 * 
 * Design: Ceramic palette wheels with center mixing wells
 * Layout: Warm palette, Cool palette, Earth palette
 * Interaction: Tap wells to select, center shows selection
 * 
 * Configurable pigment-to-well mapping for future randomization
 * 
 * Depends on: watercolor-engine.js
 */

(function() {
  'use strict';

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================
  
  const CONFIG = {
    maxLevels: 20,
    maxSelections: 2,
    matchThresholds: {
      perfect: 100,
      great: 95,
      good: 90
    },
    scoring: {
      perfect: 200,
      great: 150,
      good: 100,
      chainBonus: 50,
      skip: -10
    },
    excludedPigments: ['111', '782'],
    storageKey: 'aquarelleData',
    version: '5.0',
    audio: {
      enabled: true,
      volume: 0.25
    },
    haptic: {
      enabled: true,
      selectDuration: 12,
      deselectDuration: 8,
      submitDuration: 25,
      perfectDuration: [20, 10, 20]
    },
    paletteDefinitions: {
      warm: { name: 'Warm', families: ['yellow', 'orange', 'red'], includeIds: ['660', '665', '666'] }, // + Ochre, Sepia, English Red
      cool: { name: 'Cool', families: ['violet', 'blue', 'green', 'neutral'], includeIds: ['664'] } // + Burnt Umber
    }
  };

  // ===========================================================================
  // AUDIO
  // ===========================================================================
  
  let audioContext = null;
  
  function getAudioContext() {
    if (!audioContext && typeof AudioContext !== 'undefined') {
      audioContext = new AudioContext();
    }
    return audioContext;
  }
  
  function playSelectSound() {
    if (!CONFIG.audio.enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.025);
      gain.gain.setValueAtTime(CONFIG.audio.volume * 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
  }
  
  function playDeselectSound() {
    if (!CONFIG.audio.enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(CONFIG.audio.volume * 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.045);
    } catch (e) {}
  }
  
  function playSuccessSound(isPerfect = false) {
    if (!CONFIG.audio.enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const notes = isPerfect ? [800, 1000, 1200] : [800, 1000];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        const startTime = ctx.currentTime + (i * 0.06);
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(CONFIG.audio.volume * 0.5, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);
        osc.start(startTime);
        osc.stop(startTime + 0.14);
      });
    } catch (e) {}
  }
  
  function playFailSound() {
    if (!CONFIG.audio.enabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(CONFIG.audio.volume * 0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }

  function triggerHaptic(pattern) {
    if (!CONFIG.haptic.enabled) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ===========================================================================
  // ENGINE & PIGMENT MANAGEMENT
  // ===========================================================================
  
  let engine;
  let ALL_PIGMENTS = [];
  let paletteWells = { warm: [], cool: [] };
  // Selected pigments now store {pigment, dilution} objects
  // dilution: 0.3 = concentrated (full strength), 1.0 = very diluted (watery)
  let selectedPigments = [];
  const DEFAULT_DILUTION = 0.6;

  function initEngine() {
    if (typeof WatercolorEngine === 'undefined') {
      throw new Error('WatercolorEngine not loaded');
    }
    engine = new WatercolorEngine();
    ALL_PIGMENTS = engine.getAllPigments()
      .filter(p => !CONFIG.excludedPigments.includes(p.id))
      .map(p => ({
        ...p,
        displayName: p.nameEn,
        rgb: engine.hexToRgb(p.hex)
      }));
    arrangePalettes();
  }
  
  function arrangePalettes(randomize = false, mixPalettes = false) {
    if (mixPalettes) {
      const shuffled = shuffleArray([...ALL_PIGMENTS]);
      const half = Math.ceil(shuffled.length / 2);
      paletteWells.warm = shuffled.slice(0, half);
      paletteWells.cool = shuffled.slice(half);
    } else {
      Object.keys(CONFIG.paletteDefinitions).forEach(paletteId => {
        const def = CONFIG.paletteDefinitions[paletteId];
        // Get pigments by family
        let pigments = ALL_PIGMENTS.filter(p => def.families.includes(p.family));
        // Add any specifically included pigments by ID
        if (def.includeIds) {
          const extras = ALL_PIGMENTS.filter(p => def.includeIds.includes(p.id));
          pigments = [...pigments, ...extras];
        }
        // Remove duplicates (in case a pigment matches both family and includeId)
        pigments = [...new Map(pigments.map(p => [p.id, p])).values()];
        if (randomize) pigments = shuffleArray(pigments);
        paletteWells[paletteId] = pigments;
      });
    }
    selectedPigments = [];
  }
  
  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  
  function getPaletteForPigment(pigmentId) {
    for (const [paletteId, pigments] of Object.entries(paletteWells)) {
      if (pigments.some(p => p.id === pigmentId)) return paletteId;
    }
    return null;
  }

  // ===========================================================================
  // GAME STATE
  // ===========================================================================
  
  const state = {
    level: 1,
    score: 0,
    highScore: 0,
    baseColor: null,
    targetColor: null,
    targetRecipe: null,
    gameStarted: false,
    levelHistory: [],
    perfectChain: 0,
    stats: {
      gamesPlayed: 0,
      levelsCompleted: 0,
      perfectMatches: 0,
      totalStars: 0,
      longestPerfectChain: 0
    }
  };

  // ===========================================================================
  // STORAGE
  // ===========================================================================
  
  function isStorageAvailable() {
    try {
      const test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch(e) { return false; }
  }
  
  function loadGameData() {
    if (!isStorageAvailable()) return { highScore: 0, stats: state.stats };
    try {
      const data = localStorage.getItem(CONFIG.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        return typeof parsed === 'number' ? { highScore: parsed, stats: state.stats } : parsed;
      }
    } catch (e) {}
    return { highScore: 0, stats: state.stats };
  }

  function saveGameData() {
    if (!isStorageAvailable()) return;
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        highScore: state.highScore,
        stats: state.stats,
        version: CONFIG.version
      }));
    } catch (e) {}
  }

  // ===========================================================================
  // COLOR CALCULATIONS
  // ===========================================================================
  
  function getSelectedPigments() {
    return selectedPigments.map(s => s.pigment);
  }
  
  function getSelectedWithDilution() {
    return selectedPigments;
  }
  
  function glazeStack(pigmentsWithDilution) {
    const valid = pigmentsWithDilution.filter(Boolean);
    if (valid.length === 0) return state.baseColor || engine.paperWhite;
    // Pass dilution info to engine
    return engine.glazeMultipleWithDilution(valid, state.baseColor || engine.paperWhite);
  }

  function colorDistance(hex1, hex2) {
    const rgb1 = engine.hexToRgb(hex1);
    const rgb2 = engine.hexToRgb(hex2);
    const rMean = (rgb1[0] + rgb2[0]) / 2;
    const dr = rgb1[0] - rgb2[0];
    const dg = rgb1[1] - rgb2[1];
    const db = rgb1[2] - rgb2[2];
    const dist = Math.sqrt(
      (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db
    );
    return Math.round(Math.max(0, 100 - (dist / 765) * 100));
  }

  // ===========================================================================
  // LEVEL GENERATION
  // ===========================================================================
  
  function generateLevel(levelNum) {
    let numPigments = levelNum <= 3 ? 1 : 2;
    state.baseColor = engine.paperWhite;
    const shuffled = shuffleArray([...ALL_PIGMENTS]);
    const recipe = shuffled.slice(0, numPigments);
    const targetColor = glazeStack(recipe);
    return { targetColor, recipe, numPigments };
  }

  // ===========================================================================
  // SELECTION MANAGEMENT
  // ===========================================================================
  
  function selectPigment(pigment, dilution = DEFAULT_DILUTION) {
    const index = selectedPigments.findIndex(s => s.pigment.id === pigment.id);
    
    if (index !== -1) {
      // Already selected - remove it
      selectedPigments.splice(index, 1);
      playDeselectSound();
      triggerHaptic(CONFIG.haptic.deselectDuration);
    } else if (selectedPigments.length < CONFIG.maxSelections) {
      // Add to selection (if under max)
      selectedPigments.push({ pigment, dilution });
      playSelectSound();
      triggerHaptic(CONFIG.haptic.selectDuration);
    } else {
      // At max (2) - replace the SECOND selection, keep the first locked
      selectedPigments[1] = { pigment, dilution };
      playSelectSound();
      triggerHaptic(CONFIG.haptic.selectDuration);
    }
    render();
  }
  
  function updateDilution(pigmentId, dilution) {
    const selection = selectedPigments.find(s => s.pigment.id === pigmentId);
    if (selection) {
      selection.dilution = Math.max(0.2, Math.min(1.0, dilution));
      render();
    }
  }
  
  function clearSelections() {
    selectedPigments = [];
    render();
  }

  // ===========================================================================
  // DOM HELPERS
  // ===========================================================================
  
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // ===========================================================================
  // RENDERING
  // ===========================================================================
  
  function renderPalettes() {
    // Render pigment wells for each palette
    Object.keys(paletteWells).forEach(paletteId => {
      const container = $(`#palette-${paletteId}`);
      if (!container) return;
      
      const pigments = paletteWells[paletteId];
      const wellsContainer = container.querySelector('.palette-wells');
      
      if (!wellsContainer) return;
      
      const numWells = pigments.length;
      wellsContainer.innerHTML = pigments.map((p, i) => {
        const angle = (i / numWells) * 360 - 90;
        const selection = selectedPigments.find(s => s.pigment.id === p.id);
        const isSelected = !!selection;
        const dilution = selection ? selection.dilution : DEFAULT_DILUTION;
        
        return `
          <button 
            class="palette-well ${isSelected ? 'selected' : ''}"
            style="--angle: ${angle}deg;"
            data-pigment-id="${p.id}"
            aria-label="${p.displayName}"
            aria-pressed="${isSelected}"
          >
            <span class="well-pigment" style="background: ${p.hex};"></span>
            ${isSelected ? `<svg class="dilution-ring" viewBox="0 0 44 44">
              <circle class="dilution-track" cx="22" cy="22" r="20" />
              <circle class="dilution-fill" cx="22" cy="22" r="20" 
                style="stroke-dashoffset: ${125.6 * (1 - dilution)}" />
            </svg>` : ''}
          </button>
        `;
      }).join('');
      
      // Attach interaction handlers
      wellsContainer.querySelectorAll('.palette-well').forEach(well => {
        const pigmentId = well.dataset.pigmentId;
        const pigment = ALL_PIGMENTS.find(p => p.id === pigmentId);
        if (!pigment) return;
        
        let longPressTimer = null;
        let isDragging = false;
        let startY = 0;
        let startDilution = DEFAULT_DILUTION;
        
        const startLongPress = (e) => {
          const selection = selectedPigments.find(s => s.pigment.id === pigmentId);
          if (!selection) {
            // Not selected - just select on tap
            return;
          }
          
          // Start long press timer for dilution adjustment
          startY = e.touches ? e.touches[0].clientY : e.clientY;
          startDilution = selection.dilution;
          
          longPressTimer = setTimeout(() => {
            isDragging = true;
            well.classList.add('adjusting');
            triggerHaptic(15);
          }, 300);
        };
        
        const moveDrag = (e) => {
          if (!isDragging) return;
          e.preventDefault();
          
          const currentY = e.touches ? e.touches[0].clientY : e.clientY;
          const deltaY = startY - currentY; // Up = more concentrated
          const deltaDilution = deltaY / 150; // Sensitivity
          
          const newDilution = Math.max(0.2, Math.min(1.0, startDilution - deltaDilution));
          updateDilution(pigmentId, newDilution);
        };
        
        const endDrag = () => {
          clearTimeout(longPressTimer);
          if (isDragging) {
            isDragging = false;
            well.classList.remove('adjusting');
          }
        };
        
        const handleTap = () => {
          if (isDragging) return;
          clearTimeout(longPressTimer);
          selectPigment(pigment);
        };
        
        // Mouse events
        well.addEventListener('mousedown', startLongPress);
        well.addEventListener('mousemove', moveDrag);
        well.addEventListener('mouseup', (e) => { endDrag(); if (!isDragging) handleTap(); });
        well.addEventListener('mouseleave', endDrag);
        
        // Touch events
        well.addEventListener('touchstart', startLongPress, { passive: true });
        well.addEventListener('touchmove', moveDrag, { passive: false });
        well.addEventListener('touchend', (e) => { endDrag(); if (!isDragging) handleTap(); });
        well.addEventListener('touchcancel', endDrag);
      });
    });
    
    // Update center wells to show current selections with dilution
    const centerWell1 = $('#center-well-1');
    const centerWell2 = $('#center-well-2');
    
    if (centerWell1) {
      if (selectedPigments[0]) {
        const s = selectedPigments[0];
        // Show glazed color at current dilution
        const glazedColor = engine.glazeMultipleWithDilution([s], engine.paperWhite);
        centerWell1.style.background = glazedColor;
        centerWell1.classList.add('filled');
        centerWell1.style.setProperty('--dilution', s.dilution);
      } else {
        centerWell1.style.background = '';
        centerWell1.classList.remove('filled');
      }
    }
    
    if (centerWell2) {
      if (selectedPigments[1]) {
        const s = selectedPigments[1];
        const glazedColor = engine.glazeMultipleWithDilution([s], engine.paperWhite);
        centerWell2.style.background = glazedColor;
        centerWell2.classList.add('filled');
        centerWell2.style.setProperty('--dilution', s.dilution);
      } else {
        centerWell2.style.background = '';
        centerWell2.classList.remove('filled');
      }
    }
  }
  
  function renderPreview() {
    const mixCircle = $('#mix-circle');
    const gameLayout = $('.game-layout');
    const matchValue = $('#match-value');
    const submitBtn = $('#submit-btn');
    
    const selected = selectedPigments; // Now has {pigment, dilution} objects
    const baseColor = state.baseColor || engine.paperWhite;
    
    let mixColor = 'transparent'; // Start transparent to show paper
    let match = 0;
    
    if (selected.length > 0) {
      mixColor = glazeStack(selected);
      match = colorDistance(mixColor, state.targetColor);
    }
    
    // Set mix circle color (transparent shows paper underneath)
    if (mixCircle) {
      mixCircle.style.background = mixColor;
      mixCircle.classList.toggle('has-pigment', selected.length > 0);
      mixCircle.classList.toggle('matched', match >= CONFIG.matchThresholds.good);
      
      // Add perfect pulse animation
      if (match >= CONFIG.matchThresholds.perfect && selected.length > 0) {
        mixCircle.classList.remove('perfect');
        void mixCircle.offsetWidth; // Trigger reflow
        mixCircle.classList.add('perfect');
      } else {
        mixCircle.classList.remove('perfect');
      }
    }
    
    // Set target as background color
    if (gameLayout) {
      gameLayout.style.setProperty('--target-color', state.targetColor);
    }
    
    if (matchValue) {
      matchValue.textContent = selected.length > 0 ? match + '%' : '—';
      let q = '';
      if (match >= CONFIG.matchThresholds.perfect) q = 'perfect';
      else if (match >= CONFIG.matchThresholds.great) q = 'great';
      else if (match >= CONFIG.matchThresholds.good) q = 'good';
      matchValue.className = 'match-value ' + q;
    }
    
    if (submitBtn) submitBtn.disabled = selected.length === 0;
  }

  function render() {
    renderPalettes();
    renderPreview();
  }

  // ===========================================================================
  // GAME ACTIONS
  // ===========================================================================
  
  function submitAnswer() {
    const selected = getSelectedPigments();
    if (selected.length === 0) return;

    const resultColor = glazeStack(selected);
    const match = colorDistance(resultColor, state.targetColor);

    let points = 0, stars = 0;
    const isPerfect = match >= CONFIG.matchThresholds.perfect;
    const isGreat = match >= CONFIG.matchThresholds.great;
    const isGood = match >= CONFIG.matchThresholds.good;
    
    if (isPerfect) {
      state.perfectChain++;
      const chainBonus = (state.perfectChain - 1) * CONFIG.scoring.chainBonus;
      points = (CONFIG.scoring.perfect + chainBonus) * Math.ceil(state.level / 5);
      stars = 3;
      if (state.perfectChain > state.stats.longestPerfectChain) {
        state.stats.longestPerfectChain = state.perfectChain;
      }
      playSuccessSound(true);
      triggerHaptic(CONFIG.haptic.perfectDuration);
    } else if (isGreat) {
      state.perfectChain = 0;
      points = CONFIG.scoring.great * Math.ceil(state.level / 5);
      stars = 2;
      playSuccessSound(false);
      triggerHaptic(CONFIG.haptic.submitDuration);
    } else if (isGood) {
      state.perfectChain = 0;
      points = CONFIG.scoring.good * Math.ceil(state.level / 5);
      stars = 1;
      playSuccessSound(false);
      triggerHaptic(CONFIG.haptic.submitDuration);
    } else {
      state.perfectChain = 0;
      playFailSound();
      triggerHaptic(CONFIG.haptic.submitDuration);
    }

    if (stars > 0) {
      state.stats.levelsCompleted++;
      state.stats.totalStars += stars;
      if (stars === 3) state.stats.perfectMatches++;
    }

    state.levelHistory.push({
      level: state.level, match, stars, points,
      chain: state.perfectChain,
      selected: selected.map(p => p.id),
      target: state.targetRecipe.map(p => p.id)
    });

    showLevelModal(resultColor, match, points, stars);
  }

  function showLevelModal(resultColor, match, points, stars) {
    const modal = $('#level-modal');
    const selected = getSelectedPigments();
    
    $('#modal-target').style.background = state.targetColor;
    $('#modal-result').style.background = resultColor;

    $$('#modal-stars .star').forEach((s, i) => {
      s.classList.toggle('earned', i < stars);
    });

    const chainIndicator = $('#chain-indicator');
    if (chainIndicator) {
      chainIndicator.style.display = state.perfectChain > 1 ? 'block' : 'none';
      chainIndicator.textContent = `${state.perfectChain}x Chain`;
    }

    // Populate pigment cards
    const card1 = $('#pigment-card-1');
    const card2 = $('#pigment-card-2');
    const operator2 = $('#operator-2');
    
    if (selected.length >= 1 && card1) {
      const s = selectedPigments[0];
      const p = s.pigment;
      $('#pigment-swatch-1').style.background = p.hex;
      $('#pigment-name-1').textContent = p.displayName;
      $('#pigment-props-1').textContent = formatDilution(s.dilution) + ' · ' + formatTransparency(p.transparency);
      card1.style.display = 'flex';
    }
    
    if (selected.length >= 2 && card2) {
      const s = selectedPigments[1];
      const p = s.pigment;
      $('#pigment-swatch-2').style.background = p.hex;
      $('#pigment-name-2').textContent = p.displayName;
      $('#pigment-props-2').textContent = formatDilution(s.dilution) + ' · ' + formatTransparency(p.transparency);
      card2.style.display = 'flex';
      if (operator2) operator2.style.display = 'block';
    } else if (card2) {
      card2.style.display = 'none';
      if (operator2) operator2.style.display = 'none';
    }
    
    // Generate insight text
    const insight = $('#mix-insight');
    if (insight) {
      insight.textContent = generateInsight(selected, match);
    }

    const icon = $('#modal-icon');
    const title = $('#modal-title');
    const subtitle = $('#modal-subtitle');
    const modalScore = $('#modal-score');

    if (match >= CONFIG.matchThresholds.perfect) {
      icon.textContent = 'iii'; icon.className = 'modal-icon perfect';
      title.textContent = 'Perfect'; subtitle.textContent = `${match}% match`;
    } else if (match >= CONFIG.matchThresholds.great) {
      icon.textContent = 'ii'; icon.className = 'modal-icon great';
      title.textContent = 'Great'; subtitle.textContent = `${match}% match`;
    } else if (match >= CONFIG.matchThresholds.good) {
      icon.textContent = 'i'; icon.className = 'modal-icon good';
      title.textContent = 'Good'; subtitle.textContent = `${match}% match`;
    } else {
      icon.textContent = '—'; icon.className = 'modal-icon retry';
      title.textContent = 'Not Quite';
      subtitle.textContent = `${match}% — need ${CONFIG.matchThresholds.good}%`;
      modalScore.textContent = '+0';
      modal.classList.add('active');
      return;
    }

    state.score += points;
    modalScore.textContent = '+' + points;
    $('#score-display').textContent = state.score;

    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveGameData();
    }
    modal.classList.add('active');
  }
  
  function formatTransparency(t) {
    const map = {
      'transparent': 'transparent',
      'semi-transparent': 'semi-trans',
      'semi-opaque': 'semi-opaque',
      'opaque': 'opaque'
    };
    return map[t] || t;
  }
  
  function formatDilution(d) {
    if (d >= 0.85) return 'very dilute';
    if (d >= 0.7) return 'dilute';
    if (d >= 0.5) return 'medium';
    if (d >= 0.35) return 'rich';
    return 'concentrated';
  }
  
  function generateInsight(pigments, match) {
    if (pigments.length === 0) return '';
    
    // Get pigments with their dilution info
    const selections = selectedPigments;
    
    if (selections.length === 1) {
      const s = selections[0];
      const p = s.pigment;
      const dilute = s.dilution >= 0.7;
      const concentrated = s.dilution <= 0.35;
      
      if (dilute) {
        return `Diluted ${p.displayName}—water lets the paper luminance through.`;
      } else if (concentrated) {
        return `Concentrated ${p.displayName} approaches its full tube color.`;
      } else if (p.transparency === 'transparent') {
        return `Transparent ${p.displayName} lets the white paper glow through.`;
      } else if (p.transparency === 'opaque') {
        return `Opaque ${p.displayName} covers the paper more fully.`;
      }
      return `${p.displayName} glazed over white paper.`;
    }
    
    const s1 = selections[0];
    const s2 = selections[1];
    const p1 = s1.pigment;
    const p2 = s2.pigment;
    
    // Check for complementary mixing insights
    const family1 = p1.family;
    const family2 = p2.family;
    
    if ((family1 === 'yellow' && family2 === 'blue') || (family1 === 'blue' && family2 === 'yellow')) {
      return 'Yellow and blue layers create natural greens.';
    }
    if ((family1 === 'red' && family2 === 'yellow') || (family1 === 'yellow' && family2 === 'red')) {
      return 'Warm layers—yellow and red glow together.';
    }
    if ((family1 === 'red' && family2 === 'blue') || (family1 === 'blue' && family2 === 'red')) {
      return 'Red and blue layers create rich violets.';
    }
    if (family1 === 'earth' || family2 === 'earth') {
      return 'Earth tones add warmth and depth to any mix.';
    }
    
    // Dilution-based insights
    if (s1.dilution >= 0.8 && s2.dilution >= 0.8) {
      return 'Very dilute washes—maximum paper glow.';
    }
    if (s1.dilution <= 0.35 || s2.dilution <= 0.35) {
      return 'Concentrated pigment creates stronger color.';
    }
    
    if (p1.transparency === 'transparent' && p2.transparency === 'transparent') {
      return 'Two transparent glazes—maximum luminosity from the paper.';
    }
    if (p1.transparency === 'opaque' || p2.transparency === 'opaque') {
      return 'Opaque pigments block paper glow—darker result.';
    }
    
    return `Two glazes over paper: ${p1.displayName} then ${p2.displayName}.`;
  }

  function nextLevel() {
    $('#level-modal').classList.remove('active');
    state.level++;
    clearSelections();

    if (state.level > CONFIG.maxLevels) {
      showGameOver();
      return;
    }

    const level = generateLevel(state.level);
    state.targetColor = level.targetColor;
    state.targetRecipe = level.recipe;
    $('#level-display').textContent = state.level;
    render();
  }

  function skipLevel() {
    state.score = Math.max(0, state.score + CONFIG.scoring.skip);
    state.perfectChain = 0;
    $('#score-display').textContent = state.score;
    clearSelections();
    state.level++;

    state.levelHistory.push({
      level: state.level - 1, match: 0, stars: 0,
      points: CONFIG.scoring.skip, skipped: true
    });

    if (state.level > CONFIG.maxLevels) {
      showGameOver();
      return;
    }

    const level = generateLevel(state.level);
    state.targetColor = level.targetColor;
    state.targetRecipe = level.recipe;
    $('#level-display').textContent = state.level;
    render();
  }

  function showGameOver() {
    state.stats.gamesPlayed++;
    saveGameData();
    $('#final-score').textContent = state.score;
    
    const perfectCount = state.levelHistory.filter(l => l.stars === 3).length;
    let summary = `${state.level - 1} levels`;
    if (perfectCount > 0) summary += ` · ${perfectCount} perfect`;
    if (state.stats.longestPerfectChain > 1) summary += ` · ${state.stats.longestPerfectChain}x chain`;
    $('#gameover-subtitle').textContent = summary;
    $('#gameover-modal').classList.add('active');
  }

  function restartGame() {
    $('#gameover-modal').classList.remove('active');
    state.level = 1;
    state.score = 0;
    state.levelHistory = [];
    state.perfectChain = 0;
    clearSelections();
    startGame();
  }

  function goHome() {
    $('#gameover-modal').classList.remove('active');
    $('#game-screen').classList.remove('active');
    $('#start-screen').style.display = 'flex';
    $('#high-score-display span').textContent = state.highScore;
  }

  function startGame() {
    $('#start-screen').style.display = 'none';
    $('#game-screen').classList.add('active');

    state.level = 1;
    state.score = 0;
    state.levelHistory = [];
    state.perfectChain = 0;
    state.gameStarted = true;
    arrangePalettes(false, false);

    const level = generateLevel(state.level);
    state.targetColor = level.targetColor;
    state.targetRecipe = level.recipe;
    $('#level-display').textContent = state.level;
    $('#score-display').textContent = state.score;
    render();
  }

  function handleKeyboard(e) {
    if (!state.gameStarted) return;
    if (e.key === 'Enter' && getSelectedPigments().length > 0) submitAnswer();
    if (e.key === 'Escape') clearSelections();
  }

  function init() {
    initEngine();
    state.baseColor = engine.paperWhite;
    const savedData = loadGameData();
    state.highScore = savedData.highScore || 0;
    state.stats = { ...state.stats, ...savedData.stats };
    const highScoreEl = $('#high-score-display span');
    if (highScoreEl) highScoreEl.textContent = state.highScore;
    document.addEventListener('keydown', handleKeyboard);
    console.log(`Aquarelle v${CONFIG.version} initialized`);
  }

  window.Aquarelle = {
    init, startGame, clearSelections, skipLevel, submitAnswer,
    nextLevel, restartGame, goHome,
    arrangePalettes,
    shufflePalettes: () => arrangePalettes(true, false),
    randomizePalettes: () => arrangePalettes(false, true),
    getState: () => ({ ...state }),
    getConfig: () => ({ ...CONFIG }),
    getPaletteWells: () => ({ ...paletteWells }),
    getSelectedPigments: () => [...selectedPigments]
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
