/// <reference types="node" />
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine';

class CapturedGain {
  output: CapturedGain | object | null = null;
  gain = { value: 1, setTargetAtTime: (value: number) => { this.gain.value = value; } };
  connect(output: CapturedGain | object) { this.output = output; }
  disconnect() {}
}
class CapturedBuffer {
  data: Float32Array;
  constructor(length: number) { this.data = new Float32Array(length); }
  getChannelData() { return this.data; }
}
class CapturedSource {
  buffer: CapturedBuffer | null = null;
  output: CapturedGain | null = null;
  when = 0;
  stopped = false;
  onended: (() => void) | null = null;
  connect(output: CapturedGain) { this.output = output; }
  start(when: number) { this.when = when; }
  stop() { this.stopped = true; }
  disconnect() {}
}
class CapturedContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  sources: CapturedSource[] = [];
  createGain() { return new CapturedGain(); }
  createDynamicsCompressor() {
    return { threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, connect() {} };
  }
  createBuffer(_channels: number, length: number) { return new CapturedBuffer(length); }
  createBufferSource() { const source = new CapturedSource(); this.sources.push(source); return source; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}

let context: CapturedContext;
beforeEach(() => {
  vi.useFakeTimers();
  context = new CapturedContext();
  vi.stubGlobal('AudioContext', function () { return context; });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each([
  { scene: 'board' as const, bpm: 104, file: 'board-soft.wav', noteCount: 331 },
  { scene: 'menu' as const, bpm: 116, file: 'menu-original.wav', noteCount: 350 },
])('renders $scene like its approved reference and repeats on the musical boundary', async ({ scene, bpm, file, noteCount }) => {
  const audio = new AudioEngine();
  audio.setScene(scene);
  await audio.unlock();
  const firstBar = context.sources.slice();
  const barDuration = 4 * 60 / bpm;
  for (let bar = 1; bar < 16; bar++) {
    context.currentTime = bar * barDuration;
    vi.advanceTimersByTime(100);
  }
  expect(context.sources).toHaveLength(noteCount);

  // Compare the actual scheduled samples, timings and gains to the audition
  // selected by the user. Both are before the final browser compressor.
  const reference = readFileSync(resolve('dev/audio/previews/2026-09-26-original', file));
  expect(reference.toString('ascii', 0, 4)).toBe('RIFF');
  const rate = reference.readUInt32LE(24);
  const rendered = new Float64Array(reference.readUInt32LE(40) / 2);
  for (const source of context.sources) {
    const data = source.buffer!.data;
    const gain = source.output!;
    const volume = gain.gain.value * (gain.output as CapturedGain).gain.value;
    const offset = Math.round(source.when * rate);
    for (let i = 0; i < data.length && offset + i < rendered.length; i++) rendered[offset + i] += data[i] * volume;
  }
  let maxDifference = 0;
  for (let i = 0; i < rendered.length; i++) {
    const expected = reference.readInt16LE(44 + i * 2) / 32767;
    maxDifference = Math.max(maxDifference, Math.abs(rendered[i] - expected));
  }
  expect(maxDifference).toBeLessThanOrEqual(1 / 32767);

  context.currentTime = 16 * barDuration;
  vi.advanceTimersByTime(100);
  const repeat = context.sources.slice(noteCount);
  expect(repeat).toHaveLength(firstBar.length);
  repeat.forEach((source, index) => {
    expect(source.when - firstBar[index].when).toBeCloseTo(16 * barDuration, 9);
    expect(source.buffer).toBe(firstBar[index].buffer);
    expect(source.output!.gain.value).toBe(firstBar[index].output!.gain.value);
  });
  audio.dispose();
});

it('keeps effect samples separate and preserves volume changes through thinking and results', async () => {
  const audio = new AudioEngine();
  await audio.unlock();
  const musicBus = context.sources[0].output!.output as CapturedGain;
  audio.play('select');
  const menuEffect = context.sources.at(-1)!;
  audio.setScene('board');
  vi.advanceTimersByTime(100);
  const boardNotes = context.sources.filter(source => !source.stopped && source.output!.output === musicBus);
  audio.play('select');
  const boardEffect = context.sources.at(-1)!;
  expect(boardEffect.buffer).toBe(menuEffect.buffer);
  expect(boardEffect.output!.gain.value).toBe(.16);
  audio.setScene('thinking');
  expect(boardNotes.every(source => !source.stopped)).toBe(true);
  expect(musicBus.gain.value).toBeCloseTo(.35 * .25);
  audio.setScene('results');
  expect(musicBus.gain.value).toBeCloseTo(.35 * .45);
  audio.setScene('board');
  expect(musicBus.gain.value).toBe(.35);
  audio.dispose();
});
