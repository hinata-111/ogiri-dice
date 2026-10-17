import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
vi.mock('./ai',()=>({createEvaluator:()=>({evaluate:async()=>({score:6,comment:'よくできました！'}),cpuAnswer:async()=> '確認用回答'})}));

beforeEach(()=>{
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()});

it('人の手番はお題を見るまで待ち、開始後だけ30秒で時間切れになる',()=>{
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'はじめる'}));
  fireEvent.click(screen.getByRole('button',{name:'ゲーム開始！'}));
  act(()=>vi.advanceTimersByTime(30000));
  expect(screen.queryByLabelText('あなたの回答')).toBeNull();
  expect(screen.getByRole('button',{name:'お題を見る'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'お題を見る'}));
  expect(screen.getByLabelText('あなたの回答')).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByLabelText('あなたの回答'));
  expect(document.querySelector('.tokyo-board')?.closest('[inert]')).toBeTruthy();
  act(()=>vi.advanceTimersByTime(16000));
  expect(screen.getByLabelText('あなたの回答')).toBeTruthy();
  act(()=>vi.advanceTimersByTime(15000));
  expect(screen.queryByLabelText('あなたの回答')).toBeNull();
  act(()=>vi.advanceTimersByTime(3000));
  expect(screen.getByRole('list',{name:'全員の回答と歩数'}).textContent).toContain('1マス');
});

it('回答・進路選択・3回の到着を経て100万円の優勝からタイトルへ戻れる',async()=>{
  vi.spyOn(Math,'random').mockReturnValue(0);
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'はじめる'}));
  fireEvent.click(screen.getByRole('button',{name:'プレイヤー2を外す'}));
  fireEvent.click(screen.getByRole('button',{name:'ゲーム開始！'}));
  // Deterministic destinations: 新宿→高円寺→中野→高円寺. Follow the first legal adjacent cell.
  for(const [arrivalIndex,steps] of [5,3,3].entries()){
    fireEvent.click(screen.getByRole('button',{name:'お題を見る'}));
    fireEvent.change(screen.getByLabelText('あなたの回答'),{target:{value:'改札が座布団を配っている'}});
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'送信！'}));});
    act(()=>vi.advanceTimersByTime(1000));
    act(()=>vi.advanceTimersByTime(5000));
    expect(document.querySelector('.tokyo-board')?.closest('[inert]')).toBeNull();
    expect(screen.getByText('光っている隣のマスをタップ')).toBeTruthy();
    expect(document.activeElement?.classList.contains('tokyo-cell-move')).toBe(true);
    for(let i=0;i<steps;i++){
      fireEvent.click(screen.getAllByRole('button',{name:/へ進む$/})[0]);
      if(i<steps-1)expect(document.activeElement?.classList.contains('tokyo-cell-move')).toBe(true);
    }
    expect(screen.getByText(/到着ボーナス/)).toBeTruthy();
    const receipt=screen.getByLabelText('所持金の変化');
    expect(receipt.textContent).toContain(`変更前${10+arrivalIndex*30}万円`);
    expect(receipt.textContent).toContain(`変更後${40+arrivalIndex*30}万円`);
    fireEvent.click(screen.getByRole('button',{name:'次の目的地へ'}));
  }
  expect(screen.getByRole('heading',{name:'プレイヤー1、優勝！'})).toBeTruthy();
  expect(within(screen.getByRole('list')).getByText('100万円')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'タイトルへ戻る'}));
  expect(screen.getByRole('button',{name:'はじめる'})).toBeTruthy();
});

it('縦画面でも回転を求めず設定から回答まで操作できる',()=>{
  vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));
  render(<App/>);
  expect(screen.queryByText('スマホを横にしてね')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'はじめる'}));
  fireEvent.click(screen.getByRole('button',{name:'ゲーム開始！'}));
  fireEvent.click(screen.getByRole('button',{name:'お題を見る'}));
  expect(screen.getByLabelText('あなたの回答').closest('[inert]')).toBeNull();
  expect(document.activeElement).toBe(screen.getByLabelText('あなたの回答'));
});

it('設定では名前入力を自動起動せず開始ボタンへフォーカスする',()=>{
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'はじめる'}));
  expect(document.activeElement).toBe(screen.getByRole('button',{name:'ゲーム開始！'}));
});

it('人間とCPUが共通のお題に回答し、全員採点後にプレイヤー1から移動する', async () => {
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'はじめる'}));
  fireEvent.click(screen.getByRole('button',{name:'ゲーム開始！'}));
  fireEvent.click(screen.getByRole('button',{name:'お題を見る'}));
  expect(screen.getByText('あと 30 秒')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('あなたの回答'),{target:{value:'人間の回答'}});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'送信！'}));});
  await act(async()=>{vi.advanceTimersByTime(3000);});
  expect(screen.getByRole('list',{name:'全員の回答と歩数'}).textContent).toMatch(/プレイヤー1.*人間の回答.*ロボ作家.*確認用回答/s);
  act(()=>vi.advanceTimersByTime(5000));
  expect(document.querySelector('[data-phase="moving"]')).toBeTruthy();
  expect(screen.getAllByRole('button',{name:/へ進む$/}).length).toBeGreaterThan(0);
});

it('同じ端末の複数人にも共通の30秒で入力欄を用意する', () => {
  render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'はじめる'}));
  fireEvent.change(screen.getByLabelText('プレイヤー2の操作'),{target:{value:'human'}});
  fireEvent.click(screen.getByRole('button',{name:'ゲーム開始！'}));
  fireEvent.click(screen.getByRole('button',{name:'お題を見る'}));
  expect(screen.getAllByLabelText('あなたの回答')).toHaveLength(2);
  expect(screen.getAllByText('あと 30 秒')).toHaveLength(1);
});
