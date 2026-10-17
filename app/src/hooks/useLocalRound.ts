import { useEffect, useRef } from 'react';
import type { GameAction, GameState } from '../game/state';
import { FALLBACK_CPU_ANSWERS, FALLBACK_EVALUATION, type Evaluator } from '../ai/evaluator';
import { ONLINE_EVALUATION_MS, ONLINE_RESULT_MS } from '../game/rules';

/** Start each batch once per phase/round, not again when one participant finishes. */
export function useLocalRound(state: GameState, evaluator: Evaluator, dispatch: (action: GameAction) => void) {
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const snapshot = latest.current;
    const shared = snapshot.sharedRound;
    if (!shared) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (snapshot.phase.name === 'roundAnswering') {
      for (const player of snapshot.players.filter(p => p.kind === 'cpu')) {
        evaluator.cpuAnswer(shared.topic.prompt, player.personality ?? 'safe')
          .catch(() => FALLBACK_CPU_ANSWERS[0]).then(answer => {
            if (!cancelled) dispatch({ type: 'SUBMIT_ROUND_ANSWER', round: snapshot.round, playerId: player.id, answer });
          });
      }
    } else if (snapshot.phase.name === 'roundEvaluating') {
      for (const entry of shared.entries.filter(e => e.submitted && !e.result)) {
        evaluator.evaluate(shared.topic.prompt, entry.answer).catch(() => FALLBACK_EVALUATION).then(result => {
          if (!cancelled) dispatch({ type: 'ROUND_EVALUATED', round: snapshot.round, playerId: entry.playerId, result });
        });
      }
      timer = setTimeout(() => dispatch({ type: 'ROUND_EVALUATION_TIMEOUT' }), ONLINE_EVALUATION_MS);
    } else if (snapshot.phase.name === 'roundResults') {
      timer = setTimeout(() => dispatch({ type: 'PROCEED' }), ONLINE_RESULT_MS);
    }
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state.phase.name, state.round, evaluator, dispatch]);
}
