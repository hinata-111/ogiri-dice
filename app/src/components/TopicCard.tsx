import type { AnswerContext } from "../game/state";
import type { Topic } from "../game/types";

interface Props {
  topic: Topic;
  judging: boolean;
  context: AnswerContext;
}

export function TopicCard({ topic, judging, context }: Props) {
  const banner =
    context.kind === "blue" ? "🟦 チャンス大喜利！ スコア×3万円ゲット"
    : context.kind === "red" ? `🟥 ピンチ大喜利！ 目標 ${context.target} 点未満で罰金`
    : null;
  return (
    <div className={`topic-card${judging ? " judging" : ""}`}>
      {banner && <div className="category" style={{ fontWeight: 700 }}>{banner}</div>}
      <div className="category">{topic.category}</div>
      <div className="prompt">{judging ? "審査中…！" : topic.prompt}</div>
    </div>
  );
}
