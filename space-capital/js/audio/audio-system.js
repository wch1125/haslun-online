// =========================================================================
// HASLUN-BOT AUDIO SYSTEM
// 90s Anime Mech Sound Effects + Epic Background Music
// Inspired by Gundam, Evangelion, Macross soundtracks
// Extracted from app.js for modularity
// =========================================================================

(function() {
  // Audio context (lazy init)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = AudioCtx ? new AudioCtx() : null;
    }
    return audioCtx;
}

// =========================================================================
// MECH SFX — Procedural sound effects for UI interactions
// =========================================================================
const MechSFX = {
  // Bass-heavy synth hit (like mech footsteps)
  bassHit(freq = 60, duration = 0.15) {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    // Two detuned oscillators for thickness
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc2.type = 'square';
    osc2.frequency.value = freq * 0.5;
    osc2.detune.value = -10;
    
    // Low pass filter for that analog warmth
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;
    // Filter sweep
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + duration);
    
    // Punchy envelope
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc2.start();
    osc.stop(ctx.currentTime + duration);
    osc2.stop(ctx.currentTime + duration);
  },
  
  // Synth stab (like UI confirmations in mech cockpits)
  synthStab(freq = 440, duration = 0.08) {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'square';
    osc.frequency.value = freq;
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq * 1.01; // Slight detune
    
    filter.type = 'bandpass';
    filter.frequency.value = freq * 2;
    filter.Q.value = 1;
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc2.start();
    osc.stop(ctx.currentTime + duration);
    osc2.stop(ctx.currentTime + duration);
  },
  
  // Alarm/alert sound (descending synth sweep)
  alert(startFreq = 800, endFreq = 200, duration = 0.25) {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const distortion = ctx.createWaveShaper();
    
    // Create distortion curve for grit
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 2);
    }
    distortion.curve = curve;
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(distortion);
    distortion.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  },
  
  // Power up sound (rising sweep with harmonics)
  powerUp(duration = 0.3) {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + duration);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(160, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + duration);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + duration);
    filter.Q.value = 4;
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc2.start();
    osc.stop(ctx.currentTime + duration);
    osc2.stop(ctx.currentTime + duration);
  },
  
  // Weapon fire sound
  weaponFire(duration = 0.12) {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    
    // Noise generator for "pew" texture
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);
    
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    noise.connect(filter);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start();
    osc.start();
    osc.stop(ctx.currentTime + duration);
  },
  
  // Explosion/impact sound
  impact(duration = 0.35) {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    
    // Deep bass thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + duration);
    
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
    
    // Noise burst on top
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 500;
    
    noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    noise.start();
  },
  
  // Selection/tick sound
  tick(freq = 880, duration = 0.04) {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  },
  
  // Success fanfare (two-tone up)
  success() {
    this.synthStab(523, 0.08);
    setTimeout(() => this.synthStab(659, 0.12), 80);
  },
  
  // Error/warning tone
  error() {
    this.alert(400, 200, 0.15);
  }
};

// =========================================================================
// EPIC ANIME MECHA BACKGROUND MUSIC SYSTEM
// Procedurally generated synth music inspired by Gundam, Evangelion, Macross
// =========================================================================
const MechaBGM = {
  ctx: null,
  masterGain: null,
  isPlaying: false,
  currentTrack: null,
  volume: 0.12, // Default volume (subtle background)
  
  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
  },
  
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
    }
  },
  
  // Epic synth pad drone
  createPad(freq, duration) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc1.type = 'sawtooth';
    osc1.frequency.value = freq;
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq * 1.005;
    osc3.type = 'square';
    osc3.frequency.value = freq * 0.5;
    
    filter.type = 'lowpass';
    filter.frequency.value = freq * 2;
    filter.Q.value = 1;
    
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.5);
    gain.gain.setValueAtTime(0.06, now + duration - 0.5);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    
    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
  },
  
  // Rhythmic bass pulse
  createBass(freq, pattern, loopDuration) {
    const now = this.ctx.currentTime;
    const eighthNote = loopDuration / 8;
    
    pattern.forEach((hit, i) => {
      if (!hit) return;
      const startTime = now + (i * eighthNote);
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8, startTime + 0.15);
      
      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  },
  
  // Epic arpeggio sequence
  createArp(baseFreq, loopDuration) {
    const now = this.ctx.currentTime;
    const sixteenthNote = loopDuration / 16;
    const intervals = [1, 1.2, 1.5, 2, 2.4, 3, 4, 3, 2.4, 2, 1.5, 1.2, 1, 1.5, 2, 1.5];
    
    for (let i = 0; i < 16; i++) {
      if (Math.random() > 0.65) continue;
      
      const startTime = now + (i * sixteenthNote);
      const freq = baseFreq * intervals[i % intervals.length];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      
      osc.type = 'square';
      osc.frequency.value = freq;
      
      filter.type = 'bandpass';
      filter.frequency.value = freq * 2;
      filter.Q.value = 2;
      
      gain.gain.setValueAtTime(0.03, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + sixteenthNote * 0.8);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + sixteenthNote);
    }
  },
  
  // Main loop
  playLoop() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    const bpm = 110;
    const barDuration = (60 / bpm) * 4;
    const loopDuration = barDuration * 2;
    
    const chords = [
      { root: 110 },   // A minor
      { root: 146.83 }, // D
      { root: 130.81 }, // C
      { root: 98 },     // G
    ];
    
    const playSegment = (segmentIndex) => {
      if (!this.isPlaying) return;
      
      const chord = chords[segmentIndex % chords.length];
      
      this.createPad(chord.root, loopDuration);
      this.createPad(chord.root * 1.5, loopDuration);
      this.createBass(chord.root * 0.5, [1,0,1,0,0,1,0,0], loopDuration);
      this.createArp(chord.root * 2, loopDuration);
      
      setTimeout(() => playSegment(segmentIndex + 1), loopDuration * 1000);
    };
    
    this.isPlaying = true;
    playSegment(0);
    
    if (typeof logTerminal === 'function') {
      logTerminal('BGM SYSTEM · MECHA SORTIE · playing');
    }
  },
  
  stop() {
    this.isPlaying = false;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }
    if (typeof logTerminal === 'function') {
      logTerminal('BGM SYSTEM · standby');
    }
  },
  
  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
      }
      this.playLoop();
    }
    return this.isPlaying;
  }
};

// =========================================================================
  // Global exports
  // =========================================================================
  window.getAudioContext = getAudioContext;
  window.MechSFX = MechSFX;
  window.MechaBGM = MechaBGM;

  // Silent beep by default - no more annoying sounds!
  window.beep = function(freq = 520, duration = 0.08) {
    // Silent - beeping disabled per user request
    // Epic mecha music only!
  };
})();
