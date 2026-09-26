import { render, cleanup, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useViewportHeight } from './useViewportHeight';

function ViewportHarness(){useViewportHeight();return null}
afterEach(()=>{cleanup();vi.unstubAllGlobals()});

it('layout viewportが変わらなくてもキーボードで狭くなった表示領域へ追従し、閉じると戻す',()=>{
  const viewport=Object.assign(new EventTarget(),{height:390,scale:1});
  vi.stubGlobal('innerHeight',390);
  vi.stubGlobal('visualViewport',viewport);
  const {unmount}=render(<ViewportHarness/>);
  const root=document.documentElement;
  expect(root.hasAttribute('data-keyboard-open')).toBe(false);
  act(()=>{viewport.height=180;viewport.dispatchEvent(new Event('resize'))});
  expect(root.style.getPropertyValue('--viewport-height')).toBe('180px');
  expect(root.hasAttribute('data-keyboard-open')).toBe(true);
  act(()=>{viewport.height=390;viewport.dispatchEvent(new Event('resize'))});
  expect(root.hasAttribute('data-keyboard-open')).toBe(false);
  unmount();
  expect(root.style.getPropertyValue('--viewport-height')).toBe('');
});

it('ピンチ拡大をキーボード表示と誤認しない',()=>{
  vi.stubGlobal('innerHeight',390);
  vi.stubGlobal('visualViewport',Object.assign(new EventTarget(),{height:180,scale:2}));
  render(<ViewportHarness/>);
  expect(document.documentElement.hasAttribute('data-keyboard-open')).toBe(false);
});

it('Safariの表示領域のスクロールと横幅を追従する',()=>{
  const viewport=Object.assign(new EventTarget(),{height:140,width:720,offsetTop:180,offsetLeft:12,scale:1});
  vi.stubGlobal('innerHeight',390);
  vi.stubGlobal('visualViewport',viewport);
  const {unmount}=render(<ViewportHarness/>);
  const root=document.documentElement;
  expect(root.style.getPropertyValue('--viewport-top')).toBe('180px');
  act(()=>{viewport.offsetTop=210;viewport.dispatchEvent(new Event('scroll'))});
  expect(root.style.getPropertyValue('--viewport-top')).toBe('210px');
  expect(root.style.getPropertyValue('--viewport-width')).toBe('720px');
  unmount();
  expect(root.style.getPropertyValue('--viewport-top')).toBe('');
});

it('layout viewportも同時に縮むブラウザで入力中のキーボードを検出する',()=>{
  const viewport=Object.assign(new EventTarget(),{height:390,scale:1});
  vi.stubGlobal('innerHeight',390);
  vi.stubGlobal('visualViewport',viewport);
  render(<><ViewportHarness/><input aria-label="回答"/></>);
  act(()=>{document.querySelector('input')!.focus()});
  act(()=>{vi.stubGlobal('innerHeight',140);viewport.height=140;viewport.dispatchEvent(new Event('resize'))});
  expect(document.documentElement.hasAttribute('data-keyboard-open')).toBe(true);
  act(()=>{vi.stubGlobal('innerHeight',390);viewport.height=390;viewport.dispatchEvent(new Event('resize'))});
  expect(document.documentElement.hasAttribute('data-keyboard-open')).toBe(false);
});
