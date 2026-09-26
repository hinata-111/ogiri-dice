import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ResultOverlay } from './ResultOverlay';

afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()});
it('shows the score immediately when reduced motion is requested',()=>{
  vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));
  render(<ResultOverlay result={{score:5,comment:'お見事'}} answer="回答" playerName="たろう" context={{kind:'main'}} moneyDelta={0} money={100000} onProceed={()=>{}}/>);
  expect(screen.getByRole('button',{name:'5マス進む！'})).toBeTruthy();
  expect(screen.queryByText('点数は…')).toBeNull();
});
it('赤マスの所持金不足時には実際の減額と0万円の下限を表示する',()=>{
  vi.useFakeTimers();
  render(<ResultOverlay result={{score:1,comment:'今回は惜しい！'}} answer="回答" playerName="たろう" context={{kind:'red',target:4}} moneyDelta={-90000} money={30000} onProceed={()=>{}} onRetry={()=>{}}/>);
  act(()=>vi.advanceTimersByTime(600));
  expect(screen.getByText('-3万円…')).toBeTruthy();
  expect(screen.queryByText('-9万円…')).toBeNull();
  expect(screen.getByLabelText('所持金の変化').textContent).toContain('変更後0万円');
  expect(screen.getByText('所持金の下限は0万円')).toBeTruthy();
  expect(screen.getByText('目標 4点')).toBeTruthy();
});
