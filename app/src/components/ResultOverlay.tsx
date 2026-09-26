import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AnswerContext } from '../game/state';
import type { EvaluationResult } from '../game/types';
import { RESULT_REVEAL_MS } from '../ui/constants';
import { applyMoney } from '../game/rules';
import { MoneyChange } from './MoneyChange';
import { playerColors } from '../presentation/palette';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  topicPrompt?: string;
  result: EvaluationResult;
  answer: string;
  playerName: string;
  playerId?: number;
  context: AnswerContext;
  moneyDelta: number;
  money: number;
  onProceed?: () => void;
  onRetry?: () => void;
}

export function ResultOverlay({
  result, answer, playerName, playerId, context, moneyDelta, money, onProceed, onRetry, topicPrompt,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [revealReady, setRevealed] = useState(false);
  const revealed = reducedMotion || revealReady;
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), RESULT_REVEAL_MS);
    return () => clearTimeout(timer);
  }, []);

  const proceedLabel = context.kind === 'main' ? `${result.score}マス進む！` : '金額を確定して次へ';
  const moneyAfter = applyMoney(money, moneyDelta);
  const appliedDelta = moneyAfter - money;
  const deltaText =
    context.kind === 'main' ? null
      : moneyDelta > 0 ? `+${moneyDelta / 10000}万円！`
        : moneyDelta < 0 ? appliedDelta < 0 ? `${appliedDelta / 10000}万円…` : '所持金は0万円のまま'
          : 'セーフ！増減なし';

  return <div className="overlay result-overlay">
    <section className={`panel result-panel ${context.kind} ${revealed ? 'is-revealed' : ''}`} aria-live="polite"
      style={{ '--speaker-color': playerId === undefined ? '#b94b4b' : playerColors[playerId % playerColors.length] } as CSSProperties}>
      <header className="result-header"><h2 className="result-author">
        {playerId !== undefined && <span>{playerId + 1}</span>}{playerName}の回答
      </h2>{result.fallback && <small>仮の採点結果</small>}</header>
      <div className="result-body" tabIndex={0} aria-label="回答と講評">
        <div className="result-reading">
          {topicPrompt && <p className="result-topic">お題：{topicPrompt}</p>}
          <p className={`result-answer ${answer.length > 45 ? 'is-long' : ''}`}>{answer || '（回答なし）'}</p>
        </div>
        <div className="result-award">
          {!revealed ? <div className="score-pending">点数は…</div> : <>
            <div className="score-big score-reveal">{result.score}<small>点</small></div>
            {context.kind === 'main' && <div className="result-delta">{result.score}マス進める</div>}
            {context.kind === 'red' && <div className="result-target">目標 {context.target}点</div>}
            {deltaText && <div className="result-delta">{deltaText}</div>}
            {context.kind !== 'main' && <MoneyChange before={money} after={moneyAfter}/>}
            {money + moneyDelta < 0 && <small className="result-floor">所持金の下限は0万円</small>}
          </>}
        </div>
        {revealed && <p className="result-comment"><span>放送作家</span>{result.comment}</p>}
      </div>
      <footer className="result-footer">
        {revealed && result.fallback && <p className="fallback-note">採点につながらなかったため、仮の点数です。{onRetry ? 'このまま進むか、もう一度採点できます。' : '自動で次へ進みます。'}</p>}
        {(revealed || !onProceed) && <div className="result-actions">
          {onProceed ? <button className="primary" onClick={onProceed}><span aria-hidden="true">▶ </span>{proceedLabel}</button> : <p>まもなく自動で進みます</p>}
          {result.fallback && onRetry && <button className="ghost" onClick={onRetry}>もう一度審査</button>}
        </div>}
      </footer>
    </section>
  </div>;
}
