import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AudioEngine } from './engine';
import { defaultPreferences, normalizePreferences, type AudioPreferences, type MusicScene, type SoundCue } from './events';
import { AudioContext } from './context';

const STORAGE_KEY = 'ogiri-dice-audio-v1';

export function AudioProvider({ children }: { children: ReactNode }) {
  const engine = useRef<AudioEngine | null>(null);
  const [preferences, setPreferences] = useState(() => {
    try { return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { return defaultPreferences; }
  });
  const [open,setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const settings = useRef<HTMLDivElement>(null);
  const getEngine = useCallback(() => engine.current ??= new AudioEngine(), []);
  const play = useCallback((cue: SoundCue, score?: number) => getEngine().play(cue,score), [getEngine]);
  const setScene = useCallback((scene: MusicScene) => getEngine().setScene(scene), [getEngine]);
  const unlock = useCallback(() => { void getEngine().unlock(); }, [getEngine]);
  const updatePreferences = useCallback((patch: Partial<AudioPreferences>) => setPreferences(old => normalizePreferences({...old,...patch})), []);
  useEffect(() => {
    getEngine().setPreferences(preferences);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Private mode still supports sound. */ }
  }, [preferences,getEngine]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button || button.disabled) return;
      void getEngine().unlock().then(() => {
        if (button.dataset.sound !== 'none') play(button.classList.contains('primary') ? 'confirm' : 'select');
      });
    };
    const keyboard = (event: KeyboardEvent) => { if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) unlock(); };
    const visibility = () => getEngine().setHidden(document.hidden);
    document.addEventListener('click',click,true); document.addEventListener('keydown',keyboard,true);
    document.addEventListener('visibilitychange',visibility); visibility();
    return () => { document.removeEventListener('click',click,true); document.removeEventListener('keydown',keyboard,true); document.removeEventListener('visibilitychange',visibility); engine.current?.dispose(); engine.current = null; };
  },[getEngine,play,unlock]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (e.target instanceof Node && !settings.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown',close);
  },[open]);
  const value = useMemo(() => ({play,setScene,unlock,preferences,updatePreferences}),[play,setScene,unlock,preferences,updatePreferences]);
  return <AudioContext.Provider value={value}>
    {children}
    <div className="sound-settings" ref={settings} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }}>
      <button className="sound-trigger" ref={trigger} aria-label="音の設定" aria-expanded={open} aria-controls="sound-panel" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z"/>{preferences.muted ? <path d="m16 8 6 8m0-8-6 8"/> : <><path d="M16 8q4 4 0 8M19 4q8 8 0 16"/></>}</svg>
        <span>音 {preferences.muted ? 'OFF' : 'ON'}</span>
      </button>
      {open && <section className="sound-panel" id="sound-panel" aria-label="音の設定">
        <header><strong>音の設定</strong><button aria-label="音の設定を閉じる" onClick={() => { setOpen(false); trigger.current?.focus(); }}>閉じる</button></header>
        <label>BGM <output>{Math.round(preferences.music*100)}%</output><input aria-label="BGM音量" type="range" min="0" max="100" value={Math.round(preferences.music*100)} onChange={e => { unlock(); updatePreferences({music:Number(e.target.value)/100}); }}/></label>
        <label>効果音 <output>{Math.round(preferences.effects*100)}%</output><input aria-label="効果音音量" type="range" min="0" max="100" value={Math.round(preferences.effects*100)} onChange={e => updatePreferences({effects:Number(e.target.value)/100})}/></label>
        <div><button aria-pressed={preferences.muted} data-sound="none" onClick={() => updatePreferences({muted:!preferences.muted})}>{preferences.muted ? '音を出す' : 'すべて消音'}</button><button onClick={() => play('arrival')}>音をためす</button></div>
        <small>設定はこの端末に保存されます</small>
      </section>}
    </div>
  </AudioContext.Provider>;
}
