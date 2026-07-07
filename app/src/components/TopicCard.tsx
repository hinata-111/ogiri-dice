import type { Topic } from "../game/types";

interface Props {
  topic: Topic;
  judging: boolean;
}

export function TopicCard({ topic, judging }: Props) {
  return (
    <div className={`topic-card${judging ? " judging" : ""}`}>
      <div className="category">{topic.category}</div>
      <div className="prompt">{judging ? "審査中…！" : topic.prompt}</div>
    </div>
  );
}
