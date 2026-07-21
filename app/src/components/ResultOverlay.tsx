import { useEffect, useState } from "react";
import type { AnswerContext } from "../game/state";
import type { EvaluationResult } from "../game/types";
import { RESULT_REVEAL_MS } from "../ui/constants";

interface Props {
  result: EvaluationResult;
  answer: string;
  playerName: string;
  context: AnswerContext;
  moneyDelta: number;
  onProceed: () => void;
  onRetry: () => void;
}

export function ResultOverlay({
  result, answer, playerName, context, moneyDelta, onProceed, onRetry,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), RESULT_REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

  const proceedLabel =
    context.kind === "main" ? `${result.score}マス進む！` : "OK";
  const deltaText =
    context.kind === "main" ? null
    : moneyDelta > 0 ? `💰 +${moneyDelta / 10000}万円！`
    : moneyDelta < 0 ? `💸 ${moneyDelta / 10000}万円…`
    : "セーフ！増減なし";

  return (
    <div className="overlay">
      <div style={{ opacity: 0.8 }}>{playerName} の回答</div>
      {answer !== "" && <div className="comment-bubble">{answer}</div>}
      {!revealed ? (
        <div className="score-big">🥁</div>
      ) : (
        <>
          <div className="score-big">{result.score}点</div>
          <div className="comment-bubble">{result.comment}</div>
          {deltaText && <div className="score-big" style={{ fontSize: 32 }}>{deltaText}</div>}
          <div style={{ display: "flex", gap: 12 }}>
            <button className="primary" onClick={onProceed}>{proceedLabel}</button>
            {result.fallback && (
              <button className="ghost" onClick={onRetry}>もう一度審査</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
