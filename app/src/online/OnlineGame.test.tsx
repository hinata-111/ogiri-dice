import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GameView } from '../components/GameView';
import { gameReducer, initialState } from '../game/state';
import mapData from '../data/map.json';
import type { MapNode } from '../game/types';
import App from '../App';
import { OnlineGame } from './OnlineGame';

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); history.replaceState({}, '', '/'); });
const nodes = mapData.nodes as MapNode[];
function answering() {
  let s = gameReducer(initialState, { type: 'SHOW_SETUP' });
  s = gameReducer(s, { type: 'START_GAME', nodes, startId: 'shinjuku', destinationId: 'shibuya', players: [{ name: '太郎', kind: 'human' }, { name: '花子', kind: 'human' }] });
  return gameReducer(s, { type: 'BEGIN_TURN', topic: { id: 'x', prompt: 'こんな電車はいやだ', category: '日常', difficulty: 'Easy' } });
}
describe('online game UI', () => {
  it('offers online play from the existing title without losing local play', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'はじめる' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'オンラインで遊ぶ' }));
    expect(screen.getByRole('button', { name: '部屋をつくる' })).toBeTruthy();
    expect(screen.getByLabelText('名前')).toBeTruthy();
  });
  it('renders the common topic but no answer controls for spectators', () => {
    render(<GameView state={answering()} dispatch={vi.fn()} remaining={15000} cpuAnswer={null} online canAct={false} />);
    expect(screen.getByText('こんな電車はいやだ')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/ボケを入力/)).toBeNull();
    expect(screen.getByText(/太郎.*回答中/)).toBeTruthy();
  });
  it('keeps IME confirmation from sending and sends only the current player answer', () => {
    const dispatch = vi.fn();
    render(<GameView state={answering()} dispatch={dispatch} remaining={15000} cpuAnswer={null} online canAct />);
    const input = screen.getByPlaceholderText(/ボケを入力/);
    fireEvent.change(input, { target: { value: 'つり革がちくわ' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter', isComposing: false });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SUBMIT_ANSWER', answer: 'つり革がちくわ' });
  });
  it('hides local proceed and retry controls in online result screens', () => {
    let s = answering(); s = gameReducer(s, { type: 'SUBMIT_ANSWER', answer: '答え' });
    s = gameReducer(s, { type: 'EVALUATED', result: { score: 3, comment: '通信失敗', fallback: true } });
    render(<GameView state={s} dispatch={vi.fn()} remaining={0} cpuAnswer={null} online canAct />);
    expect(screen.queryByRole('button', { name: /もう一度審査|マス進む/ })).toBeNull();
    expect(screen.getByText(/自動で進みます/)).toBeTruthy();
  });
  it('prefills the invite code and shows a useful server error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: '部屋が満員です' }), { status: 400 })));
    render(<OnlineGame initialCode="ABCD2345" onExit={() => {}} />);
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: '花子' } });
    expect((screen.getByLabelText('部屋コード') as HTMLInputElement).value).toBe('ABCD2345');
    fireEvent.click(screen.getByRole('button', { name: '部屋に参加' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('部屋が満員'));
  });
});

it('preserves my answer draft while pending or disconnected', () => {
  const state = answering();
  const { rerender } = render(<GameView state={state} dispatch={() => {}} remaining={15000} cpuAnswer={null} online canAct isMyTurn />);
  fireEvent.change(screen.getByPlaceholderText(/ボケを入力/), { target: { value: '消えてほしくない回答' } });
  rerender(<GameView state={state} dispatch={() => {}} remaining={14000} cpuAnswer={null} online canAct={false} isMyTurn />);
  expect((screen.getByPlaceholderText(/ボケを入力/) as HTMLInputElement).value).toBe('消えてほしくない回答');
  expect((screen.getByPlaceholderText(/ボケを入力/) as HTMLInputElement).disabled).toBe(true);
  rerender(<GameView state={state} dispatch={() => {}} remaining={13000} cpuAnswer={null} online canAct isMyTurn />);
  expect((screen.getByPlaceholderText(/ボケを入力/) as HTMLInputElement).value).toBe('消えてほしくない回答');
});


