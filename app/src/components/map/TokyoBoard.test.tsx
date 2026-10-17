import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TokyoBoard } from './TokyoBoard';
import { gameReducer, initialState, type GameState } from '../../game/state';
import { buildNodeMap, moveOptions } from '../../game/graph';
import data from '../../data/map.json';
import type { MapNode } from '../../game/types';
import { useMapCamera } from './useMapCamera';
import { buildArtLayout } from './art-layout';

const nodes = data.nodes as MapNode[];
const stateAt = (position = 'shinjuku', cameFrom: string | null = null): GameState => ({
  ...initialState, nodes, destinationId: 'odaiba',
  players: [{ id: 0, name: 'プレイヤー1', kind: 'human', position, money: 100000, arrivals: 0 }],
  phase: { name: 'moving', remaining: 4, cameFrom },
});
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('縦画面の各マスで追従復帰しても小数誤差による再描画ループを起こさない', () => {
  const layout=buildArtLayout(nodes);
  const {result,rerender}=renderHook(({point})=>useMapCamera({width:390,height:796},point,0),{initialProps:{point:layout.points.get('nakano')!}});
  for(const node of nodes){
    rerender({point:layout.points.get(node.id)!});
    act(()=>result.current.follow());
    expect(Number.isFinite(result.current.x)).toBe(true);
    expect(Number.isFinite(result.current.y)).toBe(true);
  }
});
const camera = () => document.querySelector<HTMLElement>('.tokyo-camera')!;
const viewport = () => screen.getByRole('region', { name: /東京マップ/ });
const moveCell = (id: string) => document.querySelector<HTMLButtonElement>(`[data-node-id="${id}"].tokyo-cell-move`)!;

it('ゴールアーチは現在の目的地だけに現れ、切り替え・解除・ゲーム終了で元の地名に戻る', () => {
  const state = stateAt();
  const onStep = vi.fn();
  const { rerender } = render(<TokyoBoard state={state} onStep={onStep} />);
  expect(screen.getByRole('img', { name: 'お台場：今回のゴール' })).toBeTruthy();
  expect(screen.getAllByRole('img', { name: /今回のゴール/ })).toHaveLength(1);
  expect([...document.querySelectorAll('.tokyo-label')].some(label => label.textContent === 'お台場')).toBe(false);

  rerender(<TokyoBoard state={{ ...state, destinationId: 'asakusa' }} onStep={onStep} />);
  expect(screen.queryByRole('img', { name: 'お台場：今回のゴール' })).toBeNull();
  expect(screen.getByRole('img', { name: '浅草：今回のゴール' })).toBeTruthy();
  expect([...document.querySelectorAll('.tokyo-label')].some(label => label.textContent === 'お台場')).toBe(true);

  for (const next of [{ ...state, destinationId: null }, { ...state, phase: { name: 'gameResult' as const } }]) {
    rerender(<TokyoBoard state={next} onStep={onStep} />);
    expect(screen.queryByRole('img', { name: /今回のゴール/ })).toBeNull();
    expect([...document.querySelectorAll('.tokyo-label')].some(label => label.textContent === 'お台場')).toBe(true);
  }
  expect(onStep).not.toHaveBeenCalled();
});

it.each([{width:1280,height:672},{width:390,height:796},{width:844,height:342}])('縮小・端までの移動・画面回転でもマップ外の余白を出さない: %j', size => {
  const {result,rerender}=renderHook(({size})=>useMapCamera(size,[37,47],0),{initialProps:{size}});
  const covers=()=>{
    const c=result.current;
    expect(c.x).toBeLessThanOrEqual(0);
    expect(c.y).toBeLessThanOrEqual(0);
    expect(c.x+c.width).toBeGreaterThanOrEqual(size.width-.01);
    expect(c.y+c.height).toBeGreaterThanOrEqual(size.height-.01);
  };
  expect(result.current.width).toBeLessThan(Math.max(size.width,size.height*16/9)*1.1);
  covers();
  act(()=>result.current.overview());
  covers();
  for(let i=0;i<15;i++)act(()=>result.current.zoomOut());
  covers();
  expect(result.current.canZoomOut).toBe(false);
  act(()=>result.current.zoomIn());
  for(const key of ['ArrowLeft','ArrowUp','ArrowRight','ArrowDown']){
    for(let i=0;i<30;i++)act(()=>result.current.bindings.onKeyDown({key,target:null,currentTarget:null,preventDefault(){}} as unknown as React.KeyboardEvent<HTMLDivElement>));
    covers();
  }
  size={width:size.height,height:size.width};
  rerender({size});
  covers();
});

