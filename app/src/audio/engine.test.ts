import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine';
const sources: Array<{stopped:boolean;stop:()=>void;disconnect:()=>void;start:()=>void}> = [];
class FakeAudioContext {
  currentTime=0; state='running'; destination={};
  createGain(){return {gain:{value:1,setTargetAtTime:vi.fn()},connect:vi.fn()};}
  createDynamicsCompressor(){return {threshold:{value:0},knee:{value:0},ratio:{value:0},connect:vi.fn()};}
  createBuffer(_channels:number,length:number){return {getChannelData:()=>new Float32Array(length)};}
  createBufferSource(){const source={stopped:false,stop(){this.stopped=true;},disconnect:vi.fn(),connect:vi.fn(),start:vi.fn()};sources.push(source);return source;}
  async resume(){this.state='running';} async suspend(){this.state='suspended';} async close(){this.state='closed';}
}
beforeEach(()=>{vi.useFakeTimers();sources.length=0;vi.stubGlobal('AudioContext',FakeAudioContext)});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});
it('cancels scheduled fanfare notes on return to the menu',async()=>{
  const audio=new AudioEngine();audio.setScene('board');await audio.unlock();
  audio.play('victory'); const before=sources.slice(); audio.setScene('menu');
  expect(before.every(source=>source.stopped)).toBe(true);audio.dispose();
});
it('stops all queued notes while hidden and creates only one transport on repeated unlock',async()=>{
  const audio=new AudioEngine();await audio.unlock();await audio.unlock();expect(vi.getTimerCount()).toBe(1);
  audio.play('arrival');audio.setHidden(true);expect(sources.every(source=>source.stopped)).toBe(true);expect(vi.getTimerCount()).toBe(0);
  audio.setHidden(false);await Promise.resolve();expect(vi.getTimerCount()).toBe(1);audio.dispose();expect(vi.getTimerCount()).toBe(0);
});
it('silences queued music and effects immediately and does not schedule while muted',async()=>{
  const audio=new AudioEngine();await audio.unlock();audio.play('arrival');
  audio.setPreferences({music:.35,effects:.65,muted:true});
  expect(sources.every(source=>source.stopped)).toBe(true);
  const count=sources.length;audio.play('victory');vi.advanceTimersByTime(4000);
  expect(sources.length).toBe(count);
  audio.setPreferences({music:.35,effects:.65,muted:false});audio.play('confirm');
  expect(sources.length).toBeGreaterThan(count);audio.dispose();
});
