import { useEffect, useState } from "react";
import type { AnswerContext } from "../game/state";
import type { EvaluationResult } from "../game/types";
import { RESULT_REVEAL_MS } from "../ui/constants";
import { applyMoney } from '../game/rules';
import { MoneyChange } from './MoneyChange';

interface Props {
  topicPrompt?: string;
  result: EvaluationResult;
  answer: string;
  playerName: string;
  context: AnswerContext;
  moneyDelta: number;
  money: number;
  onProceed: () => void;
  onRetry: () => void;
}

export function ResultOverlay({
  result, answer, playerName, context, moneyDelta, money, onProceed, onRetry, topicPrompt,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), RESULT_REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const proceedLabel =
    context.kind === "main" ? `${result.score}マス進む！` : "金額を確定して次へ";
  const moneyAfter=applyMoney(money,moneyDelta);
  const appliedDelta=moneyAfter-money;
  const deltaText =
    context.kind === "main" ? null
    : moneyDelta > 0 ? `+${moneyDelta / 10000}万円！`
    : moneyDelta < 0 ? appliedDelta<0?`${appliedDelta / 10000}万円…`:"所持金は0万円のまま"
    : "セーフ！増減なし";

  return (
    <div className="overlay">
      <section className={`panel result-panel ${context.kind}`} aria-live="polite">
      <div className="result-reading" tabIndex={0} aria-label="回答と講評">
        {topicPrompt&&<p className="result-topic">{topicPrompt}</p>}
        <div className="result-author">{playerName} の回答</div>
        {answer !== "" && <div className="comment-bubble">{answer}</div>}
        {revealed&&<p className="result-comment">{result.comment}</p>}
      </div>
      <div className="result-award">
      {!revealed ? <div className="score-big">点数は…</div> : <>
          <div className="score-big score-reveal">{result.score}<small>点</small></div>
          {context.kind==='main'&&<div className="result-delta">東京を{result.score}マス進める！</div>}
          {context.kind==='red'&&<div className="result-target">目標 {context.target}点</div>}
          {deltaText && <div className="result-delta">{deltaText}</div>}
          {context.kind!=='main'&&<MoneyChange before={money} after={moneyAfter}/>}
          {money+moneyDelta<0&&<small className="result-floor">所持金の下限は0万円</small>}
      </>}
      </div>
      {revealed&&<footer className="result-footer">
          {result.fallback && <p className="fallback-note">採点につながらなかったため、仮の点数です。このまま進むか、もう一度採点できます。</p>}
          <div className="result-actions">
            <button className="primary" onClick={onProceed}>{proceedLabel}</button>
            {result.fallback && (
              <button className="ghost" onClick={onRetry}>もう一度審査</button>
            )}
          </div>
      </footer>}
      </section>
    </div>
  );
}
