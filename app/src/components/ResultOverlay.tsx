import { useEffect, useState } from "react";
import type { EvaluationResult } from "../game/types";
import { RESULT_REVEAL_MS } from "../ui/constants";

interface Props {
  result: EvaluationResult;
  answer: string;
  playerName: string;
  onProceed: () => void;
  onRetry: () => void;
}

export function ResultOverlay({ result, answer, playerName, onProceed, onRetry }: Props) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), RESULT_REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

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
          <div style={{ display: "flex", gap: 12 }}>
            <button className="primary" onClick={onProceed}>
              {result.score}マス進む！
            </button>
            {result.fallback && (
              <button className="ghost" onClick={onRetry}>
                もう一度審査
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
