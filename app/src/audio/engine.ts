import { defaultPreferences, type AudioPreferences, type MusicScene, type SoundCue } from './events';
import { musicBar, type Instrument } from './score';

// Approved board-soft.wav profile. Preserve the original score and 104 BPM.
// The makeup gain matches the audition's RMS at the existing volume setting.
const BOARD_SOFT_MAKEUP = 1.3069002740231315;
const BOARD_SOFT_BALANCE: Record<Instrument, number> = { reed: 1, mallet: .83, bass: .8, brush: .42, kick: .55 };
const BOARD_SOFT_TONE: Record<Instrument, { cutoff: number; attack: number }> = {
  reed: { cutoff: 1850, attack: .038 }, mallet: { cutoff: 2200, attack: .016 },
  bass: { cutoff: 700, attack: .018 }, brush: { cutoff: 1200, attack: .012 }, kick: { cutoff: 1200, attack: .012 },
};

// One transport, two buses. Sources are tracked so mute, scene switches and
// hidden tabs stop both playing and already-scheduled notes.
export class AudioEngine {
  private context: AudioContext | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private sources = new Map<AudioBufferSourceNode, 'music' | 'effects'>();
  private samples = new Map<string, AudioBuffer>();
  private preferences = defaultPreferences;
  private scene: MusicScene = 'menu';
  private hidden = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private bar = 0;
  private nextBar = 0;
  private duckUntil = 0;

