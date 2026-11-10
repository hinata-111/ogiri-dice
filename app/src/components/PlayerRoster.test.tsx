import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameView } from './GameView';
import { initialState, type GameState, type Phase } from '../game/state';
import type { MapNode, Topic } from '../game/types';
import map from '../data/map.json';

beforeEach(() => { vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}}); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const topic:Topic={id:'shared',prompt:'こんな東京タワーはいやだ',category:'日常',difficulty:'Easy'};
const result={score:3,comment:'確認用'};
function game(phase:Phase={name:'moving',remaining:3,cameFrom:null}):GameState {
  const players=['たろう','はなこ','ケン','みどり'].map((name,id)=>({id,name,kind:'human' as const,position:'shinjuku',money:(id+1)*100000,arrivals:id}));
  return {...initialState,nodes:map.nodes as MapNode[],players,currentPlayerIndex:1,destinationId:'odaiba',simultaneous:true,
    phase,sharedRound:{topic,entries:players.map(player=>({playerId:player.id,answer:'確認用',submitted:false,result}))}};
}
const props={dispatch:vi.fn(),remaining:30000,cpuAnswer:null};

it.each<Phase>([
  {name:'turnStart'},{name:'roundAnswering'},{name:'roundEvaluating'},{name:'roundResults'},
  {name:'moving',remaining:3,cameFrom:null},{name:'challengeIntro',cellKind:'blue'},
  {name:'awaitingAnswer',topic,context:{kind:'blue'}},{name:'evaluating',topic,answer:'回答',context:{kind:'blue'}},
  {name:'showingResult',topic,answer:'回答',result,context:{kind:'blue'},moneyDelta:90000},
  {name:'arrival',nodeId:'odaiba'},{name:'gameResult'},
])('$nameでも全員の状況を同じ領域に常設する',phase=>{
  render(<GameView state={game(phase)} {...props}/>);
  const roster=screen.getByRole('region',{name:'みんなの状況'});
  const rows=within(roster).getAllByRole('listitem');
  expect(rows).toHaveLength(4);
  ['たろう','はなこ','ケン','みどり'].forEach((name,index)=>{
    expect(rows[index].textContent).toContain(name);
    expect(rows[index].textContent).toContain(`${(index+1)*10}万円`);
    expect(rows[index].textContent).toContain(`到着${index}回`);
  });
  expect(roster.closest('.game-content')).toBeNull();
  expect(screen.queryByRole('button',{name:'みんなの状況'})).toBeNull();
});

it('所持金と手番が変わってもP1からの並びを維持して最新値を表示する',()=>{
  const state=game(),before=JSON.stringify(state);
  const {rerender}=render(<GameView state={state} {...props}/>);
  expect(JSON.stringify(state)).toBe(before);
  const updated={...state,currentPlayerIndex:2,players:state.players.map(player=>player.id===0?{...player,money:700000,arrivals:2}:player)};
  rerender(<GameView state={updated} {...props}/>);
  const rows=within(screen.getByRole('region',{name:'みんなの状況'})).getAllByRole('listitem');
  expect(rows[0].textContent).toContain('たろう');
  expect(rows[0].textContent).toContain('70万円');
  expect(rows[0].textContent).toContain('到着2回');
  expect(rows[2].getAttribute('aria-current')).toBe('true');
  expect(rows[2].textContent).toContain('移動中');
  expect(rows[1].getAttribute('aria-current')).toBeNull();
});

it('共通回答では各人の提出状況を表示し、P1だけを手番表示にしない',()=>{
  const state=game({name:'roundAnswering'});
  state.sharedRound!.entries[0].submitted=true;
  render(<GameView state={state} {...props} online playerId={2} canAct={false}/>);
  const roster=screen.getByRole('region',{name:'みんなの状況'});
  expect(within(roster).getAllByText('回答中')).toHaveLength(3);
  expect(within(roster).getByText('提出済み')).toBeTruthy();
  expect(roster.querySelector('[aria-current="true"]')).toBeNull();
});

it('タイトル画面には対戦中の一覧を表示しない',()=>{
  render(<GameView state={initialState} {...props}/>);
  expect(screen.queryByRole('region',{name:'みんなの状況'})).toBeNull();
});
