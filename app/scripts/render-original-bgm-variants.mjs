/** Auditions derived from the CURRENT score and CURRENT instrument generator.
 * Run with Node 24: node scripts/render-original-bgm-variants.mjs
 * Does not modify game audio. No new melody, samples, or music dependency.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { musicBar } from '../src/audio/score.ts';
import { defaultPreferences } from '../src/audio/events.ts';

const rate = 22050; // The in-game instrument samples use this rate too.
const bars = 16;
const start = .06;
const output = new URL('../dev/audio/previews/2026-09-26-original/', import.meta.url);
const dryRun = process.argv.includes('--dry-run');
if (!dryRun) mkdirSync(output, { recursive: true });
const engineSource = readFileSync(new URL('../src/audio/engine.ts', import.meta.url), 'utf8');
const scoreSource = readFileSync(new URL('../src/audio/score.ts', import.meta.url), 'utf8');
const hash = source => createHash('sha256').update(source).digest('hex');

// Load the existing sampler unchanged, with only its AudioBuffer allocation
// supplied offline. We do not open an audio device or start a game transport.
const compiled = ts.transpileModule(engineSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === './score') return { musicBar };
    if (name === './events') return { defaultPreferences };
    throw new Error(`Unexpected audio dependency: ${name}`);
  },
});
const engine = new exports.AudioEngine();
engine.context = {
  createBuffer(channels, length, sampleRate) {
    assert.equal(channels, 1);
    assert.equal(sampleRate, rate);
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  },
};
assert.equal(typeof engine.sample, 'function');

const softenedSamples = new Map();
function sample(voice, pitch, duration, softened) {
  const original = engine.sample(voice, pitch, duration).getChannelData(0);
  if (!softened) return original;
  const key = `${voice}:${pitch}:${duration.toFixed(2)}`;
  if (softenedSamples.has(key)) return softenedSamples.get(key);
  // Preserve the actual source timbre while rolling off its sharp upper edge.
  const cutoff = { reed: 1850, mallet: 2200, bass: 700, brush: 1200, kick: 1200 }[voice];
  const attack = { reed: .038, mallet: .016, bass: .018, brush: .012, kick: .012 }[voice];
  const alpha = 1 - Math.exp(-2 * Math.PI * cutoff / rate);
  const data = new Float32Array(original.length);
  let first = 0, second = 0;
  for (let i = 0; i < data.length; i++) {
    first += alpha * (original[i] - first);
    second += alpha * (first - second);
    const phase = Math.min(1, i / (rate * attack));
    data[i] = second * phase * phase * (3 - 2 * phase);
  }
  softenedSamples.set(key, data);
  return data;
}

function isMelody(note, scene) {
  return note.voice === (scene === 'menu' ? 'reed' : 'mallet') && note.velocity >= .19;
}

function arrangement(scene, variant) {
  return Array.from({ length: bars }, (_, bar) => musicBar(scene, bar)
    .map((note, index) => ({ ...note, bar, index, melody: isMelody(note, scene) }))
    .filter(note => {
      if (variant !== 'calm' || note.melody) return true;
      if (note.voice === 'kick') return false;
      if (note.voice === 'bass') return note.beat % 2 === 0;
      if (note.voice === 'brush') return Math.floor(note.beat) % 2 === 1;
      return note.voice !== 'mallet' || note.beat < 2;
    })).flat();
}

function render(scene, variant) {
  const bpm = variant === 'calm' ? (scene === 'menu' ? 108 : 96) : (scene === 'menu' ? 116 : 104);
  const beat = 60 / bpm;
  const notes = arrangement(scene, variant);
  const pcm = new Float64Array(Math.ceil((start + bars * 4 * beat + .65) * rate));
  for (const note of notes) {
    const sound = sample(note.voice, note.pitch, note.length * beat, variant !== 'original');
    const when = Math.round((start + (note.bar * 4 + note.beat) * beat + (note.index % 3) * .003) * rate);
    const balance = variant === 'original' || note.melody ? 1 : {
      bass: variant === 'calm' ? .7 : .8,
      mallet: variant === 'calm' ? .75 : .83,
      brush: variant === 'calm' ? .3 : .42,
      kick: .55,
    }[note.voice];
    for (let i = 0; i < sound.length && when + i < pcm.length; i++) {
      pcm[when + i] += sound[i] * note.velocity * balance;
    }
  }
  return { scene, variant, bpm, notes, pcm, activeEnd: Math.round((start + bars * 4 * beat) * rate) };
}

function rms(track) {
  let sum = 0;
  const first = Math.round(start * rate);
  for (let i = first; i < track.activeEnd; i++) sum += track.pcm[i] ** 2;
  return Math.sqrt(sum / (track.activeEnd - first));
}

function melodySignature(track) {
  return track.notes.filter(note => note.melody).map(({ bar, beat, pitch, length, voice, velocity }) => ({ bar, beat, pitch, length, voice, velocity }));
}

function wav(data) {
  const out = Buffer.alloc(44 + data.length * 2);
  out.write('RIFF', 0); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(data.length * 2, 40);
  data.forEach((value, i) => out.writeInt16LE(Math.round(value * 32767), 44 + i * 2));
  return out;
}

const tracks = [];
for (const scene of ['board', 'menu']) {
  const reference = render(scene, 'original');
  const targetRms = rms(reference) * defaultPreferences.music;
  for (const variant of ['original', 'soft', 'calm']) {
    const track = variant === 'original' ? reference : render(scene, variant);
    assert.deepEqual(melodySignature(track), melodySignature(reference), `${scene}/${variant}: melody changed`);
    if (variant === 'soft') assert.deepEqual(track.notes, reference.notes, 'Soft version must preserve every note');
    const gain = targetRms / rms(track);
    let peak = 0;
    for (let i = 0; i < track.pcm.length; i++) {
      track.pcm[i] *= gain;
      assert.ok(Number.isFinite(track.pcm[i]));
      peak = Math.max(peak, Math.abs(track.pcm[i]));
    }
    assert.ok(peak < .85, 'Leave headroom without clipping or limiting');
    assert.ok(Math.abs(track.pcm.at(-1)) < 1e-6, 'Natural ending must reach silence');
    const name = `${scene}-${variant}.wav`;
    const data = wav(track.pcm);
    if (!dryRun) writeFileSync(new URL(name, output), data);
    const written = dryRun ? data : readFileSync(new URL(name, output));
    assert.equal(written.length, written.readUInt32LE(40) + 44);
    assert.equal(written.readUInt32LE(24), rate);
    tracks.push({
      file: name, scene, variant, bpm: track.bpm,
      duration_seconds: Number((track.pcm.length / rate).toFixed(2)),
      melody_unchanged: true, notes: track.notes.length,
      melody_notes: melodySignature(track).length,
      makeup_gain: gain / defaultPreferences.music,
      rms_dbfs: Number((20 * Math.log10(rms(track))).toFixed(2)),
      peak_dbfs: Number((20 * Math.log10(peak)).toFixed(2)),
    });
  }
}
assert.equal(hash(readFileSync(new URL('../src/audio/engine.ts', import.meta.url), 'utf8')), hash(engineSource));
assert.equal(hash(readFileSync(new URL('../src/audio/score.ts', import.meta.url), 'utf8')), hash(scoreSource));
if (!dryRun) writeFileSync(new URL('manifest.json', output), JSON.stringify({
  source: { score_sha256: hash(scoreSource), engine_sha256: hash(engineSource) },
  note: 'Existing score and sampler; offline auditions omit the final compressor, scene ducking, and effects. RMS matched within each scene. Natural ending, not seamless loops.',
  tracks,
}, null, 2) + '\n');
console.log(JSON.stringify({ output: fileURLToPath(output), tracks }, null, 2));