  async unlock() {
    try {
      if (!this.context) {
        if (typeof AudioContext === 'undefined') return;
        this.context = new AudioContext();
        this.music = this.context.createGain(); this.effects = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -12; limiter.knee.value = 14; limiter.ratio.value = 6;
        this.music.connect(limiter); this.effects.connect(limiter); limiter.connect(this.context.destination);
      }
      if (this.hidden) return;
      if (this.context.state === 'suspended') await this.context.resume();
      this.updateVolumes();
      if (!this.timer) { this.nextBar = this.context.currentTime + .06; this.schedule(); this.timer = setInterval(() => this.schedule(), 100); }
    } catch { /* Audio support must never prevent play. */ }
  }
  setPreferences(preferences: AudioPreferences) {
    this.preferences = preferences;
    this.updateVolumes();
    if (preferences.muted) this.stopSources();
  }
  setScene(scene: MusicScene) {
    if (scene === this.scene) return;
    const oldTrack = this.scene === 'menu' ? 'menu' : 'board';
    this.scene = scene;
    if (scene === 'menu') { this.stopSources('effects'); this.duckUntil = 0; }
    if (oldTrack !== (scene === 'menu' ? 'menu' : 'board')) {
      this.stopSources('music'); this.bar = 0; this.nextBar = (this.context?.currentTime ?? 0) + .08;
    }
    this.updateVolumes();
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) {
      this.stopSources(); clearInterval(this.timer); this.timer = undefined;
      void this.context?.suspend().catch(() => {});
    } else if (this.context) void this.unlock();
  }
  dispose() {
    clearInterval(this.timer); this.timer = undefined; this.stopSources();
    void this.context?.close().catch(() => {}); this.context = null; this.samples.clear();
  }
  private updateVolumes() {
    const ctx = this.context;
    if (!ctx || !this.music || !this.effects) return;
    const quiet = this.scene === 'thinking' ? .25 : this.scene === 'results' ? .45 : 1;
    const duck = ctx.currentTime < this.duckUntil ? .18 : 1;
    this.music.gain.setTargetAtTime(this.preferences.muted ? 0 : this.preferences.music * quiet * duck, ctx.currentTime, .08);
    this.effects.gain.setTargetAtTime(this.preferences.muted ? 0 : this.preferences.effects, ctx.currentTime, .015);
  }
  private stopSources(bus?: 'music' | 'effects') {
    for (const [source, kind] of this.sources) if (!bus || bus === kind) { try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); this.sources.delete(source); }
  }
  private sample(voice: Instrument, pitch: number, duration: number, softBoard = false) {
    const ctx = this.context!;
    const key = `${softBoard ? 'board-soft' : 'original'}:${voice}:${pitch}:${duration.toFixed(2)}`;
    const cached = this.samples.get(key); if (cached) return cached;
    const rate = 22050, length = Math.ceil((duration + .15) * rate), buffer = ctx.createBuffer(1, length, rate), data = buffer.getChannelData(0);
    const hz = 440 * 2 ** ((pitch - 69) / 12);
    let seed = 7231, previous = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate, phase = 2 * Math.PI * hz * t;
      const release = Math.max(0, Math.min(1, (duration + .12 - t) / .12));
      const attack = Math.min(1, t / (voice === 'reed' ? .025 : .005));
      let value = 0;
      if (voice === 'brush') { seed = (seed * 16807) % 2147483647; const noise = seed / 1073741824 - 1; value = (noise - previous) * Math.exp(-t * 35); previous = noise; }
      else if (voice === 'kick') value = Math.sin(2 * Math.PI * (48 * t + 1.8 * (1 - Math.exp(-t * 30)))) * Math.exp(-t * 20);
      else if (voice === 'bass') value = (Math.sin(phase) + .22 * Math.sin(phase * 2)) * Math.exp(-t * 4);
      else if (voice === 'mallet') value = (Math.sin(phase) * Math.exp(-t * 4) + .35 * Math.sin(phase * 3) * Math.exp(-t * 12) + .13 * Math.sin(phase * 7) * Math.exp(-t * 22)) * .7;
      else value = (Math.sin(phase + .012 * Math.sin(t * 31)) + .3 * Math.sin(phase * 3) + .09 * Math.sin(phase * 5)) * .65 * (1 - .2 * t / (duration + .15));
      data[i] = value * attack * release;
    }
    if (softBoard) {
      const { cutoff, attack } = BOARD_SOFT_TONE[voice];
      const alpha = 1 - Math.exp(-2 * Math.PI * cutoff / rate);
      let first = 0, second = 0;
      for (let i = 0; i < length; i++) {
        first += alpha * (data[i] - first);
        second += alpha * (first - second);
        const phase = Math.min(1, i / (rate * attack));
        data[i] = second * phase * phase * (3 - 2 * phase);
      }
    }
    // Bound memory even during long games with many different scores.
    if (this.samples.size > 240) this.samples.clear();
    this.samples.set(key, buffer); return buffer;
  }
  private note(voice: Instrument, pitch: number, when: number, duration: number, volume: number, bus: 'music' | 'effects', softBoard = false) {
    const ctx = this.context; if (!ctx) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = this.sample(voice, pitch, duration, softBoard); gain.gain.value = volume;
    source.connect(gain); gain.connect(bus === 'music' ? this.music! : this.effects!);
    this.sources.set(source, bus);
    source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(when);
  }
  private schedule() {
    const ctx = this.context;
    if (!ctx || this.hidden || ctx.state !== 'running') return;
    this.updateVolumes();
    if (this.nextBar < ctx.currentTime) this.nextBar = ctx.currentTime + .04;
    if (this.nextBar > ctx.currentTime + .25) return;
    const track = this.scene === 'menu' ? 'menu' : 'board', beat = 60 / (track === 'menu' ? 116 : 104);
    if (!this.preferences.muted && this.preferences.music > 0) {
      for (const [i,note] of musicBar(track, this.bar).entries()) {
        const touch = (i % 3) * .003;
        const softBoard = track === 'board';
        const balance = note.voice === 'mallet' && note.velocity >= .19 ? 1 : BOARD_SOFT_BALANCE[note.voice];
        const volume = note.velocity * (softBoard ? balance * BOARD_SOFT_MAKEUP : 1);
        this.note(note.voice, note.pitch, this.nextBar + note.beat * beat + touch, note.length * beat, volume, 'music', softBoard);
      }
    }
    this.bar++; this.nextBar += beat * 4;
  }
  play(cue: SoundCue, score = 3) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.hidden || this.preferences.muted || !this.preferences.effects) return;
    const at = ctx.currentTime + .008;
    const line = (pitches: number[], spacing: number, voice: Instrument = 'mallet', volume = .25) => pitches.forEach((pitch,i) => this.note(voice,pitch,at+i*spacing,spacing*1.65,volume,'effects'));
    if (cue === 'select') line([79],.045,'mallet',.16);
    if (cue === 'confirm') line([72,79],.075);
    if (cue === 'step') { this.note('brush',0,at,.08,.12,'effects'); line([62],.065,'mallet',.16); }
    if (cue === 'tick') line([79],.035,'mallet',.12);
    if (cue === 'topic') line([67,72,76],.085,'mallet',.2);
    if (cue === 'depart') line([72,76,79,84],.095,'reed',.16);
    if (cue === 'gain') line([72,76,81,84],.085);
    if (cue === 'loss') line([70,66,62],.16,'reed',.17);
    if (cue === 'roll') for (let i=0;i<8;i++) this.note('brush',0,at+i*.065,.08,.08+i*.012,'effects');
    if (cue === 'score') line(score >= 5 ? [72,76,79,84] : score >= 3 ? [72,76,79] : [64,67],.09);
    if (cue === 'arrival' || cue === 'victory') {
      this.duckUntil = at + (cue === 'victory' ? 3.1 : 2); this.updateVolumes();
      const melody = cue === 'victory' ? [72,72,72,79,76,79,84,83,84] : [72,76,79,76,84,84];
      line(melody, .18,'reed',.26);
      [48,60,64,67].forEach(pitch => this.note('mallet',pitch,at,.95,.17,'effects'));
      [48,60,64,72].forEach(pitch => this.note('mallet',pitch,at+melody.length*.18,1.1,.2,'effects'));
    }
  }
}
