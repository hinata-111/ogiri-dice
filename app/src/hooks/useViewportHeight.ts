import { useEffect } from 'react';

/** Follow the visible rectangle, including Safari's pan to the focused input. */
export function useViewportHeight() {
  useEffect(()=>{
    const viewport=window.visualViewport;
    const root=document.documentElement;
    let baseline=window.innerHeight;
    const update=()=>{
      const height=viewport?.height??window.innerHeight;
      const focused=document.activeElement?.matches('input:not([readonly]):not(:disabled), textarea');
      if(!focused) baseline=window.innerHeight;
      root.style.setProperty('--viewport-height',`${height}px`);
      root.style.setProperty('--viewport-width',`${viewport?.width??window.innerWidth}px`);
      root.style.setProperty('--viewport-top',`${viewport?.offsetTop??0}px`);
      root.style.setProperty('--viewport-left',`${viewport?.offsetLeft??0}px`);
      root.toggleAttribute('data-keyboard-open',(!viewport||viewport.scale===1)&&
        (window.innerHeight-height>100||!!focused&&(baseline-height>100||height<260)));
    };
    update();
    viewport?.addEventListener('resize',update);
    viewport?.addEventListener('scroll',update);
    window.addEventListener('resize',update);
    document.addEventListener('focusin',update);
    document.addEventListener('focusout',update);
    return ()=>{
      viewport?.removeEventListener('resize',update);
      viewport?.removeEventListener('scroll',update);
      window.removeEventListener('resize',update);
      document.removeEventListener('focusin',update);
      document.removeEventListener('focusout',update);
      for(const name of ['height','width','top','left']) root.style.removeProperty(`--viewport-${name}`);
      root.removeAttribute('data-keyboard-open');
    };
  },[]);
}