it('見回し中はコマと手番の更新で表示位置を変えず、現在地へ戻ると追従する', () => {
  const { rerender } = render(<TokyoBoard state={stateAt()} onStep={() => {}} />);
  const before = camera().style.transform;
  fireEvent.pointerDown(viewport(), { pointerId: 1, clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerMove(viewport(), { pointerId: 1, clientX: 120, clientY: 210 });
  fireEvent.pointerUp(viewport(), { pointerId: 1 });
  const panned = camera().style.transform;
  expect(panned).not.toBe(before);
  rerender(<TokyoBoard state={stateAt('asakusa')} onStep={() => {}} />);
  expect(camera().style.transform).toBe(panned);
  fireEvent.click(screen.getByRole('button', { name: '現在地へ戻る' }));
  expect(camera().style.transform).not.toBe(panned);
});

it('全体表示・目的地表示・ズームでは移動を発行しない', () => {
  const onStep = vi.fn();
  render(<TokyoBoard state={stateAt()} onStep={onStep} />);
  fireEvent.click(screen.getByRole('button', { name: '広く見る' }));
  const fit = parseFloat(camera().style.width);
  fireEvent.click(screen.getByRole('button', { name: '地図を拡大' }));
  expect(parseFloat(camera().style.width)).toBeGreaterThan(fit);
  fireEvent.click(screen.getByRole('button', { name: /目的地.*お台場/ }));
  expect(onStep).not.toHaveBeenCalled();
});

it('一本道の隣接マスそのものを1回押すと1歩進み、同じ状態では重複送信しない', () => {
  const node = nodes.find(n => n.neighbors.length === 2)!;
  const state = stateAt(node.id, node.neighbors[0]);
  const onStep = vi.fn();
  render(<TokyoBoard state={state} onStep={onStep} />);
  expect(screen.getAllByRole('button', { name: /へ進む$/ })).toHaveLength(1);
  fireEvent.click(moveCell(node.neighbors[1]));
  fireEvent.click(moveCell(node.neighbors[1]));
  expect(onStep).toHaveBeenCalledExactlyOnceWith(node.neighbors[1]);
});

it('分岐も実マスの位置を直接タップして進み、別の選択・決定ボタンは出さない', () => {
  const onStep = vi.fn();
  render(<TokyoBoard state={stateAt()} onStep={onStep} />);
  const options = nodes.find(n => n.id === 'shinjuku')!.neighbors;
  expect(screen.getAllByRole('button', { name: /へ進む$/ })).toHaveLength(options.length);
  expect(screen.queryByRole('button', { name: /決定|1マス進む|^[A-Z] .*を選ぶ$/ })).toBeNull();
  expect(screen.queryByLabelText('進路の比較')).toBeNull();
  const id = options[1], cell = moveCell(id), point = buildArtLayout(nodes).points.get(id)!;
  expect(cell.style.left).toBe(`${point[0]}%`);
  expect(cell.style.top).toBe(`${point[1]}%`);
  fireEvent.pointerDown(cell, { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerUp(cell, { pointerId: 1, pointerType: 'touch' });
  fireEvent.click(cell, { detail: 1 });
  expect(onStep).toHaveBeenCalledExactlyOnceWith(id);
});

it('移動後は新しい隣接候補へ切り替わり、来た道と現在地を押しても移動しない', () => {
  let state = stateAt();
  const onStep = vi.fn();
  const { rerender } = render(<TokyoBoard state={state} onStep={onStep} />);
  const first = nodes.find(n => n.id === 'shinjuku')!.neighbors[0];
  fireEvent.click(moveCell(first));
  state = gameReducer(state, { type: 'STEP_TO', nodeId: first });
  rerender(<TokyoBoard state={state} onStep={onStep} />);
  expect(moveCell('shinjuku')).toBeNull();
  expect(moveCell(first)).toBeNull();
  fireEvent.click(document.querySelector(`[data-node-id="shinjuku"]`)!);
  fireEvent.click(document.querySelector(`[data-node-id="${first}"]`)!);
  expect(onStep).toHaveBeenCalledOnce();
  const options = moveOptions(buildNodeMap(nodes), first, 'shinjuku');
  fireEvent.click(moveCell(options[0]));
  expect(onStep).toHaveBeenLastCalledWith(options[0]);
  expect(onStep).toHaveBeenCalledTimes(2);
});

it.each(['spectator', 'cpu', 'notMoving'] as const)('%sはマスを押しても移動できない', mode => {
  const state = stateAt();
  if (mode === 'cpu') state.players[0].kind = 'cpu';
  if (mode === 'notMoving') state.phase = { name: 'turnStart' };
  const onStep = vi.fn();
  render(<TokyoBoard state={state} onStep={onStep} canAct={mode !== 'spectator'} />);
  expect(screen.queryAllByRole('button', { name: /へ進む$/ })).toHaveLength(0);
  fireEvent.click(document.querySelector(`[data-node-id="${nodes.find(n => n.id === 'shinjuku')!.neighbors[0]}"]`)!);
  expect(onStep).not.toHaveBeenCalled();
});

it('送信中の操作制限後も新しい状態なら隣接マスを押せる', () => {
  const state = stateAt(), onStep = vi.fn();
  const { rerender } = render(<TokyoBoard state={state} onStep={onStep} />);
  const id = nodes.find(n => n.id === 'shinjuku')!.neighbors[0];
  fireEvent.click(moveCell(id));
  rerender(<TokyoBoard state={state} onStep={onStep} canAct={false} />);
  expect(screen.queryAllByRole('button', { name: /へ進む$/ })).toHaveLength(0);
  rerender(<TokyoBoard state={state} onStep={onStep} />);
  fireEvent.click(moveCell(id));
  expect(onStep).toHaveBeenCalledTimes(2);
});

it('ドラッグ後のクリックは移動せず、見回し中も次のタップで実マスへ進める', () => {
  const onStep = vi.fn();
  render(<TokyoBoard state={stateAt()} onStep={onStep} />);
  const id = nodes.find(n => n.id === 'shinjuku')!.neighbors[0];
  const choice = moveCell(id);
  fireEvent.pointerDown(choice, { pointerId: 1, clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerMove(viewport(), { pointerId: 1, clientX: 220, clientY: 200 });
  fireEvent.pointerUp(viewport(), { pointerId: 1 });
  fireEvent.click(choice, { detail: 1 });
  expect(onStep).not.toHaveBeenCalled();
  const returnedChoice = moveCell(id);
  fireEvent.pointerDown(returnedChoice, { pointerId: 1, clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerUp(returnedChoice, { pointerId: 1 });
  fireEvent.click(returnedChoice);
  expect(onStep).toHaveBeenCalledExactlyOnceWith(id);
});

it('拡大・広く見る・目的地表示でも合法な隣接マスを直接押せる', () => {
  const state = stateAt(), onStep = vi.fn();
  render(<TokyoBoard state={state} onStep={onStep} />);
  fireEvent.click(screen.getByRole('button', { name: '広く見る' }));
  fireEvent.click(screen.getByRole('button', { name: '地図を拡大' }));
  fireEvent.click(screen.getByRole('button', { name: /目的地.*お台場/ }));
  const id = nodes.find(n => n.id === 'shinjuku')!.neighbors[0];
  fireEvent.click(moveCell(id));
  expect(onStep).toHaveBeenCalledExactlyOnceWith(id);
});

it('マスのEnter・Space長押しとダブルクリックの2回目は追加移動しない', () => {
  const state = stateAt(), onStep = vi.fn();
  render(<TokyoBoard state={state} onStep={onStep} />);
  const id = nodes.find(n => n.id === 'shinjuku')!.neighbors[0];
  const cell = moveCell(id);
  for (const key of ['Enter', ' ']) expect(fireEvent.keyDown(cell, { key, repeat: true })).toBe(false);
  fireEvent.click(cell, { detail: 2 });
  expect(onStep).not.toHaveBeenCalled();
  expect(fireEvent.keyDown(cell, { key: 'Enter', repeat: false })).toBe(true);
  fireEvent.click(cell, { detail: 0 });
  expect(onStep).toHaveBeenCalledExactlyOnceWith(id);
});

it('ピンチ後に発生するクリックではマスへ移動しない', () => {
  const onStep = vi.fn();
  render(<TokyoBoard state={stateAt()} onStep={onStep} />);
  const cell = moveCell(nodes.find(n => n.id === 'shinjuku')!.neighbors[0]);
  fireEvent.pointerDown(cell, { pointerId: 1, clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerDown(viewport(), { pointerId: 2, clientX: 500, clientY: 200, button: 0 });
  fireEvent.pointerMove(viewport(), { pointerId: 2, clientX: 650, clientY: 200 });
  fireEvent.pointerUp(viewport(), { pointerId: 2 });
  fireEvent.pointerUp(cell, { pointerId: 1 });
  fireEvent.click(cell, { detail: 1 });
  expect(onStep).not.toHaveBeenCalled();
});

it('ピンチで拡大し、片指に戻った後もドラッグできる', () => {
  render(<TokyoBoard state={stateAt()} onStep={() => {}} />);
  const initialWidth = parseFloat(camera().style.width);
  fireEvent.pointerDown(viewport(), { pointerId: 1, clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerDown(viewport(), { pointerId: 2, clientX: 500, clientY: 200, button: 0 });
  fireEvent.pointerMove(viewport(), { pointerId: 2, clientX: 650, clientY: 200 });
  expect(parseFloat(camera().style.width)).toBeGreaterThan(initialWidth);
  fireEvent.pointerUp(viewport(), { pointerId: 2 });
  const pinched = camera().style.transform;
  fireEvent.pointerMove(viewport(), { pointerId: 1, clientX: 200, clientY: 200 });
  expect(camera().style.transform).not.toBe(pinched);
  fireEvent.pointerCancel(viewport(), { pointerId: 1 });
  expect(document.querySelector('.is-dragging')).toBeNull();
});

it('ホイールはページへ伝播せず、拡大縮小の上限下限で止まる', () => {
  render(<TokyoBoard state={stateAt()} onStep={() => {}} />);
  const initialWidth = parseFloat(camera().style.width);
  expect(fireEvent.wheel(viewport(), { deltaY: -100, clientX: 400, clientY: 200 })).toBe(false);
  expect(parseFloat(camera().style.width)).toBeGreaterThan(initialWidth);
  for (let i=0; i<20; i++) fireEvent.click(screen.getByRole('button', { name: '地図を拡大' }));
  expect((screen.getByRole('button', { name: '地図を拡大' }) as HTMLButtonElement).disabled).toBe(true);
  for (let i=0; i<30; i++) fireEvent.click(screen.getByRole('button', { name: '地図を縮小' }));
  expect((screen.getByRole('button', { name: '地図を縮小' }) as HTMLButtonElement).disabled).toBe(true);
});

it('遠いマスの情報を見る操作と矢印キーはコマを動かさない', () => {
  const onStep=vi.fn();
  render(<TokyoBoard state={stateAt()} onStep={onStep} />);
  fireEvent.click(screen.getByRole('button', { name: '広く見る' }));
  fireEvent.click(screen.getByRole('button', { name: 'お台場のマス情報' }));
  expect(screen.getByRole('region', { name: 'マスの情報' }).textContent).toContain('現在地から最短');
  fireEvent.keyDown(viewport(), { key: '+' });
  const before=camera().style.transform;
  fireEvent.keyDown(viewport(), { key: 'ArrowDown' });
  expect(camera().style.transform).not.toBe(before);
  expect(onStep).not.toHaveBeenCalled();
});

it('広く見るは手番交代でも維持し、追従再開後は小さな移動で画面を揺らさない', () => {
  const {rerender}=render(<TokyoBoard state={stateAt()} onStep={()=>{}} />);
  fireEvent.click(screen.getByRole('button', { name: '広く見る' }));
  const before=camera().style.transform;
  const next=stateAt('asakusa');
  next.players[0].id=1;
  rerender(<TokyoBoard state={next} onStep={()=>{}} />);
  expect(camera().style.transform).toBe(before);
  fireEvent.click(screen.getByRole('button', { name: '現在地へ戻る' }));
  const followed=camera().style.transform;
  next.players=[{...next.players[0], position:nodes.find(n=>n.id==='asakusa')!.neighbors[0]}];
  rerender(<TokyoBoard state={{...next}} onStep={()=>{}} />);
  expect(camera().style.transform).toBe(followed);
});
