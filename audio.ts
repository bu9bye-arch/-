
export class SoundManager {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  bgmGain: GainNode | null = null;
  
  isMuted: boolean = false;
  initialized: boolean = false;

  // Sequencer State
  nextNoteTime: number = 0;
  noteIndex: number = 0;
  sequencerTimer: number | null = null;
  tempo: number = 0.15; // Duration of one 16th note in seconds

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Global volume
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      this.startMusic();
    } catch (e) {
      console.error("Audio init failed", e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    }
  }

  // Helper to play a simple tone
  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1, slideTo: number | null = null) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playEat() {
    // High, short blip
    this.playTone(600 + Math.random() * 200, 'sine', 0.1, 0.1);
  }

  playSplit() {
    // Sharp whoosh
    this.playTone(400, 'sawtooth', 0.2, 0.15, 100);
  }

  playEject() {
    // Low thud
    this.playTone(150, 'square', 0.1, 0.1, 50);
  }

  playExplode() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    // Simulate noise/explosion with multiple dissonant oscillators
    for (let i = 0; i < 5; i++) {
        this.playTone(100 + Math.random() * 100, 'sawtooth', 0.4, 0.1, 10);
    }
  }

  // --- RETRO MUSIC SEQUENCER ---

  startMusic() {
    if (!this.ctx || !this.masterGain) return;
    if (this.sequencerTimer) return; // Already playing

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.15; // Background volume
    this.bgmGain.connect(this.masterGain);

    // Reset sequencer
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.noteIndex = 0;

    // Start scheduling loop (checks every 25ms)
    this.sequencerTimer = window.setInterval(() => this.scheduler(), 25);
  }

  scheduler() {
    if (!this.ctx) return;
    // Schedule notes ahead by 0.1s to ensure smooth playback without jitter
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
        this.playSequenceStep(this.nextNoteTime);
        this.nextNoteTime += this.tempo;
    }
  }

  playSequenceStep(time: number) {
    if (!this.ctx || !this.bgmGain) return;
    
    const step = this.noteIndex % 32; // 32 step loop (2 bars of 16th notes)

    // CHORD PROGRESSION: C - G - Am - F (Standard Pop/Retro)
    // 8 steps per chord
    let baseFreqs: number[] = []; 
    
    if (step < 8) {
        // C Major (C3, E3, G3, C4)
        baseFreqs = [130.81, 164.81, 196.00, 261.63]; 
    } else if (step < 16) {
        // G Major (G2, B2, D3, G3)
        baseFreqs = [98.00, 123.47, 146.83, 196.00];
    } else if (step < 24) {
        // A Minor (A2, C3, E3, A3)
        baseFreqs = [110.00, 130.81, 164.81, 220.00];
    } else {
        // F Major (F2, A2, C3, F3)
        baseFreqs = [87.31, 110.00, 130.81, 174.61];
    }

    // 1. BASS ARPEGGIO (Square Wave)
    const arpIndex = step % 4; // Cycles through the 4 notes of the chord
    const bassFreq = baseFreqs[arpIndex];

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(bassFreq, time);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (this.tempo * 0.9)); // Short decay (staccato)

    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + this.tempo);

    // 2. LEAD MELODY (Sawtooth, sparse)
    // Play on beat 0, 3, 6, etc to create syncopation, or random flourishes
    const isMelodyNote = (step % 8 === 0) || (step % 8 === 3) || (step % 8 === 6);
    
    if (isMelodyNote) {
        const leadFreq = bassFreq * 4; // 2 octaves up
        const leadOsc = this.ctx.createOscillator();
        leadOsc.type = 'sawtooth';
        leadOsc.frequency.setValueAtTime(leadFreq, time);

        const leadGain = this.ctx.createGain();
        leadGain.gain.setValueAtTime(0.03, time);
        leadGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        // Simple Lowpass filter for retro muffling
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, time);

        leadOsc.connect(filter);
        filter.connect(leadGain);
        leadGain.connect(this.bgmGain);
        
        leadOsc.start(time);
        leadOsc.stop(time + 0.2);
    }

    this.noteIndex++;
  }

  stopMusic() {
    if (this.sequencerTimer) {
        clearInterval(this.sequencerTimer);
        this.sequencerTimer = null;
    }
    if (this.bgmGain) {
        try {
            // Ramp down to avoid click
            if (this.ctx) {
                this.bgmGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            }
            setTimeout(() => {
                this.bgmGain?.disconnect();
                this.bgmGain = null;
            }, 200);
        } catch(e) {
            // Ignore disconnect errors
        }
    }
  }
}

export const audio = new SoundManager();
