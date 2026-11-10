// Tiny WebAudio synth for sound effects (no audio files needed, works offline).
export class Sfx {
  constructor() { this.ctx = null; }
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC();
        this.out = this.ctx.createGain(); this.out.gain.value = 0.5; this.out.connect(this.ctx.destination);
        const n = this.ctx.sampleRate, b = this.ctx.createBuffer(1, n, n), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = b;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.ctx = null; }
  }
  tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(f0, f1, dur, vol = 0.3, q = 1, delay = 0, type = 'bandpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t); s.stop(t + dur + 0.05);
  }
  dash() { this.noise(400, 3200, 0.3, 0.35, 0.8); this.tone('sawtooth', 180, 720, 0.25, 0.08); }
  slash() { this.noise(5000, 700, 0.16, 0.4, 1.2); this.tone('square', 1300, 300, 0.1, 0.07); }
  hit() { this.noise(900, 120, 0.2, 0.5, 0.7, 0, 'lowpass'); this.tone('sine', 160, 45, 0.22, 0.5); }
  crit() { this.hit(); this.tone('triangle', 1400, 2800, 0.25, 0.25); this.tone('triangle', 2100, 4200, 0.3, 0.18, 0.06); }
  roar() { this.tone('sawtooth', 110, 48, 0.9, 0.3); this.tone('sawtooth', 163, 60, 0.9, 0.2); this.noise(500, 150, 0.9, 0.3, 0.5); }
  fire() { this.noise(250, 1800, 0.5, 0.45, 0.4); }
  guard(perfect) { this.tone('square', perfect ? 2400 : 1500, perfect ? 1800 : 700, 0.2, 0.18); this.noise(6000, 2500, 0.2, 0.35, 3); if (perfect) this.tone('triangle', 3200, 3200, 0.5, 0.15, 0.05); }
  hurt() { this.hit(); this.tone('sawtooth', 300, 80, 0.3, 0.2); }
  warn() { this.tone('square', 880, 880, 0.07, 0.12); }
  ui() { this.tone('triangle', 660, 990, 0.12, 0.2); }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.32, 0.25, i * 0.11)); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, 0.45, 0.14, i * 0.22)); }
  count() { this.tone('sine', 740, 740, 0.1, 0.2); }
}
