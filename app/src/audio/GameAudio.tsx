import { useEffect, useRef } from 'react';
import type { GameState } from '../game/state';
import { useAudio } from './context';
import { cuesForTransition } from './events';
import { RESULT_REVEAL_MS } from '../ui/constants';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function GameAudio({ state, remaining, connected = true }: { state: GameState; remaining: number; connected?: boolean }) {
  const {play,setScene} = useAudio();
  const reducedMotion = useReducedMotion();
  const previous = useRef<GameState | null>(null);
  const wasConnected = useRef(false);
  const lastSecond = useRef<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const phase = state.phase.name;
  useEffect(() => {
    setScene(phase === 'title' || phase === 'setup' ? 'menu' : ['awaitingAnswer', 'evaluating', 'roundAnswering', 'roundEvaluating'].includes(phase) ? 'thinking' : phase === 'gameResult' ? 'results' : 'board');
  }, [phase,setScene]);
  useEffect(() => {
    if (!connected || phase !== 'showingResult') clearTimeout(revealTimer.current);
    if (connected && wasConnected.current && previous.current) {
      cuesForTransition(previous.current, state).forEach(cue => { if (cue !== 'roll' || !reducedMotion) play(cue); });
      const resultPhase = state.phase;
      if (previous.current.phase.name !== 'showingResult' && resultPhase.name === 'showingResult') {
        clearTimeout(revealTimer.current);
        revealTimer.current = setTimeout(() => {
          play(resultPhase.context.kind === 'red' && resultPhase.moneyDelta < 0 ? 'loss' : resultPhase.context.kind === 'blue' ? 'gain' : 'score', resultPhase.result.fallback ? 2 : resultPhase.result.score);
        }, reducedMotion ? 0 : RESULT_REVEAL_MS);
      }
    }
    previous.current = state; wasConnected.current = connected;
  }, [state,phase,connected,play,reducedMotion]);
  useEffect(() => () => clearTimeout(revealTimer.current), []);
  useEffect(() => {
    const second = Math.ceil(remaining / 1000);
    const answering = phase === 'awaitingAnswer' || phase === 'roundAnswering';
    if (connected && answering && second > 0 && second <= 5 && lastSecond.current !== null && second === lastSecond.current - 1) play('tick');
    lastSecond.current = connected && answering ? second : null;
  }, [remaining,phase,connected,play]);
  return null;
}
