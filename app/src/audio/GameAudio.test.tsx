import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initialState, type GameState } from '../game/state';
import { GameAudio } from './GameAudio';
const { play, setScene } = vi.hoisted(() => ({play:vi.fn(),setScene:vi.fn()}));
vi.mock('./context',()=>({useAudio:()=>({play,setScene})}));
const judging: GameState = {...initialState,phase:{name:'evaluating',topic:{id:'x',prompt:'お題',category:'日常',difficulty:'Easy'},context:{kind:'main'},answer:'回答'}};
const result: GameState = {...judging,phase:{name:'showingResult',topic:{id:'x',prompt:'お題',category:'日常',difficulty:'Easy'},context:{kind:'main'},answer:'回答',result:{score:6,comment:'お見事'},moneyDelta:0}};
beforeEach(()=>{vi.useFakeTimers();play.mockClear()});
afterEach(()=>{cleanup();vi.useRealTimers()});
it('plays a score only at reveal, despite connection-only snapshots',()=>{
  const {rerender}=render(<StrictMode><GameAudio state={judging} remaining={0}/></StrictMode>);
  rerender(<StrictMode><GameAudio state={result} remaining={0}/></StrictMode>);
  expect(play.mock.calls).toEqual([['roll']]);
  act(()=>vi.advanceTimersByTime(400));
  rerender(<StrictMode><GameAudio state={structuredClone(result)} remaining={0}/></StrictMode>);
  act(()=>vi.advanceTimersByTime(200));
  expect(play.mock.calls).toEqual([['roll'],['score',6]]);
});
it('cancels the reveal on disconnect and does not replay an old result on resume',()=>{
  const {rerender}=render(<GameAudio state={judging} remaining={0}/>);
  rerender(<GameAudio state={result} remaining={0}/>);
  rerender(<GameAudio state={result} remaining={0} connected={false}/>);
  act(()=>vi.advanceTimersByTime(700));
  rerender(<GameAudio state={structuredClone(result)} remaining={0}/>);
  act(()=>vi.advanceTimersByTime(700));
  expect(play.mock.calls).toEqual([['roll']]);
});
it('does not play an old result when mounting into a reconnect snapshot',()=>{
  render(<GameAudio state={result} remaining={0}/>);
  act(()=>vi.advanceTimersByTime(700));
  expect(play).not.toHaveBeenCalled();
});
it('clears delayed sounds when the game leaves the screen',()=>{
  const {rerender,unmount}=render(<GameAudio state={judging} remaining={0}/>);
  rerender(<GameAudio state={result} remaining={0}/>); unmount();
  act(()=>vi.advanceTimersByTime(700));
  expect(play.mock.calls).toEqual([['roll']]);
});

it('uses thinking music and countdown cues for common answers without replaying on submission updates', () => {
  const state: GameState = { ...initialState, phase: { name: 'roundAnswering' } };
  const { rerender } = render(<GameAudio state={state} remaining={6000}/>);
  expect(setScene).toHaveBeenLastCalledWith('thinking');
  rerender(<GameAudio state={state} remaining={5000}/>);
  expect(play.mock.calls).toEqual([['tick']]);
  rerender(<GameAudio state={structuredClone(state)} remaining={4900}/>);
  expect(play.mock.calls).toEqual([['tick']]);
});