it('uses the latest illustrated board and allows movement only for the active participant', () => {
  let state = answering();
  state = gameReducer(state, { type: 'SUBMIT_ANSWER', answer: 'つり革がちくわ' });
  state = gameReducer(state, { type: 'EVALUATED', result: { score: 3, comment: '面白い' } });
  state = gameReducer(state, { type: 'PROCEED' });
  const dispatch = vi.fn();
  const { rerender } = render(<GameView state={state} dispatch={dispatch} remaining={30000} cpuAnswer={null} online canAct={false} />);
  expect(screen.getByAltText('東京の街並み、公園、寺社と湾岸を描いたすごろくマップ').getAttribute('src')).toContain('art/tokyo-board-console.png');
  expect(screen.queryByRole('button', { name: '決定' })).toBeNull();
  expect(screen.queryAllByRole('button', { name: /へ進む$/ })).toHaveLength(0);
  rerender(<GameView state={state} dispatch={dispatch} remaining={30000} cpuAnswer={null} online canAct />);
  fireEvent.click(screen.getAllByRole('button', { name: /へ進む$/ })[0]);
  expect(dispatch).toHaveBeenCalledWith({ type: 'STEP_TO', nodeId: expect.any(String) });
});

it('lets player 2 answer the common topic and preserves their draft when player 1 submits', () => {
  let state = answering();
  state = { ...state, simultaneous: true, phase: { name: 'turnStart' } };
  state = gameReducer(state, { type: 'BEGIN_ROUND', topic: { id: 'shared', prompt: '全員のお題', category: '日常', difficulty: 'Easy' } });
  const dispatch = vi.fn();
  const { rerender } = render(<GameView state={state} dispatch={dispatch} remaining={30000} cpuAnswer={null} online canAct isMyTurn={false} playerId={1} />);
  expect(screen.getByText('全員のお題')).toBeTruthy();
  const input = screen.getByPlaceholderText(/ボケを入力/);
  fireEvent.change(input, { target: { value: '花子の回答' } });
  state = gameReducer(state, { type: 'SUBMIT_ROUND_ANSWER', round: 1, playerId: 0, answer: '太郎の秘密' });
  rerender(<GameView state={state} dispatch={dispatch} remaining={29000} cpuAnswer={null} online canAct isMyTurn={false} playerId={1} />);
  expect((screen.getByPlaceholderText(/ボケを入力/) as HTMLInputElement).value).toBe('花子の回答');
  expect(screen.queryByText('太郎の秘密')).toBeNull();
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(dispatch).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter', isComposing: false });
  expect(dispatch).toHaveBeenCalledWith({ type: 'SUBMIT_ROUND_ANSWER', round: 1, playerId: 1, answer: '花子の回答' });
});

it('shows a submitted waiting state after reconnect and all scores in fixed player order', () => {
  let state = { ...answering(), simultaneous: true, phase: { name: 'turnStart' as const } };
  let round = gameReducer(state, { type: 'BEGIN_ROUND', topic: { id: 'shared', prompt: '全員のお題', category: '日常', difficulty: 'Easy' } });
  round = gameReducer(round, { type: 'SUBMIT_ROUND_ANSWER', round: 1, playerId: 1, answer: '花子の回答' });
  const { rerender } = render(<GameView state={round} dispatch={vi.fn()} remaining={25000} cpuAnswer={null} online canAct={false} playerId={1} />);
  expect(screen.getByText(/回答を提出しました/)).toBeTruthy();
  expect(screen.queryByPlaceholderText(/ボケを入力/)).toBeNull();
  round = gameReducer(round, { type: 'CLOSE_ROUND' });
  round = gameReducer(round, { type: 'ROUND_EVALUATED', round: 1, playerId: 1, result: { score: 6, comment: '最高' } });
  rerender(<GameView state={round} dispatch={vi.fn()} remaining={5000} cpuAnswer={null} online canAct={false} playerId={1} />);
  const result = screen.getByRole('list', { name: '全員の回答と歩数' });
  expect(result.textContent).toMatch(/太郎.*1マス.*花子.*6マス/s);
  expect(screen.getByText(/プレイヤー1から順に移動/)).toBeTruthy();
});
