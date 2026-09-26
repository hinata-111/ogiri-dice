import type { AnswerContext } from "../game/state";
import type { Topic } from "../game/types";
import { CHALLENGE_UNIT } from '../game/rules';

interface Props {
  topic: Topic;
  judging: boolean;
  context: AnswerContext;
}

export function TopicCard({ topic, judging, context }: Props) {
  const banner =
    context.kind === "blue" ? `青マス · チャンス大喜利！ 1点につき${CHALLENGE_UNIT/10000}万円`
    : context.kind === "red" ? `赤マス · ピンチ大喜利！ 目標 ${context.target} 点`
    : null;
  return (
    <div className={`topic-card${judging ? " judging" : ""}`}>
      {banner && <div className="category challenge-banner" style={{ fontWeight: 700 }}>{banner}</div>}
      <div className="category">{topic.category}</div>
      <div className="prompt">{judging ? "さて、どれだけ笑いがとれた？" : topic.prompt}</div>
      {judging&&<div className="judging-stage" role="status"><b>審査席</b><small>ただいま、笑いを審査中</small></div>}
    </div>
  );
}
