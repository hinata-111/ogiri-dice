import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AnswerInput } from './AnswerInput';

afterEach(cleanup);
it('日本語変換の確定Enterでは送信せず、その後のEnterで回答を送る',()=>{
  const onSubmit=vi.fn();
  render(<AnswerInput disabled={false} cpuAnswer={null} onSubmit={onSubmit}/>);
  const input=screen.getByRole('textbox',{name:'あなたの回答'});
  fireEvent.change(input,{target:{value:'  駅長が座布団を配る  '}});
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input,{key:'Enter',isComposing:true});
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  fireEvent.keyDown(input,{key:'Enter',isComposing:false});
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith('駅長が座布団を配る');
});
it('空白だけの回答では送信できない',()=>{
  const onSubmit=vi.fn();
  render(<AnswerInput disabled={false} cpuAnswer={null} onSubmit={onSubmit}/>);
  const input=screen.getByRole('textbox',{name:'あなたの回答'});
  fireEvent.change(input,{target:{value:'　  '}});
  fireEvent.keyDown(input,{key:'Enter'});
  expect(onSubmit).not.toHaveBeenCalled();
  expect((screen.getByRole('button',{name:'送信！'}) as HTMLButtonElement).disabled).toBe(true);
});
